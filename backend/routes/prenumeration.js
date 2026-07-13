const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { hämtaAnvändareViaEmail } = require('../db/användare');
const { räknaJobbDennaMånad } = require('../db/jobb');
const {
  hämtaPrenumeration,
  sättPrenumeration,
  ärPro,
  aktuelltAntalPass,
  prognosPåslag,
} = require('../db/prenumeration');
const { GRATIS_PASS_PER_MANAD } = require('../utils/pris');
const { stripe, API_BAS_URL } = require('../utils/stripe');

const router = express.Router();

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

// Sidan Stripe skickar tillbaka kunden till i webbläsaren när betalningen är klar
// eller kundportalen stängs. Appen hämtar färsk status när den får fokus igen.
const KLAR_URL = `${API_BAS_URL}/prenumeration/klar`;

// GET /api/prenumeration/status — företagets plan och kvarvarande gratispass
router.get('/status', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const [prenumeration, publicerade] = await Promise.all([
      hämtaPrenumeration(req.användare.id),
      räknaJobbDennaMånad(req.användare.id),
    ]);
    // passDennaManad = genomförda (godkända) pass och styr påslaget.
    // publiceradeDennaManad = publicerade jobb och styr popupen.
    const antalPass = aktuelltAntalPass(prenumeration);

    res.json({
      status: prenumeration?.prenumeration_status ?? 'gratis',
      pro: ärPro(prenumeration),
      passDennaManad: antalPass,
      publiceradeDennaManad: publicerade,
      gratisPassKvar: Math.max(0, GRATIS_PASS_PER_MANAD - antalPass),
      // Prognos, inte faktureringen: räknar även publicerade jobb som ännu inte tillsatts,
      // så prisrutan aldrig visar det lägre priset medan popupen varnar för det högre.
      paslag: prognosPåslag(prenumeration, publicerade),
      expiresAt: prenumeration?.prenumeration_expires_at ?? null,
    });
  } catch (fel) {
    console.error('Fel vid hämtning av prenumerationsstatus:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av prenumeration' });
  }
});

// Hämtar företagets Stripe-kund, eller skapar en om den inte finns än.
async function hämtaEllerSkapaKund(användarId, email) {
  const prenumeration = await hämtaPrenumeration(användarId);
  if (prenumeration?.stripe_customer_id) return prenumeration.stripe_customer_id;

  const företag = await hämtaAnvändareViaEmail(email);
  const kund = await stripe.customers.create({
    email,
    name: företag?.Namn ?? undefined,
    metadata: { anvandare_id: String(användarId) },
  });

  await sättPrenumeration(användarId, { stripeCustomerId: kund.id });
  return kund.id;
}

// POST /api/prenumeration/checkout — startar Stripe Checkout för Pro (299 kr/mån)
router.post('/checkout', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  if (!stripe || !STRIPE_PRICE_ID) {
    return res.status(500).json({ fel: 'Stripe är inte konfigurerat' });
  }

  try {
    const kundId = await hämtaEllerSkapaKund(req.användare.id, req.användare.email);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: kundId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      // Gör det möjligt för webhooken att koppla sessionen till rätt användare.
      client_reference_id: String(req.användare.id),
      subscription_data: { metadata: { anvandare_id: String(req.användare.id) } },
      success_url: `${KLAR_URL}?status=ok`,
      cancel_url: `${KLAR_URL}?status=avbruten`,
    });

    res.json({ url: session.url });
  } catch (fel) {
    console.error('Fel vid skapande av Checkout-session:', fel);
    res.status(500).json({ fel: 'Serverfel vid start av betalning' });
  }
});

// POST /api/prenumeration/portal — öppnar Stripes kundportal där företaget kan
// ändra eller avsluta sin prenumeration
router.post('/portal', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ fel: 'Stripe är inte konfigurerat' });
  }

  try {
    const prenumeration = await hämtaPrenumeration(req.användare.id);
    if (!prenumeration?.stripe_customer_id) {
      return res.status(400).json({ fel: 'Ni har ingen prenumeration att hantera' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: prenumeration.stripe_customer_id,
      return_url: `${KLAR_URL}?status=ok`,
    });

    res.json({ url: session.url });
  } catch (fel) {
    console.error('Fel vid öppning av kundportalen:', fel);
    res.status(500).json({ fel: 'Serverfel vid öppning av kundportalen' });
  }
});

module.exports = router;
