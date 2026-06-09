const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { skapaAnvändare, hämtaAnvändareViaEmail, sparaVerifieringskod, markeraEmailVerifierad } = require('../db/användare');
const { skickaVerifieringsMail } = require('../utils/email');

const router = express.Router();
const JWT_HEMLIG_NYCKEL = process.env.JWT_SECRET || 'hemlig-nyckel-byt-i-produktion';

function genereraKod() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function skapaToken(användare) {
  return jwt.sign(
    { id: användare.id, email: användare.Email, typ: användare.Typ },
    JWT_HEMLIG_NYCKEL,
    { expiresIn: '7d' }
  );
}

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

    const användare = await skapaAnvändare({
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

    const kod = genereraKod();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sparaVerifieringskod(användare.id, kod, expiresAt);
    await skickaVerifieringsMail(email, kod);

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

    // email_verifierad = false → blockera (null = gammal användare, tillåt)
    if (användare.email_verifierad === false) {
      return res.status(403).json({
        fel: 'Verifiera din e-postadress först. Kolla din inkorg.',
        kod: 'EMAIL_EJ_VERIFIERAD',
      });
    }

    const token = skapaToken(användare);
    res.json({ token, användare: { id: användare.id, namn: användare.Namn, email: användare.Email, typ: användare.Typ, avtalGodkant: användare.avtal_godkant ?? false } });
  } catch (fel) {
    console.error('Inloggningsfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid inloggning' });
  }
});

// POST /api/auth/verifiera-kod
router.post('/verifiera-kod', async (req, res) => {
  const { email, kod } = req.body;
  if (!email || !kod) {
    return res.status(400).json({ fel: 'Email och kod krävs' });
  }

  try {
    const användare = await hämtaAnvändareViaEmail(email);
    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }

    if (användare.email_verifierad) {
      return res.status(400).json({ fel: 'E-postadressen är redan verifierad' });
    }

    if (!användare.verifieringskod || användare.verifieringskod !== kod) {
      return res.status(400).json({ fel: 'Felaktig verifieringskod' });
    }

    if (användare.kod_expires_at && new Date(användare.kod_expires_at) < new Date()) {
      return res.status(400).json({ fel: 'Verifieringskoden har gått ut. Begär en ny.' });
    }

    await markeraEmailVerifierad(användare.id);

    const token = skapaToken(användare);
    res.json({ token, användare: { id: användare.id, namn: användare.Namn, email: användare.Email, typ: användare.Typ, avtalGodkant: användare.avtal_godkant ?? false } });
  } catch (fel) {
    console.error('Verifieringsfel:', fel);
    res.status(500).json({ fel: 'Serverfel vid verifiering' });
  }
});

// POST /api/auth/skicka-verifieringsmail
router.post('/skicka-verifieringsmail', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ fel: 'Email krävs' });

  try {
    const användare = await hämtaAnvändareViaEmail(email);
    if (!användare) {
      return res.status(404).json({ fel: 'Användaren hittades inte' });
    }
    if (användare.email_verifierad) {
      return res.status(400).json({ fel: 'E-postadressen är redan verifierad' });
    }

    const kod = genereraKod();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sparaVerifieringskod(användare.id, kod, expiresAt);
    await skickaVerifieringsMail(email, kod);

    res.json({ ok: true });
  } catch (fel) {
    console.error('Resend-fel:', fel);
    res.status(500).json({ fel: 'Kunde inte skicka verifieringsmail' });
  }
});

module.exports = router;
