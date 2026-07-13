// Delad Stripe-klient. Nycklarna kommer från Railways miljövariabler.
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY saknas – prenumerationsflödet kommer att svara med fel.');
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Basadress som Stripe skickar tillbaka kunden till efter Checkout/kundportalen.
const API_BAS_URL = process.env.API_BAS_URL || 'https://api.fastgig.se';

module.exports = { stripe, API_BAS_URL };
