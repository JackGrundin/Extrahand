const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, uppdateraStatus, hämtaAnsökanViaId, avvisaAllaUtomEn, återställAllaFörJobb, hämtaAllaKonversationerFörFöretag, ångraAnsökan } = require('../db/ansokningar');
const { hämtaPushToken, hämtaAnvändareViaId } = require('../db/användare');
const { hämtaJobbViaId } = require('../db/jobb');
const { skickaNotifikation } = require('../utils/pushNotifikation');

const router = express.Router();

// POST /api/ansokningar/:jobbId — privatperson söker ett jobb
router.post('/:jobbId', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  const { jobbId } = req.params;
  const { meddelande } = req.body;

  try {
    const dubblett = await finnsDubblettAnsökan(jobbId, req.användare.id);
    if (dubblett) {
      return res.status(409).json({ fel: 'Du har redan sökt detta jobb' });
    }

    const ansökan = await skapaAnsökan({
      jobb_id: jobbId,
      sokande_id: req.användare.id,
      meddelande: meddelande || null,
    });

    res.status(201).json(ansökan);

    try {
      const [jobb, sökande] = await Promise.all([
        hämtaJobbViaId(jobbId),
        hämtaAnvändareViaId(req.användare.id),
      ]);
      const foretagId = jobb?.Foretag_id ?? jobb?.foretag_id;
      const pushToken = await hämtaPushToken(foretagId);
      await skickaNotifikation(pushToken, 'Ny ansökan!', `${sökande?.Namn ?? 'Någon'} har sökt "${jobb?.Titel ?? 'ditt jobb'}"`)
    } catch (notisfel) {
      console.error('Push-notifikation fel:', notisfel);
    }
  } catch (fel) {
    console.error('Fel vid ansökan:', fel);
    res.status(500).json({ fel: 'Serverfel vid ansökan' });
  }
});

// GET /api/ansokningar/mina — privatperson ser sina egna ansökningar
router.get('/mina', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörSökande(req.användare.id);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

// GET /api/ansokningar/foretag — hämtar alla konversationer för inloggat företag
router.get('/foretag', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const konversationer = await hämtaAllaKonversationerFörFöretag(req.användare.id);
    res.json(konversationer);
  } catch (fel) {
    console.error('Fel vid hämtning av konversationer:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/ansokningar/jobb/:jobbId — företag ser ansökningar på sitt jobb
router.get('/jobb/:jobbId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörJobb(req.params.jobbId);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

// PATCH /api/ansokningar/:id/status — företag godkänner eller återkallar godkännande
router.patch('/:id/status', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { status } = req.body;
  if (!['godkänd', 'väntande'].includes(status)) {
    return res.status(400).json({ fel: 'Ogiltigt status' });
  }
  try {
    const ansökan = await hämtaAnsökanViaId(req.params.id);

    if (status === 'godkänd') {
      await uppdateraStatus(req.params.id, 'godkänd');
      await avvisaAllaUtomEn(ansökan.jobb_id, req.params.id);
    } else {
      await återställAllaFörJobb(ansökan.jobb_id);
    }

    res.json({ ok: true });

    if (status === 'godkänd') {
      try {
        const [pushToken, jobb] = await Promise.all([
          hämtaPushToken(ansökan.sokande_id),
          hämtaJobbViaId(ansökan.jobb_id),
        ]);
        const jobbTitel = jobb?.Titel ?? 'jobbet';
        await skickaNotifikation(pushToken, 'Grattis!', `Din ansökan till "${jobbTitel}" har godkänts!`);
      } catch (notisfel) {
        console.error('Push-notifikation fel:', notisfel);
      }
    }
  } catch (fel) {
    console.error('Status fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// DELETE /api/ansokningar/:id — privatperson ångrar en väntande ansökan
router.delete('/:id', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    await ångraAnsökan(req.params.id, req.användare.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid ångra ansökan:', fel);
    res.status(500).json({ fel: 'Serverfel vid ångra ansökan' });
  }
});


module.exports = router;
