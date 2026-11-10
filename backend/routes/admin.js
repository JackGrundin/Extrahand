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
} = require('../db/admin');
const { hämtaAllaPrivatpersoner, hämtaRaderadeKonton, sättBlockerad } = require('../db/användare');
const { hämtaFaktureringsunderlag } = require('../db/fakturering');

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
    res.json(await hämtaStatistik());
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

module.exports = router;
