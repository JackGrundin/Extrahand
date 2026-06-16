const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const {
  skapaJobbforfragan,
  hämtaJobbforfraganMellan,
  hämtaVäntandeFörAnvändare,
  hämtaJobbforfraganViaId,
  uppdateraJobbforfraganStatus,
} = require('../db/jobbforfragan');
const { skapaJobb } = require('../db/jobb');
const { skapaAnsökan, uppdateraStatus } = require('../db/ansokningar');
const { hämtaPushToken, hämtaAnvändareViaId } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');

const router = express.Router();

// POST /api/jobbforfragan — företag erbjuder ett pass till en privatperson
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { till_anvandare_id, titel, datum, starttid, sluttid, timlon, ob_tillagg } = req.body;

  if (!till_anvandare_id || !titel || !titel.trim() || !datum || !starttid || !sluttid || timlon == null) {
    return res.status(400).json({ fel: 'Mottagare, jobbtitel, datum, tider och timlön krävs' });
  }

  try {
    const förfrågan = await skapaJobbforfragan({
      fran_anvandare_id: req.användare.id,
      till_anvandare_id,
      titel: titel.trim(),
      datum,
      starttid,
      sluttid,
      timlon,
      ob_tillagg,
    });

    res.status(201).json(förfrågan);

    // Notifiera privatpersonen i bakgrunden
    try {
      const [avsändare, pushToken] = await Promise.all([
        hämtaAnvändareViaId(req.användare.id),
        hämtaPushToken(till_anvandare_id),
      ]);
      await skickaNotifikation(
        pushToken,
        'Ny passförfrågan!',
        `${avsändare?.Namn ?? 'Ett företag'} har erbjudit dig ett pass den ${datum}`
      );
    } catch (notisfel) {
      console.error('Push-notifikation fel (förfrågan):', notisfel);
    }
  } catch (fel) {
    console.error('Fel vid skapande av jobbförfrågan:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av jobbförfrågan' });
  }
});

// GET /api/jobbforfragan/mina-vantande — väntande förfrågningar som rör inloggad användare
router.get('/mina-vantande', kräverInloggning, async (req, res) => {
  try {
    const väntande = await hämtaVäntandeFörAnvändare(req.användare.id);
    res.json(väntande);
  } catch (fel) {
    console.error('Fel vid hämtning av väntande jobbförfrågningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av väntande jobbförfrågningar' });
  }
});

// GET /api/jobbforfragan/konversation/:medAnvandareId — förfrågningar mellan inloggad och en annan användare
router.get('/konversation/:medAnvandareId', kräverInloggning, async (req, res) => {
  try {
    const förfrågningar = await hämtaJobbforfraganMellan(req.användare.id, req.params.medAnvandareId);
    res.json(förfrågningar);
  } catch (fel) {
    console.error('Fel vid hämtning av jobbförfrågningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av jobbförfrågningar' });
  }
});

// PATCH /api/jobbforfragan/:id/acceptera — privatperson accepterar och ett riktigt pass skapas
router.patch('/:id/acceptera', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const förfrågan = await hämtaJobbforfraganViaId(req.params.id);
    if (!förfrågan) return res.status(404).json({ fel: 'Förfrågan hittades inte' });
    if (förfrågan.till_anvandare_id !== req.användare.id) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (förfrågan.status !== 'väntar') {
      return res.status(400).json({ fel: 'Förfrågan är redan hanterad' });
    }

    // Skapa ett riktigt jobb som om företaget publicerat det
    const arbetstider = JSON.stringify([
      { datum: förfrågan.datum, start: förfrågan.starttid, slut: förfrågan.sluttid },
    ]);

    const jobb = await skapaJobb({
      titel: förfrågan.titel || `Pass ${förfrågan.datum}`,
      beskrivning: 'Pass erbjudet direkt via chatten.',
      plats: null,
      adress: 'Enligt överenskommelse',
      lon: förfrågan.timlon,
      typ: 'gig',
      kategori: null,
      antal_dagar: 1,
      arbetstider,
      ob_tillagg: Array.isArray(förfrågan.ob_tillagg) ? förfrågan.ob_tillagg : [],
      foretag_id: förfrågan.fran_anvandare_id,
    });

    // Skapa en redan godkänd ansökan så passet beter sig som ett vanligt godkänt pass
    const ansökan = await skapaAnsökan({
      jobb_id: jobb.id,
      sokande_id: req.användare.id,
      meddelande: null,
    });
    await uppdateraStatus(ansökan.id, 'godkänd');

    await uppdateraJobbforfraganStatus(förfrågan.id, 'accepterad');

    res.json({ ok: true, ansokanId: ansökan.id, jobbId: jobb.id });

    // Notifiera företaget
    try {
      const [mottagare, pushToken] = await Promise.all([
        hämtaAnvändareViaId(req.användare.id),
        hämtaPushToken(förfrågan.fran_anvandare_id),
      ]);
      await skickaNotifikation(
        pushToken,
        'Passförfrågan accepterad',
        `${mottagare?.Namn ?? 'Privatpersonen'} har accepterat passet den ${förfrågan.datum}`
      );
    } catch (notisfel) {
      console.error('Push-notifikation fel (acceptera):', notisfel);
    }
  } catch (fel) {
    console.error('Fel vid acceptering av jobbförfrågan:', fel);
    res.status(500).json({ fel: 'Serverfel vid acceptering av jobbförfrågan' });
  }
});

// PATCH /api/jobbforfragan/:id/avboj — privatperson avböjer förfrågan
router.patch('/:id/avboj', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const förfrågan = await hämtaJobbforfraganViaId(req.params.id);
    if (!förfrågan) return res.status(404).json({ fel: 'Förfrågan hittades inte' });
    if (förfrågan.till_anvandare_id !== req.användare.id) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (förfrågan.status !== 'väntar') {
      return res.status(400).json({ fel: 'Förfrågan är redan hanterad' });
    }

    await uppdateraJobbforfraganStatus(förfrågan.id, 'avslagen');
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid avböjning av jobbförfrågan:', fel);
    res.status(500).json({ fel: 'Serverfel vid avböjning av jobbförfrågan' });
  }
});

module.exports = router;
