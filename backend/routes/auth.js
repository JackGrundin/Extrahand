const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { skapaAnvändare, hämtaAnvändareViaEmail } = require('../db/användare');

const router = express.Router();
const JWT_HEMLIG_NYCKEL = process.env.JWT_SECRET || 'hemlig-nyckel-byt-i-produktion';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Anon-klient för auth-operationer (signUp, resend)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  { realtime: { transport: ws } }
);

// POST /api/auth/registrera
router.post('/registrera', async (req, res) => {
  const { namn, email, lösenord, typ, beskrivning, bransch, stad, hemsida, telefonnummer, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson } = req.body;

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
    if (typ === 'företag') {
      const orgNrFormat = /^\d{6}-\d{4}$/;
      if (!organisationsnummer || !fakturaadress || !postnummer || !ort || !fakturamail || !referensperson) {
        return res.status(400).json({ fel: 'Alla obligatoriska fält för företag krävs' });
      }
      if (!orgNrFormat.test(organisationsnummer)) {
        return res.status(400).json({ fel: 'Organisationsnummer måste ha format XXXXXX-XXXX' });
      }
    }

    await skapaAnvändare({
      namn, email, lösenord: hashatLösenord, typ,
      beskrivning: beskrivning || null,
      bransch: bransch || null,
      stad: stad || null,
      hemsida: hemsida || null,
      telefonnummer: telefonnummer || null,
      organisationsnummer: organisationsnummer || null,
      fakturaadress: fakturaadress || null,
      postnummer: postnummer || null,
      ort: ort || null,
      fakturamail: fakturamail || null,
      referensperson: referensperson || null,
    });

    // Skicka verifieringsmail via Supabase Auth
    const { error: authFel } = await supabaseAnon.auth.signUp({
      email,
      password: lösenord,
      options: {
        emailRedirectTo: 'https://extrahand-production-4816.up.railway.app/api/auth/verifierad',
      },
    });
    if (authFel) {
      console.error('Supabase auth signUp-fel (icke-kritiskt):', authFel.message);
    }

    res.status(201).json({ väntarVerifiering: true });
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

    // Kolla e-postverifiering via Supabase Auth
    const { data: authData } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (authData?.user && !authData.user.email_confirmed_at) {
      return res.status(403).json({
        fel: 'Verifiera din e-postadress först. Kolla din inkorg.',
        kod: 'EMAIL_EJ_VERIFIERAD',
      });
    }

    const token = jwt.sign(
      { id: användare.id, email: användare.Email, typ: användare.Typ },
      JWT_HEMLIG_NYCKEL,
      { expiresIn: '7d' }
    );

    res.json({ token, användare: { id: användare.id, namn: användare.Namn, email: användare.Email, typ: användare.Typ, avtalGodkant: användare.avtal_godkant ?? false } });
  } catch (fel) {
    console.error('Inloggningsfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid inloggning' });
  }
});

// POST /api/auth/skicka-verifieringsmail
router.post('/skicka-verifieringsmail', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ fel: 'Email krävs' });

  const { error } = await supabaseAnon.auth.resend({ type: 'signup', email });
  if (error) {
    console.error('Resend-fel:', error.message);
    return res.status(500).json({ fel: 'Kunde inte skicka verifieringsmail' });
  }
  res.json({ ok: true });
});

// GET /api/auth/verifierad — visas i webbläsaren efter att användaren klickat länken
router.get('/verifierad', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>E-post verifierad – FastGig</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .kort { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 400px; text-align: center; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
    .ikon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #1a1a1a; font-size: 22px; margin: 0 0 12px; }
    p { color: #666; font-size: 16px; line-height: 1.5; margin: 0; }
    .märke { color: #2563eb; font-weight: 700; }
  </style>
</head>
<body>
  <div class="kort">
    <div class="ikon">✅</div>
    <h1>E-postadressen är verifierad!</h1>
    <p>Du kan nu logga in i <span class="märke">FastGig</span>-appen.</p>
  </div>
</body>
</html>`);
});

module.exports = router;
