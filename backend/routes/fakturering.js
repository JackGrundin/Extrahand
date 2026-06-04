const express = require('express');
const { kräverInloggning } = require('../middleware/auth');
const { hämtaFaktureringsunderlag, markeraFakturerad } = require('../db/fakturering');

const router = express.Router();
const ADMIN_EMAIL = 'info@fastgig.se';

// GET /api/fakturering — admin: lista ej fakturerade underlag
router.get('/', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }
  try {
    const underlag = await hämtaFaktureringsunderlag();
    res.json(underlag);
  } catch (fel) {
    console.error('Fakturering hämtning fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/fakturering/:id/fakturerad — admin: markera som fakturerad
router.patch('/:id/fakturerad', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }
  try {
    await markeraFakturerad(req.params.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fakturering uppdatering fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
