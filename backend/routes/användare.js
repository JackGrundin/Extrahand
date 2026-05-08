const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { kräverInloggning } = require('../middleware/auth');
const { hämtaAnvändareViaEmail, hämtaAnvändareViaId, uppdateraProfil, uppdateraProfilBild, sparaPushToken, hämtaPushToken } = require('../db/användare');
const { hämtaTotalTimmar } = require('../db/ansokningar');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// GET /api/users/profil — kräver giltig JWT
router.get('/profil', kräverInloggning, async (req, res) => {
  try {
    const [användare, totalTimmar] = await Promise.all([
      hämtaAnvändareViaEmail(req.användare.email),
      hämtaTotalTimmar(req.användare.id),
    ]);

    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }

    res.json({
      id: användare.id,
      namn: användare.Namn,
      email: användare.Email,
      typ: användare.Typ,
      skapad: användare.Created_at,
      cv: användare.cv ?? null,
      erfarenheter: användare.erfarenheter ?? null,
      kompetenser: användare.kompetenser ?? null,
      intressen: användare.intressen ?? null,
      profilBild: användare.profil_bild ?? null,
      totalTimmar,
    });
  } catch (fel) {
    console.error('Profilfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av profil' });
  }
});

// GET /api/users/:id/profil — hämtar en annan användares publika profil
router.get('/:id/profil', kräverInloggning, async (req, res) => {
  try {
    const [användare, totalTimmar, betygData] = await Promise.all([
      hämtaAnvändareViaId(req.params.id),
      hämtaTotalTimmar(req.params.id),
      null,
    ]);

    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }

    res.json({
      id: användare.id,
      namn: användare.Namn,
      typ: användare.Typ,
      cv: användare.cv ?? null,
      erfarenheter: användare.erfarenheter ?? null,
      kompetenser: användare.kompetenser ?? null,
      intressen: användare.intressen ?? null,
      profilBild: användare.profil_bild ?? null,
      totalTimmar,
    });
  } catch (fel) {
    console.error('Profilfel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PUT /api/users/profil — uppdaterar CV och profilinformation
router.put('/profil', kräverInloggning, async (req, res) => {
  const { cv, erfarenheter, kompetenser, intressen } = req.body;
  try {
    await uppdateraProfil(req.användare.id, {
      cv: cv?.trim() || null,
      erfarenheter: erfarenheter?.trim() || null,
      kompetenser: kompetenser?.trim() || null,
      intressen: intressen?.trim() || null,
    });
    res.json({ ok: true });
  } catch (fel) {
    console.error('Profiluppdatering fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/users/profil-bild — laddar upp profilbild till Supabase Storage
router.post('/profil-bild', kräverInloggning, async (req, res) => {
  const { bild } = req.body;
  if (!bild) return res.status(400).json({ fel: 'Bild saknas' });

  try {
    const base64 = bild.includes(',') ? bild.split(',')[1] : bild;
    const buffer = Buffer.from(base64, 'base64');
    const filNamn = `${req.användare.id}.jpg`;

    const { error: uploadFel } = await supabase.storage
      .from('profilbilder')
      .upload(filNamn, buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadFel) throw uploadFel;

    const { data: { publicUrl } } = supabase.storage.from('profilbilder').getPublicUrl(filNamn);

    await uppdateraProfilBild(req.användare.id, publicUrl);
    res.json({ url: publicUrl });
  } catch (fel) {
    console.error('Profilbild fel:', fel);
    res.status(500).json({ fel: 'Serverfel vid uppladdning' });
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
      body: JSON.stringify({ to: pushToken, title: 'Testnotifikation', body: 'Push-notifikationer fungerar!', sound: 'default' }),
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
