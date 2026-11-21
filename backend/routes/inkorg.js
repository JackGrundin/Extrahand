const express = require('express');
const router = express.Router();
const { kräverInloggning } = require('../middleware/auth');
const { hämtaInkorg } = require('../db/inkorg');

// GET /api/inkorg — härledd åtgärdslista för den inloggade (ingen egen tabell).
// Posterna försvinner automatiskt när åtgärden utförts eftersom listan räknas fram
// på nytt vid varje anrop.
router.get('/', kräverInloggning, async (req, res) => {
  try {
    const poster = await hämtaInkorg(req.användare);
    res.json({ poster });
  } catch (fel) {
    console.error('Fel vid hämtning av inkorg:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av inkorg' });
  }
});

module.exports = router;
