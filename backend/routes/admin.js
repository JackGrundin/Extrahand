const express = require('express');
const router = express.Router();
const { kräverInloggning } = require('../middleware/auth');
const {
  hämtaStatistik,
  hämtaTidrapporterFörAdmin,
  hämtaFöretagMedStatistik,
  hämtaPrivatpersonerMedStatistik,
} = require('../db/admin');
const { hämtaAllaPrivatpersoner, hämtaRaderadeKonton } = require('../db/användare');
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
    res.json(await hämtaTidrapporterFörAdmin({ status: status || undefined }));
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
    res.json(await hämtaFaktureringsunderlag());
  } catch (fel) {
    console.error('Admin-fakturering fel:', fel);
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
