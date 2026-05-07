const express = require('express');
const { kräverInloggning } = require('../middleware/auth');
const { hämtaAnvändareViaEmail, sparaPushToken, hämtaPushToken } = require('../db/användare');

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

// POST /api/users/testa-notifikation — skickar en testnotifikation till inloggad användare
router.post('/testa-notifikation', kräverInloggning, async (req, res) => {
  try {
    const pushToken = await hämtaPushToken(req.användare.id);

    if (!pushToken) {
      return res.status(400).json({ fel: 'Ingen push-token sparad. Logga in i appen på en riktig enhet först.' });
    }

    const svar = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: 'Testnotifikation',
        body: 'Push-notifikationer fungerar!',
        sound: 'default',
      }),
    });

    const data = await svar.json();
    res.json({ ok: true, expoSvar: data });
  } catch (fel) {
    console.error('Testnotifikation fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PUT /api/users/push-token — sparar Expo-pushtoken för inloggad användare
router.put('/push-token', kräverInloggning, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ fel: 'Token krävs' });
  try {
    await sparaPushToken(req.användare.id, token);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Push-token fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
