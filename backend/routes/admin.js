const express = require('express');
const router = express.Router();
const { kräverInloggning } = require('../middleware/auth');
const {
  hämtaStatistik,
  hämtaTidrapporterFörAdmin,
  hämtaFöretagMedStatistik,
  hämtaPrivatpersonerMedStatistik,
  hämtaFaktureringsstatistik,
  hämtaFaktureringPerFöretag,
  hämtaEskaleradeBestridanden,
} = require('../db/admin');
const {
  hämtaTidrapportViaId,
  uppdateraTidrapportStatus,
  skapaTidrapport,
  markeraEskaleringHanterad,
} = require('../db/tidrapporter');
const { hämtaAllaPrivatpersoner, hämtaRaderadeKonton, sättBlockerad, hämtaPushToken } = require('../db/användare');
const { hämtaFaktureringsunderlag } = require('../db/fakturering');
const { beräknaObBelopp, beräknaBelopp, påslagEller40 } = require('../utils/pris');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { sändRealtidsPing } = require('../realtid');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@fastgig.se';

// Admin-spärr. Samma mönster som de utspridda admin-endpointsen i routes/användare.js,
// men samlat i en middleware. 403 (inte 401): användaren ÄR inloggad men saknar behörighet.
function kräverAdmin(req, res, next) {
  if (req.användare?.email !== ADMIN_EMAIL) {
    return res.status(403).json({ fel: 'Åtkomst nekad' });
  }
  next();
}

// Plockar ut tidsfiltret (from/till) ur query-strängen. Backend är sista försvaret:
// bara rena YYYY-MM-DD-värden släpps igenom, allt annat behandlas som saknat.
function tidsfilter(req) {
  const giltigt = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return { from: giltigt(req.query.from), till: giltigt(req.query.till) };
}

