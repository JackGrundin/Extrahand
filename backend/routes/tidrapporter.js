const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaTidrapport, hämtaTidrapportFörAnsökan, hämtaTidrapportViaId, uppdateraTidrapportStatus, hämtaAllaTidrapporter, hämtaTidrapporterFörFöretag, markeraTidrapportBetald } = require('../db/tidrapporter');
const { hämtaAnsökanViaId } = require('../db/ansokningar');
const { hämtaJobbViaId } = require('../db/jobb');
const { hämtaAnvändareViaEmail } = require('../db/användare');
const { sändRealtidsPing } = require('../realtid');

const router = express.Router();

const ADMIN_EMAIL = 'info@fastgig.se';

function beräknaObBelopp(obTillagg, timlön) {
  if (!Array.isArray(obTillagg) || !obTillagg.length || !timlön) return 0;
  return obTillagg.reduce((sum, ob) => {
    const [startH = 0, startM = 0] = ob.start.split(':').map(Number);
    const [slutH = 0, slutM = 0] = ob.slut.split(':').map(Number);
    const timmar = (slutH * 60 + slutM - (startH * 60 + startM)) / 60;
    if (timmar <= 0) return sum;
    return sum + (ob.typ === 'procent' ? timmar * timlön * (ob.värde / 100) : timmar * ob.värde);
  }, 0);
}

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

    const jobb = await hämtaJobbViaId(ansökan.jobb_id);
    const timlon = jobb?.Lon ?? 0;
    const obTillagg = Array.isArray(obTillaggOverride)
      ? obTillaggOverride
      : (Array.isArray(jobb?.ob_tillagg) ? jobb.ob_tillagg : []);
    const ob_belopp = beräknaObBelopp(obTillagg, timlon);
    const totalt_belopp = timmar * timlon + ob_belopp;
    const datum = new Date().toISOString().split('T')[0];

    const rapport = await skapaTidrapport({
      ansokan_id,
      foretag_id: req.användare.id,
      anvandare_id: ansökan.sokande_id,
      datum,
      timmar,
      timlon,
      ob_belopp,
      ob_tillagg: obTillagg,
      totalt_belopp,
    });

    res.status(201).json(rapport);

    // Realtidssignal (utan innehåll) till privatpersonen som fått tidrapporten
    sändRealtidsPing(ansökan.sokande_id, 'tidrapport');
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
  const { status } = req.body;
  if (!['godkänd', 'bestridd'].includes(status)) {
    return res.status(400).json({ fel: 'Status måste vara godkänd eller bestridd' });
  }
  try {
    await uppdateraTidrapportStatus(req.params.id, status);
    res.json({ ok: true });

    // Realtidssignal (utan innehåll) till företaget som skapade tidrapporten
    const rapport = await hämtaTidrapportViaId(req.params.id);
    if (rapport?.foretag_id) sändRealtidsPing(rapport.foretag_id, 'tidrapport');
  } catch (fel) {
    console.error('Status fel:', fel);
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
