const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaTidrapport, uppdateraAutoTidrapport, hämtaTidrapportFörAnsökan, hämtaTidrapportViaId, uppdateraTidrapportStatus, hämtaAllaTidrapporter, hämtaTidrapporterFörFöretag, markeraTidrapportBetald } = require('../db/tidrapporter');
const { hämtaAnsökanViaId } = require('../db/ansokningar');
const { hämtaJobbViaId } = require('../db/jobb');
const { hämtaAnvändareViaEmail, hämtaAnvändareViaId, hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { påslagEller40, beräknaObBelopp, beräknaBelopp, valideraObTillagg } = require('../utils/pris');
const { sändRealtidsPing } = require('../realtid');

const router = express.Router();

const ADMIN_EMAIL = 'info@fastgig.se';

// POST /api/tidrapporter — företag avslutar pass och rapporterar timmar
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { ansokan_id, timmar, ob_tillagg: obTillaggOverride } = req.body;
  if (!ansokan_id || !timmar || timmar <= 0) {
    return res.status(400).json({ fel: 'ansokan_id och timmar krävs' });
  }

  try {
    const ansökan = await hämtaAnsökanViaId(ansokan_id);
    if (!ansökan) return res.status(404).json({ fel: 'Ansökan hittades inte' });
    if (ansökan.status !== 'godkänd') return res.status(400).json({ fel: 'Ansökan måste vara godkänd' });

    // OB från klienten MÅSTE valideras innan beräknaObBelopp: den gör start.split(':') och
    // kastar på trasig data, vilket skulle ge 500 i stället för 400. Ett OB utan gränser
    // (obegränsat värde, sluttid före starttid) skulle dessutom frysas på rapporten och
    // följa med till fakturan.
    const obFel = valideraObTillagg(obTillaggOverride);
    if (obFel) return res.status(400).json({ fel: obFel });

    const jobb = await hämtaJobbViaId(ansökan.jobb_id);
    const timlon = jobb?.Lon ?? 0;
    const obTillagg = Array.isArray(obTillaggOverride)
      ? obTillaggOverride
      : (Array.isArray(jobb?.ob_tillagg) ? jobb.ob_tillagg : []);
    const ob_belopp = beräknaObBelopp(obTillagg, timlon);
    const datum = new Date().toISOString().split('T')[0];

    // Löneavdrag allokeras bara EN gång per pass. En korrigerad rapport efter ett
    // bestridande är en ny rad för samma ansökan – räknade vi om avdraget här skulle
    // personen dras två gånger för samma dag. Kopiera från den föregående rapporten.
    const föregående = await hämtaTidrapportFörAnsökan(ansokan_id);
    const avdrag = Array.isArray(föregående?.avdrag) ? föregående.avdrag : [];
    const avdrag_belopp = Number(föregående?.avdrag_belopp) || 0;

    const belopp = beräknaBelopp({ timmar, timlon, obBelopp: ob_belopp, avdragBelopp: avdrag_belopp });

    const rapport = await skapaTidrapport({
      ansokan_id,
      foretag_id: req.användare.id,
      anvandare_id: ansökan.sokande_id,
      datum,
      timmar,
      timlon,
      ob_belopp,
      ob_tillagg: obTillagg,
      totalt_belopp: belopp.brutto,
      avdrag,
      avdrag_belopp: belopp.avdrag,
      // Påslaget fryses vid publicering och följer med jobbet hit, precis som timlönen.
      paslag: påslagEller40(jobb?.paslag),
    });

    res.status(201).json(rapport);

    // Realtidssignal (utan innehåll) till privatpersonen som fått tidrapporten
    sändRealtidsPing(ansökan.sokande_id, 'tidrapport');

    // Push-notis till privatpersonen om att en tidrapport finns att granska (i bakgrunden)
    (async () => {
      const token = await hämtaPushToken(ansökan.sokande_id);
      await skickaNotifikation(token, 'Ny tidrapport', 'Du har fått en tidrapport att granska.');
    })().catch(console.error);
  } catch (fel) {
    if (fel.kod === 409) return res.status(409).json({ fel: fel.message });
    console.error('Tidrapport fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/tidrapporter/ansokan/:ansokningId — hämta tidrapport för en ansökan
router.get('/ansokan/:ansokningId', kräverInloggning, async (req, res) => {
  try {
    const rapport = await hämtaTidrapportFörAnsökan(req.params.ansokningId);
    res.json(rapport ?? null);
  } catch (fel) {
    console.error('Tidrapport hämtning fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/tidrapporter/:id/status — privatperson godkänner eller bestrider
router.patch('/:id/status', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  const { status, orsak } = req.body;
  if (!['godkänd', 'bestridd'].includes(status)) {
    return res.status(400).json({ fel: 'Status måste vara godkänd eller bestridd' });
  }
  // Ett bestridande måste ha en förklaring så att företaget vet vad som är fel.
  const förklaring = typeof orsak === 'string' ? orsak.trim() : '';
  if (status === 'bestridd' && !förklaring) {
    return res.status(400).json({ fel: 'En förklaring krävs vid bestridande' });
  }

  try {
    const rapport = await hämtaTidrapportViaId(req.params.id);
    if (!rapport) return res.status(404).json({ fel: 'Tidrapport hittades inte' });
    // Bara privatpersonen som rapporten gäller får ändra status.
    if (rapport.anvandare_id !== req.användare.id) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    // En rapport besvaras EN gång. Utan vakten kan en redan godkänd rapport bestridas i
    // efterhand – även efter att den fakturerats, eftersom fakturaunderlaget plockar
    // rapporter med status 'godkänd' (se hämtaOfaktureradeRapporter). En korrigering efter
    // bestridande är en ny rapport via POST, inte en statusändring på den gamla.
    if (rapport.status !== 'väntar') {
      return res.status(409).json({ fel: 'Tidrapporten är redan besvarad' });
    }

    await uppdateraTidrapportStatus(req.params.id, status, förklaring);
    res.json({ ok: true });

    // Realtidssignal (utan innehåll) till företaget som skapade tidrapporten
    if (rapport.foretag_id) sändRealtidsPing(rapport.foretag_id, 'tidrapport');

    // Vid bestridande: notera företaget. Förklaringen sparas på tidrapporten
    // (bestridande_orsak) och visas som ett "Bestridd"-kort i chatten – inte som ett
    // vanligt chattmeddelande.
    if (status === 'bestridd') {
      (async () => {
        const token = await hämtaPushToken(rapport.foretag_id);
        const avsändare = await hämtaAnvändareViaId(req.användare.id);
        const namn = avsändare?.Namn ?? 'Arbetstagaren';
        await skickaNotifikation(token, 'Tidrapport bestriden', `${namn}: ${förklaring}`);
      })().catch(console.error);
    }
  } catch (fel) {
    console.error('Status fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/tidrapporter/:id/korrigera — företag rättar en automatiskt skapad tidrapport
// som fortfarande väntar på svar (övertid eller rast på ett schemapass). Rapporten
// uppdateras på plats i stället för att ett andra kort läggs i chatten. Är rapporten redan
// bestriden gäller det vanliga flödet: företaget POSTar en ny korrigerad rapport.
router.patch('/:id/korrigera', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { timmar, ob_tillagg: obTillaggOverride } = req.body;
  if (timmar == null || !(Number(timmar) > 0)) {
    return res.status(400).json({ fel: 'Giltigt antal timmar krävs' });
  }

  try {
    const rapport = await hämtaTidrapportViaId(req.params.id);
    if (!rapport) return res.status(404).json({ fel: 'Tidrapport hittades inte' });
    if (String(rapport.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (!rapport.auto_skapad || rapport.status !== 'väntar') {
      return res.status(400).json({ fel: 'Bara en automatisk tidrapport som väntar på svar kan korrigeras' });
    }

    // Samma skäl som i POST: beräknaObBelopp kastar på trasig indata, och ett ovaliderat
    // OB fryses på rapporten och går vidare till fakturan.
    const obFel = valideraObTillagg(obTillaggOverride);
    if (obFel) return res.status(400).json({ fel: obFel });

    const obTillagg = Array.isArray(obTillaggOverride)
      ? obTillaggOverride
      : (Array.isArray(rapport.ob_tillagg) ? rapport.ob_tillagg : []);
    const ob_belopp = beräknaObBelopp(obTillagg, rapport.timlon);
    // Avdragen rörs inte: ett löneavdrag är per pass eller per period, inte per timme, så
    // en justering av timmarna ändrar det inte. Att avdraget är oberoende av timmarna är
    // just det som gör den här vägen enkel.
    const belopp = beräknaBelopp({
      timmar: Number(timmar),
      timlon: rapport.timlon,
      obBelopp: ob_belopp,
      avdragBelopp: Number(rapport.avdrag_belopp) || 0,
    });

    const uppdaterad = await uppdateraAutoTidrapport(req.params.id, req.användare.id, {
      timmar: Number(timmar),
      ob_belopp,
      ob_tillagg: obTillagg,
      totalt_belopp: belopp.brutto,
      // Klampas om det korrigerade bruttot blivit lägre än avdraget.
      avdrag_belopp: belopp.avdrag,
    });
    if (!uppdaterad) return res.status(409).json({ fel: 'Tidrapporten hann ändras – ladda om och försök igen' });

    res.json(uppdaterad);

    sändRealtidsPing(rapport.anvandare_id, 'tidrapport');

    (async () => {
      const token = await hämtaPushToken(rapport.anvandare_id);
      await skickaNotifikation(token, 'Tidrapport korrigerad', 'Företaget har justerat timmarna. Granska rapporten.');
    })().catch(console.error);
  } catch (fel) {
    console.error('Korrigering fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/tidrapporter/foretag — företag hämtar sina avslutade pass
router.get('/foretag', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const rapporter = await hämtaTidrapporterFörFöretag(req.användare.id);
    res.json(rapporter);
  } catch (fel) {
    console.error('Företags rapporter fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/tidrapporter/alla — admin: lista alla godkända tidrapporter
router.get('/alla', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }
  try {
    const { fromDate, toDate } = req.query;
    const rapporter = await hämtaAllaTidrapporter({ fromDate, toDate });
    res.json(rapporter);
  } catch (fel) {
    console.error('Alla rapporter fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/tidrapporter/:id/betald — admin: markera tidrapport som betald (raderar inte – historiken behålls)
router.patch('/:id/betald', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }
  try {
    await markeraTidrapportBetald(req.params.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Markera betald fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
