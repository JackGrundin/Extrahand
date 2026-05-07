const express = require('express');
const { kräverInloggning } = require('../middleware/auth');
const { hämtaAnvändareViaEmail } = require('../db/användare');

const router = express.Router();

// GET /api/användare/profil — kräver giltig JWT
router.get('/profil', kräverInloggning, async (req, res) => {
  try {
    const användare = await hämtaAnvändareViaEmail(req.användare.email);
    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }

    res.json({
      id: användare.id,
      namn: användare.Namn,
      email: användare.Email,
      typ: användare.Typ,
      skapad: användare.Created_at,
    });
  } catch (fel) {
    console.error('Profilfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av profil' });
  }
});

module.exports = router;
