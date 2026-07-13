// Stripe-webhook: /webhooks/stripe
//
// VIKTIGT: den här handlern kräver den RÅA request-bodyn för att kunna verifiera
// Stripes signatur. Den monteras därför med express.raw() FÖRE app.use(express.json())
// i server.js – annars är bodyn redan parsad och signaturkontrollen misslyckas alltid.
//
// Handlarna är idempotenta: de sätter ett absolut tillstånd utifrån eventet i stället
// för att räkna upp något, så omsända events (vilket Stripe gör vid tveksamma svar)
// är ofarliga.

const { hämtaViaStripeCustomer, sättPrenumeration } = require('../db/prenumeration');
const { sändRealtidsPing } = require('../realtid');
const { stripe } = require('../utils/stripe');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Statusar där prenumerationen är betald och aktiv.
const AKTIVA_STATUSAR = ['active', 'trialing'];

// Periodens slut ligger på prenumerationen i äldre API-versioner och på dess items
// i nyare. Läs båda så att koden fungerar oavsett vilken version kontot använder.
function periodensSlut(prenumeration) {
  const epoch =
    prenumeration?.current_period_end ??
    prenumeration?.items?.data?.[0]?.current_period_end ??
    null;
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

// Slår upp vår användare utifrån Stripe-kunden. Faller tillbaka på metadata när
// kunden ännu inte hunnit sparas på användaren.
async function hittaAnvändarId(objekt) {
  const viaKund = objekt?.customer ? await hämtaViaStripeCustomer(objekt.customer) : null;
  if (viaKund) return viaKund.id;

  const frånMetadata = objekt?.metadata?.anvandare_id ?? objekt?.client_reference_id;
  return frånMetadata ? Number(frånMetadata) : null;
}

// Speglar en Stripe-prenumeration till vår databas.
async function synkaPrenumeration(prenumeration) {
  const användarId = await hittaAnvändarId(prenumeration);
  if (!användarId) {
    console.error('Stripe-webhook: hittade ingen användare för kund', prenumeration?.customer);
    return;
  }

  // En uppsagd prenumeration har kvar status 'active' fram till periodens slut
  // (cancel_at_period_end). Företaget har betalat för månaden och behåller därför
  // sina 20% hela vägen ut – 'gratis' sätts först när Stripe skickar deleted.
  const aktiv = AKTIVA_STATUSAR.includes(prenumeration.status);

  await sättPrenumeration(användarId, {
    status: aktiv ? 'pro' : 'gratis',
    expiresAt: periodensSlut(prenumeration),
    stripeCustomerId: prenumeration.customer ?? undefined,
  });

  // Signal till appen: profilsidan hämtar färsk status direkt, även medan
  // webbläsaren fortfarande är öppen.
  sändRealtidsPing(användarId, 'prenumeration');
}

async function stripeWebhook(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe-webhook anropad men Stripe är inte konfigurerat');
    return res.status(500).send('Stripe är inte konfigurerat');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (fel) {
    console.error('Ogiltig Stripe-signatur:', fel.message);
    return res.status(400).send(`Ogiltig signatur: ${fel.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const användarId = Number(session.client_reference_id ?? session.metadata?.anvandare_id);

        if (!användarId) {
          console.error('Stripe-webhook: checkout-session utan client_reference_id');
          break;
        }

        // Spara kopplingen till Stripe-kunden direkt, så att efterföljande
        // subscription-events hittar rätt användare.
        await sättPrenumeration(användarId, { stripeCustomerId: session.customer });

        // Hämta prenumerationen för att få korrekt status och periodslut.
        if (session.subscription) {
          const prenumeration = await stripe.subscriptions.retrieve(session.subscription);
          await synkaPrenumeration(prenumeration);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await synkaPrenumeration(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        // Stripe gör automatiska omförsök. Statusen faller i sinom tid ut via
        // customer.subscription.updated, så vi loggar bara här.
        console.warn('Stripe: betalning misslyckades för kund', event.data.object?.customer);
        break;
      }

      default:
        break;
    }
  } catch (fel) {
    // Logga men svara 200 – annars försöker Stripe om i timmar för ett fel som
    // sannolikt är vårt eget och inte löser sig av ett omförsök.
    console.error('Fel vid hantering av Stripe-event', event.type, fel);
  }

  res.json({ received: true });
}

module.exports = { stripeWebhook };
