const express = require('express');
const { kräverInloggning } = require('../middleware/auth');
const { skickaMeddelande, hämtaMeddelanden } = require('../db/meddelanden');
const { hämtaAnvändareViaId, hämtaPushToken } = require('../db/användare');
const { skickaNotifikation: skickaRåNotifikation } = require('../utils/pushNotifikation');
const { sändRealtidsPing } = require('../realtid');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Hämtar ansökan och verifierar att användaren är sökande eller företag
async function hämtaOchVerifieraAnsökan(ansokningId, användarId) {
  const { data: ansökan, error } = await supabase
    .from('ansokningar')
    .select('sokande_id, jobb_id')
    .eq('id', ansokningId)
    .single();

  if (error || !ansökan) return null;

  const { data: jobb, error: jobbFel } = await supabase
    .from('Jobb')
    .select('Foretag_id')
    .eq('id', ansökan.jobb_id)
    .single();

  if (jobbFel || !jobb) return null;

  const harTillgång = användarId === ansökan.sokande_id || användarId === jobb.Foretag_id;
  if (!harTillgång) return null;
  return { sokande_id: ansökan.sokande_id, foretag_id: jobb.Foretag_id };
}

async function skickaNotifikation(mottagarId, avsändarNamn, text) {
  const token = await hämtaPushToken(mottagarId);
  const kortText = text.length > 100 ? text.substring(0, 97) + '...' : text;
  await skickaRåNotifikation(token, `Nytt meddelande från ${avsändarNamn}`, kortText);
}

// GET /api/meddelanden/:ansokningId — hämta konversation
router.get('/:ansokningId', kräverInloggning, async (req, res) => {
  const ansökan = await hämtaOchVerifieraAnsökan(req.params.ansokningId, req.användare.id);
  if (!ansökan) {
    return res.status(403).json({ fel: 'Åtkomst nekad eller ansökan hittades inte' });
  }

  try {
    const meddelanden = await hämtaMeddelanden(req.params.ansokningId);
    res.json(meddelanden);
  } catch (fel) {
    console.error('Fel vid hämtning av meddelanden:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av meddelanden' });
  }
});

// POST /api/meddelanden/:ansokningId — skicka meddelande
router.post('/:ansokningId', kräverInloggning, async (req, res) => {
  const { innehall } = req.body;

  if (!innehall || !innehall.trim()) {
    return res.status(400).json({ fel: 'Meddelandetext krävs' });
  }

  const ansökan = await hämtaOchVerifieraAnsökan(req.params.ansokningId, req.användare.id);
  if (!ansökan) {
    return res.status(403).json({ fel: 'Åtkomst nekad eller ansökan hittades inte' });
  }

  try {
    const meddelande = await skickaMeddelande({
      ansokan_id: req.params.ansokningId,
      avsandare_id: req.användare.id,
      innehall: innehall.trim(),
    });

    // Skicka push-notifikation till mottagaren i bakgrunden
    const mottagarId = req.användare.id === ansökan.sokande_id
      ? ansökan.foretag_id
      : ansökan.sokande_id;
    // Realtidssignal (utan innehåll) så mottagarens app uppdaterar chatt och badge direkt
    sändRealtidsPing(mottagarId, 'meddelande');
    hämtaAnvändareViaId(req.användare.id)
      .then((avsändare) => skickaNotifikation(mottagarId, avsändare?.Namn ?? 'Någon', innehall.trim()))
      .catch(console.error);

    res.status(201).json(meddelande);
  } catch (fel) {
    console.error('Fel vid skickande av meddelande:', fel);
    res.status(500).json({ fel: 'Serverfel vid skickande av meddelande' });
  }
});

module.exports = router;
