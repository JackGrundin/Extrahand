const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaTidrapport, hämtaTidrapportFörAnsökan, uppdateraTidrapportStatus, hämtaAllaTidrapporter, hämtaTidrapporterFörFöretag } = require('../db/tidrapporter');
const { hämtaAnsökanViaId } = require('../db/ansokningar');
const { hämtaJobbViaId } = require('../db/jobb');
const { hämtaAnvändareViaEmail } = require('../db/användare');

const router = express.Router();

const ADMIN_EMAIL = 'info@fastgig.se';

// POST /api/tidrapporter — företag avslutar pass och rapporterar timmar
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { ansokan_id, timmar } = req.body;
  if (!ansokan_id || !timmar || timmar <= 0) {
    return res.status(400).json({ fel: 'ansokan_id och timmar krävs' });
  }

  try {
    const ansökan = await hämtaAnsökanViaId(ansokan_id);
    if (!ansökan) return res.status(404).json({ fel: 'Ansökan hittades inte' });
    if (ansökan.status !== 'godkänd') return res.status(400).json({ fel: 'Ansökan måste vara godkänd' });

    const jobb = await hämtaJobbViaId(ansökan.jobb_id);
    const timlon = jobb?.Lon ?? 0;
    const totalt_belopp = timmar * timlon;
    const datum = new Date().toISOString().split('T')[0];

    const rapport = await skapaTidrapport({
      ansokan_id,
      foretag_id: req.användare.id,
      anvandare_id: ansökan.sokande_id,
      datum,
      timmar,
      timlon,
      totalt_belopp,
    });

    res.status(201).json(rapport);
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

module.exports = router;
