const express = require('express');
const { kräverInloggning } = require('../middleware/auth');
const { skapaBetyg, finnsDublettBetyg, hämtaBetyg } = require('../db/betyg');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Hämtar ansökan och tar reda på motpartens id
async function hämtaParterFörAnsökan(ansokningId) {
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

  return { sokande_id: ansökan.sokande_id, foretag_id: jobb.Foretag_id };
}

// POST /api/betyg/:ansokningId — sätt betyg på motparten
router.post('/:ansokningId', kräverInloggning, async (req, res) => {
  const { stjarnor, kommentar } = req.body;

  if (!stjarnor || !Number.isInteger(stjarnor) || stjarnor < 1 || stjarnor > 5) {
    return res.status(400).json({ fel: 'stjarnor måste vara ett heltal mellan 1 och 5' });
  }

  const parter = await hämtaParterFörAnsökan(req.params.ansokningId);
  if (!parter) {
    return res.status(404).json({ fel: 'Ansökan hittades inte' });
  }

  const { sokande_id, foretag_id } = parter;
  const anvandareId = req.användare.id;

  // Verifiera att användaren är en av de berörda parterna
  if (anvandareId !== sokande_id && anvandareId !== foretag_id) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }

  // Motparten är den andra i konversationen
  const till_anvandare_id = anvandareId === sokande_id ? foretag_id : sokande_id;

  try {
    const dubblett = await finnsDublettBetyg(req.params.ansokningId, anvandareId);
    if (dubblett) {
      return res.status(409).json({ fel: 'Du har redan betygsatt detta uppdrag' });
    }

    const betyg = await skapaBetyg({
      ansokan_id: req.params.ansokningId,
      av_anvandare_id: anvandareId,
      till_anvandare_id,
      stjarnor,
      kommentar: kommentar || null,
    });

    res.status(201).json(betyg);
  } catch (fel) {
    console.error('Fel vid betygsättning:', fel);
    res.status(500).json({ fel: 'Serverfel vid betygsättning' });
  }
});

// GET /api/betyg/anvandare/:anvandareId — hämta betyg för en användare
router.get('/anvandare/:anvandareId', async (req, res) => {
  try {
    const resultat = await hämtaBetyg(parseInt(req.params.anvandareId));
    res.json(resultat);
  } catch (fel) {
    console.error('Fel vid hämtning av betyg:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av betyg' });
  }
});

module.exports = router;
