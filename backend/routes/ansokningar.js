const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan } = require('../db/ansokningar');

const router = express.Router();

// POST /api/ansokningar/:jobbId — privatperson söker ett jobb
router.post('/:jobbId', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  const { jobbId } = req.params;
  const { meddelande } = req.body;

  try {
    const dubblett = await finnsDubblettAnsökan(jobbId, req.användare.id);
    if (dubblett) {
      return res.status(409).json({ fel: 'Du har redan sökt detta jobb' });
    }

    const ansökan = await skapaAnsökan({
      jobb_id: jobbId,
      sokande_id: req.användare.id,
      meddelande: meddelande || null,
    });

    res.status(201).json(ansökan);
  } catch (fel) {
    console.error('Fel vid ansökan:', fel);
    res.status(500).json({ fel: 'Serverfel vid ansökan' });
  }
});

// GET /api/ansokningar/mina — privatperson ser sina egna ansökningar
router.get('/mina', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörSökande(req.användare.id);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

// GET /api/ansokningar/jobb/:jobbId — företag ser ansökningar på sitt jobb
router.get('/jobb/:jobbId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörJobb(req.params.jobbId);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

module.exports = router;
