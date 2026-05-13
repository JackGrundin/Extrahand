const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaJobb, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, uppdateraJobb } = require('../db/jobb');

const router = express.Router();

// GET /api/jobb — publik, hämtar alla jobb
router.get('/', async (req, res) => {
  try {
    const jobb = await hämtaAllaJobb();
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av jobb' });
  }
});

// GET /api/jobb/mina — hämtar inloggat företags egna jobb
router.get('/mina', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const jobb = await hämtaJobbFörFöretag(req.användare.id);
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av egna jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av egna jobb' });
  }
});

// GET /api/jobb/:id — publik, hämtar ett specifikt jobb
router.get('/:id', async (req, res) => {
  try {
    const jobb = await hämtaJobbViaId(req.params.id);
    if (!jobb) {
      return res.status(404).json({ fel: 'Jobbet hittades inte' });
    }
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av jobb' });
  }
});

// POST /api/jobb — kräver inloggning som företag
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, lon, typ, kategori, antal_dagar, arbetstider } = req.body;

  if (!titel || !beskrivning || !typ) {
    return res.status(400).json({ fel: 'Fälten titel, beskrivning och typ krävs' });
  }

  const giltiga_typer = ['gig', 'sommarjobb', 'deltid', 'heltid', 'uppdrag'];
  if (!giltiga_typer.includes(typ)) {
    return res.status(400).json({ fel: 'Ogiltig typ' });
  }

  try {
    const jobb = await skapaJobb({
      titel,
      beskrivning,
      plats: plats || null,
      lon: lon || null,
      typ,
      kategori: kategori || null,
      antal_dagar: antal_dagar || null,
      arbetstider: arbetstider?.trim() || null,
      foretag_id: req.användare.id,
    });
    res.status(201).json(jobb);
  } catch (fel) {
    console.error('Fel vid skapande av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av jobb' });
  }
});

// PUT /api/jobb/:id — företag uppdaterar sitt jobb
router.put('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, lon, typ, kategori, antal_dagar, arbetstider } = req.body;

  if (!titel || !beskrivning || !typ) {
    return res.status(400).json({ fel: 'Fälten titel, beskrivning och typ krävs' });
  }

  try {
    const jobb = await uppdateraJobb(req.params.id, req.användare.id, {
      titel, beskrivning,
      plats: plats || null,
      lon: lon || null,
      typ,
      kategori: kategori || null,
      antal_dagar: antal_dagar || null,
      arbetstider: arbetstider?.trim() || null,
    });

    if (!jobb) {
      return res.status(404).json({ fel: 'Jobbet hittades inte eller tillhör inte ditt konto' });
    }

    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid uppdatering av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid uppdatering av jobb' });
  }
});

module.exports = router;
