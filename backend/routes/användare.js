const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { kräverInloggning } = require('../middleware/auth');
const { hämtaAnvändareViaEmail, hämtaAnvändareViaId, uppdateraProfil, uppdateraProfilBild, sparaPushToken, hämtaPushToken, hämtaAllaPrivatpersoner, godkännAvtal, hämtaAllaFöretag } = require('../db/användare');
const { hämtaTotalTimmar } = require('../db/ansokningar');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { hämtaJobbFörFöretag } = require('../db/jobb');

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
      beskrivning: användare.beskrivning ?? null,
      bransch: användare.bransch ?? null,
      stad: användare.stad ?? null,
      hemsida: användare.hemsida ?? null,
      totalTimmar,
      avtalGodkant: användare.avtal_godkant ?? false,
    });
  } catch (fel) {
    console.error('Profilfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av profil' });
  }
});

// GET /api/users/:id/profil — hämtar en annan användares publika profil
router.get('/:id/profil', kräverInloggning, async (req, res) => {
  try {
    const användare = await hämtaAnvändareViaId(req.params.id);

    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }

    const [totalTimmar, aktivaJobb] = await Promise.all([
      hämtaTotalTimmar(req.params.id),
      användare.Typ === 'företag' ? hämtaJobbFörFöretag(req.params.id, { endastAktiva: true }) : Promise.resolve([]),
    ]);

    res.json({
      id: användare.id,
      namn: användare.Namn,
      typ: användare.Typ,
      cv: användare.cv ?? null,
      erfarenheter: användare.erfarenheter ?? null,
      kompetenser: användare.kompetenser ?? null,
      intressen: användare.intressen ?? null,
      profilBild: användare.profil_bild ?? null,
      beskrivning: användare.beskrivning ?? null,
      bransch: användare.bransch ?? null,
      stad: användare.stad ?? null,
      hemsida: användare.hemsida ?? null,
      totalTimmar,
      aktivaJobb,
    });
  } catch (fel) {
    console.error('Profilfel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PUT /api/users/profil — uppdaterar CV och profilinformation
router.put('/profil', kräverInloggning, async (req, res) => {
  const { cv, erfarenheter, kompetenser, intressen, beskrivning, bransch, stad, hemsida } = req.body;
  try {
    await uppdateraProfil(req.användare.id, {
      cv: cv?.trim() || null,
      erfarenheter: erfarenheter?.trim() || null,
      kompetenser: kompetenser?.trim() || null,
      intressen: intressen?.trim() || null,
      beskrivning: beskrivning?.trim() || null,
      bransch: bransch?.trim() || null,
      stad: stad?.trim() || null,
      hemsida: hemsida?.trim() || null,
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
    await skickaNotifikation(pushToken, 'Testnotifikation', 'Push-notifikationer fungerar!');
    res.json({ ok: true });
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

const ADMIN_EMAIL = 'info@fastgig.se';

// GET /api/users/admin/privatpersoner — admin: lista alla privatpersoner
router.get('/admin/privatpersoner', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) return res.status(403).json({ fel: 'Åtkomst nekad' });
  try {
    const privatpersoner = await hämtaAllaPrivatpersoner();
    res.json(privatpersoner);
  } catch (fel) {
    console.error('Admin privatpersoner fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/users/admin/foretag — admin: lista alla företagskonton
router.get('/admin/foretag', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) return res.status(403).json({ fel: 'Åtkomst nekad' });
  try {
    const företag = await hämtaAllaFöretag();
    res.json(företag);
  } catch (fel) {
    console.error('Admin företag fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/users/admin/:id/avtal — admin: godkänn avtal för en privatperson
router.patch('/admin/:id/avtal', kräverInloggning, async (req, res) => {
  if (req.användare.email !== ADMIN_EMAIL) return res.status(403).json({ fel: 'Åtkomst nekad' });
  try {
    await godkännAvtal(req.params.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Avtalsgodkännande fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
