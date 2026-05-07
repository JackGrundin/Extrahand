const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { skapaAnvändare, hämtaAnvändareViaEmail } = require('../db/användare');

const router = express.Router();
const JWT_HEMLIG_NYCKEL = process.env.JWT_SECRET || 'hemlig-nyckel-byt-i-produktion';

// POST /api/auth/registrera
router.post('/registrera', async (req, res) => {
  const { namn, email, lösenord, typ } = req.body;

  if (!namn || !email || !lösenord || !typ) {
    return res.status(400).json({ fel: 'Alla fält krävs: namn, email, lösenord, typ' });
  }

  if (!['företag', 'privatperson'].includes(typ)) {
    return res.status(400).json({ fel: 'Typ måste vara "företag" eller "privatperson"' });
  }

  try {
    const befintlig = await hämtaAnvändareViaEmail(email);
    if (befintlig) {
      return res.status(409).json({ fel: 'Email används redan' });
    }

    const hashatLösenord = await bcrypt.hash(lösenord, 10);
    const användare = await skapaAnvändare({ namn, email, lösenord: hashatLösenord, typ });

    const token = jwt.sign(
      { id: användare.id, email: användare.Email, typ: användare.Typ },
      JWT_HEMLIG_NYCKEL,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, användare: { id: användare.id, namn: användare.Namn, email: användare.Email, typ: användare.Typ } });
  } catch (fel) {
    console.error('Registreringsfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid registrering' });
  }
});

// POST /api/auth/logga-in
router.post('/logga-in', async (req, res) => {
  const { email, lösenord } = req.body;

  if (!email || !lösenord) {
    return res.status(400).json({ fel: 'Email och lösenord krävs' });
  }

  try {
    const användare = await hämtaAnvändareViaEmail(email);
    if (!användare) {
      return res.status(401).json({ fel: 'Felaktig email eller lösenord' });
    }

    const lösenordStämmer = await bcrypt.compare(lösenord, användare.Lösenord);
    if (!lösenordStämmer) {
      return res.status(401).json({ fel: 'Felaktig email eller lösenord' });
    }

    const token = jwt.sign(
      { id: användare.id, email: användare.Email, typ: användare.Typ },
      JWT_HEMLIG_NYCKEL,
      { expiresIn: '7d' }
    );

    res.json({ token, användare: { id: användare.id, namn: användare.Namn, email: användare.Email, typ: användare.Typ } });
  } catch (fel) {
    console.error('Inloggningsfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid inloggning' });
  }
});

module.exports = router;
