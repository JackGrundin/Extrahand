const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { hämtaAnvändareViaId } = require('../db/användare');
const { skickaNyAvtalsansökanMail } = require('../utils/email');

const router = express.Router();

// POST /api/avtal/ansok-om-nytt
// En privatperson vars avtal återkallats (avtal_godkant = false) ber om en ny granskning.
// Notifieringen är enbart ett mejl till info@fastgig.se – ingen tabell, ingen status sparas.
// Svarar ALLTID { ok: true } så att ett mejlfel aldrig läcker ut till användaren.
router.post('/ansok-om-nytt', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    // E-posten bärs av JWT:n; namnet hämtas ur användarraden (hämtaAnvändareViaId ger Namn).
    const email = req.användare.email;
    let namn = '';
    try {
      const användare = await hämtaAnvändareViaId(req.användare.id);
      namn = användare?.Namn || '';
    } catch (hämtaFel) {
      console.error('Kunde inte hämta namn för avtalsansökan:', hämtaFel);
    }

    try {
      await skickaNyAvtalsansökanMail(namn, email);
    } catch (mejlFel) {
      console.error('Kunde inte skicka avtalsansökan-mejl:', mejlFel);
    }
  } catch (fel) {
    console.error('Fel vid ansök-om-nytt:', fel);
  }

  res.json({ ok: true });
});

module.exports = router;
