const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaJobb, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, uppdateraJobb, taBortJobb } = require('../db/jobb');
const { hämtaGodkändaFörJobb } = require('../db/ansokningar');
const { skickaMeddelande } = require('../db/meddelanden');
const { hämtaPushToken } = require('../db/användare');

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

// DELETE /api/jobb/:id — företag tar bort sitt jobb
router.delete('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const godkända = await hämtaGodkändaFörJobb(req.params.id);
    await taBortJobb(req.params.id, req.användare.id);
    res.json({ ok: true });

    // Meddela godkända privatpersoner att passet tagits bort
    for (const a of godkända) {
      try {
        await skickaMeddelande({
          ansokan_id: a.id,
          avsandare_id: req.användare.id,
          innehall: 'Passet har tagits bort av företaget.',
        });
        const pushToken = await hämtaPushToken(a.sokande_id);
        if (pushToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: pushToken,
              title: 'Pass inställt',
              body: 'Ett pass du var godkänd för har tagits bort av företaget.',
              sound: 'default',
            }),
          });
        }
      } catch (notisfel) {
        console.error('Notifikationsfel vid borttagning av jobb:', notisfel);
      }
    }
  } catch (fel) {
    console.error('Fel vid borttagning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid borttagning av jobb' });
  }
});

module.exports = router;
