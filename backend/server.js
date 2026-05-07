const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const användareRoutes = require('./routes/användare');
const jobbRoutes = require('./routes/jobb');
const ansokningarRoutes = require('./routes/ansokningar');
const meddelandenRoutes = require('./routes/meddelanden');
const betygRoutes = require('./routes/betyg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
});

module.exports = app;
