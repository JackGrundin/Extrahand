const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const användareRoutes = require('./routes/användare');
const jobbRoutes = require('./routes/jobb');

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

app.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
});

module.exports = app;
