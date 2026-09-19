const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const användareRoutes = require('./routes/användare');
const jobbRoutes = require('./routes/jobb');
const ansokningarRoutes = require('./routes/ansokningar');
const meddelandenRoutes = require('./routes/meddelanden');
const betygRoutes = require('./routes/betyg');
const tidrapporterRoutes = require('./routes/tidrapporter');
const faktureringRoutes = require('./routes/fakturering');
const jobbforfraganRoutes = require('./routes/jobbforfragan');
const prenumerationRoutes = require('./routes/prenumeration');
const schemanRoutes = require('./routes/scheman');
const adressRoutes = require('./routes/adress');
const aterstallningSidaRoutes = require('./routes/aterstallningSida');
const { stripeWebhook } = require('./routes/stripeWebhook');
const { startaPassPåminnelse } = require('./cron/passPaminnelse');
const { startaNollställPass } = require('./cron/nollstallPass');
const { startaSchemaTidrapport } = require('./cron/schemaTidrapport');
const { startaSchemaPåminnelse } = require('./cron/schemaPaminnelse');

const app = express();
const PORT = process.env.PORT || 3000;

// Appen körs bakom Railways proxy. Utan detta ser express varje klients IP som
// proxyns IP, vilket gör att rate-limitern räknar alla användare som en enda.
app.set('trust proxy', 1);

// Säkerhetsheaders (HSTS, X-Content-Type-Options, frameguard m.m.). CSP är avstängd
// eftersom de HTML-sidor vi serverar (återställningssidan och /prenumeration/klar)
// använder inline-script och inline-style som helmets default-CSP annars blockerar.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS. API:t konsumeras främst av den nativa mobilappen (Bearer-token i header,
// inga cookies), som inte skickar någon Origin-header – därför tillåts anrop helt
// utan origin. Webb-origins begränsas till en allowlist i TILLÅTNA_ORIGINS. Saknas
// variabeln behålls det tidigare tillåtande beteendet så inget bryts vid deploy.
const tillåtnaOrigins = (process.env.TILLÅTNA_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Anrop utan origin (mobilapp, serveranrop, curl) släpps alltid igenom.
    if (!origin) return callback(null, true);
    // Ingen allowlist konfigurerad → tillåt allt (bakåtkompatibelt).
    if (tillåtnaOrigins.length === 0) return callback(null, true);
    if (tillåtnaOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin ej tillåten av CORS'));
  },
}));

// Stripe-webhooken måste läsa den RÅA bodyn för att kunna verifiera signaturen, och
// monteras därför före express.json(). Byter man ordning här slutar alla webhooks
// att verifieras och prenumerationsstatusen uppdateras aldrig.
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '5mb' }));

// Hälsocheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Sidan Stripe skickar tillbaka kunden till i webbläsaren efter Checkout eller
// kundportalen. Appen hämtar färsk status när den får fokus igen, så sidan behöver
// bara tala om att det är klart.
app.get('/prenumeration/klar', (req, res) => {
  const avbruten = req.query.status === 'avbruten';
  const rubrik = avbruten ? 'Betalningen avbröts' : 'Klart!';
  const text = avbruten
    ? 'Ingen prenumeration startades. Du kan stänga den här fliken och gå tillbaka till FastGig.'
    : 'Du kan stänga den här fliken och gå tillbaka till FastGig.';

  res.type('html').send(`<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FastGig</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             background: #f8fafc; color: #1a1a1a; padding: 24px; }
      .kort { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 380px; text-align: center;
              box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0; color: #64748b; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="kort">
      <h1>${rubrik}</h1>
      <p>${text}</p>
    </div>
  </body>
</html>`);
});

// Webbsidan som återställningslänken i mejlet öppnar. Ligger utanför /api eftersom
// den öppnas i en webbläsare, inte av appen.
app.use('/', aterstallningSidaRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', användareRoutes);
app.use('/api/jobb', jobbRoutes);
app.use('/api/ansokningar', ansokningarRoutes);
app.use('/api/meddelanden', meddelandenRoutes);
app.use('/api/betyg', betygRoutes);
app.use('/api/tidrapporter', tidrapporterRoutes);
app.use('/api/fakturering', faktureringRoutes);
app.use('/api/jobbforfragan', jobbforfraganRoutes);
app.use('/api/prenumeration', prenumerationRoutes);
app.use('/api/scheman', schemanRoutes);
app.use('/api/adress', adressRoutes);

process.on('uncaughtException', (err) => {
  console.error('Ohanterat undantag:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Ohanterat promise-avvisning:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
  startaPassPåminnelse();
  startaNollställPass();
  startaSchemaTidrapport();
  startaSchemaPåminnelse();
});

server.on('error', (err) => console.error('HTTP-server fel:', err));

module.exports = app;
