const express = require('express');
const cors = require('cors');
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
const { startaPassPåminnelse } = require('./cron/passPaminnelse');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Hälsocheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', användareRoutes);
app.use('/api/jobb', jobbRoutes);
app.use('/api/ansokningar', ansokningarRoutes);
app.use('/api/meddelanden', meddelandenRoutes);
app.use('/api/betyg', betygRoutes);
app.use('/api/tidrapporter', tidrapporterRoutes);
app.use('/api/fakturering', faktureringRoutes);
app.use('/api/jobbforfragan', jobbforfraganRoutes);

process.on('uncaughtException', (err) => {
  console.error('Ohanterat undantag:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Ohanterat promise-avvisning:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
  startaPassPåminnelse();
});

server.on('error', (err) => console.error('HTTP-server fel:', err));

module.exports = app;