// GET /api/admin/statistik — dashboard-siffror i ett anrop
router.get('/statistik', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaStatistik(tidsfilter(req)));
  } catch (fel) {
    console.error('Admin-statistik fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/tidrapporter?status= — alla tidrapporter, valfritt status-filter
router.get('/tidrapporter', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const { from, till } = tidsfilter(req);
    res.json(await hämtaTidrapporterFörAdmin({ status: status || undefined, from, till }));
  } catch (fel) {
    console.error('Admin-tidrapporter fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/avtal — alla privatpersoner med avtalsstatus
router.get('/avtal', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaAllaPrivatpersoner());
  } catch (fel) {
    console.error('Admin-avtal fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/foretag — alla företag med statistik (antal jobb, godkända pass, plan)
router.get('/foretag', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaFöretagMedStatistik());
  } catch (fel) {
    console.error('Admin-företag fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// PATCH /api/admin/foretag/:userId/blockera — blockera/avblockera ett företag
router.patch('/foretag/:userId/blockera', kräverInloggning, kräverAdmin, async (req, res) => {
  if (typeof req.body?.blockerad !== 'boolean') {
    return res.status(400).json({ fel: 'blockerad måste vara true eller false' });
  }
  try {
    const rad = await sättBlockerad(req.params.userId, req.body.blockerad);
    if (!rad) return res.status(404).json({ fel: 'Företaget hittades inte' });
    res.json({ ok: true });
  } catch (fel) {
    console.error('Admin-blockera fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/privatpersoner — alla privatpersoner med statistik (pass, betygssnitt)
router.get('/privatpersoner', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaPrivatpersonerMedStatistik());
  } catch (fel) {
    console.error('Admin-privatpersoner fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/fakturering — faktureringsunderlag (godkända, ej fakturerade)
router.get('/fakturering', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaFaktureringsunderlag(tidsfilter(req)));
  } catch (fel) {
    console.error('Admin-fakturering fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/faktureringsstatistik — månadens fakturering grupperad per påslag
router.get('/faktureringsstatistik', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaFaktureringsstatistik(tidsfilter(req)));
  } catch (fel) {
    console.error('Admin-faktureringsstatistik fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/fakturering-per-foretag — månadens fakturering summerad per företag
router.get('/fakturering-per-foretag', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaFaktureringPerFöretag(tidsfilter(req)));
  } catch (fel) {
    console.error('Admin-fakturering-per-företag fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/raderade — inaktiva (raderade) konton
router.get('/raderade', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaRaderadeKonton());
  } catch (fel) {
    console.error('Admin-raderade fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/admin/bestridanden — eskalerade, ännu ohanterade bestridanden (punkt 17)
router.get('/bestridanden', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    res.json(await hämtaEskaleradeBestridanden());
  } catch (fel) {
    console.error('Admin-bestridanden fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/admin/bestridanden/:id/godkann — admin godkänner företagets ursprungliga rapport.
// Rapporten blir 'godkänd' (utbetalbar) och faller ur bestridande-listan via statusfiltret.
router.post('/bestridanden/:id/godkann', kräverInloggning, kräverAdmin, async (req, res) => {
  try {
    const rapport = await hämtaTidrapportViaId(req.params.id);
    if (!rapport) return res.status(404).json({ fel: 'Tidrapport hittades inte' });
    if (rapport.status !== 'bestridd') {
      return res.status(409).json({ fel: 'Tidrapporten är inte bestridd' });
    }

    await uppdateraTidrapportStatus(req.params.id, 'godkänd');
    res.json({ ok: true });

    // Meddela båda parter att ärendet är avgjort.
    (async () => {
      const [personToken, företagToken] = await Promise.all([
        hämtaPushToken(rapport.anvandare_id),
        hämtaPushToken(rapport.foretag_id),
      ]);
      await Promise.all([
        skickaNotifikation(personToken, 'Bestridande avgjort', 'FastGig har godkänt den ursprungliga tidrapporten.'),
        skickaNotifikation(företagToken, 'Bestridande avgjort', 'FastGig har godkänt din tidrapport.'),
      ]);
    })().catch(console.error);
    if (rapport.foretag_id) sändRealtidsPing(rapport.foretag_id, 'tidrapport');
    if (rapport.anvandare_id) sändRealtidsPing(rapport.anvandare_id, 'tidrapport');
  } catch (fel) {
    console.error('Admin-godkänn-bestridande fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/admin/bestridanden/:id/korrigera — admin skriver in korrekta timmar och skickar
// en korrigerad tidrapport via SAMMA flöde som POST /api/tidrapporter: en ny rad för samma
// ansökan som dyker upp i chatten och som privatpersonen godkänner/bestrider som vanligt.
router.post('/bestridanden/:id/korrigera', kräverInloggning, kräverAdmin, async (req, res) => {
  const timmar = Number(req.body?.timmar);
  if (!timmar || timmar <= 0) {
    return res.status(400).json({ fel: 'timmar krävs och måste vara större än 0' });
  }

  try {
    const R = await hämtaTidrapportViaId(req.params.id);
    if (!R) return res.status(404).json({ fel: 'Tidrapport hittades inte' });
    if (R.status !== 'bestridd') {
      return res.status(409).json({ fel: 'Tidrapporten är inte bestridd' });
    }

    // Återanvänd de FRYSTA värdena från den bestridda rapporten (timlön, OB, påslag, datum)
    // i stället för att läsa jobbet på nytt. Avdraget kopieras så personen aldrig dras två
    // gånger för samma dag – samma regel som POST /api/tidrapporter.
    const ob_belopp = beräknaObBelopp(Array.isArray(R.ob_tillagg) ? R.ob_tillagg : [], R.timlon);
    const avdrag = Array.isArray(R.avdrag) ? R.avdrag : [];
    const avdrag_belopp = Number(R.avdrag_belopp) || 0;
    const belopp = beräknaBelopp({ timmar, timlon: R.timlon, obBelopp: ob_belopp, avdragBelopp: avdrag_belopp });

    // skapaTidrapport tillåter detta eftersom R är 'bestridd' (den blockerar bara aktiva rapporter).
    const rapport = await skapaTidrapport({
      ansokan_id: R.ansokan_id,
      foretag_id: R.foretag_id,
      anvandare_id: R.anvandare_id,
      datum: R.datum,
      timmar,
      timlon: R.timlon,
      ob_belopp,
      ob_tillagg: Array.isArray(R.ob_tillagg) ? R.ob_tillagg : [],
      totalt_belopp: belopp.brutto,
      avdrag,
      avdrag_belopp: belopp.avdrag,
      paslag: påslagEller40(R.paslag),
    });

    // Den ursprungliga bestridda raden markeras som hanterad så den lämnar listan.
    await markeraEskaleringHanterad(R.id);

    res.status(201).json(rapport);

    // Realtid + push till privatpersonen – exakt som POST, så korrigeringen syns i chatten.
    sändRealtidsPing(R.anvandare_id, 'tidrapport');
    (async () => {
      const token = await hämtaPushToken(R.anvandare_id);
      await skickaNotifikation(token, 'Ny tidrapport', 'Du har fått en tidrapport att granska.');
    })().catch(console.error);
  } catch (fel) {
    if (fel.kod === 409) return res.status(409).json({ fel: fel.message });
    console.error('Admin-korrigera-bestridande fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
