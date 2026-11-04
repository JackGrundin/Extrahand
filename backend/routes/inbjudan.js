// Inbjudningslänkar till jobb OCH scheman. Länken gör annonsen privat (döljs ur den
// öppna listan) och en person som registrerar sig VIA länken får rabatterat påslag.
//
// Samma tabell och token-mönster som den e-postbaserade schemainbjudan: bara SHA-256-
// hashen av token lagras (klartext bara i länken), precis som lösenordsåterställningen.
// GET /:token löser in länken (ingen auth krävs – ny användare är utloggad). Är anroparen
// inloggad stämplas inbjudan som inlöst och kopplas till kontot, och rabatten avgörs då.
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_HEMLIG_NYCKEL } = require('../utils/jwt');
const {
  hashaToken,
  skapaInbjudan,
  hämtaInbjudanViaTokenHash,
  markeraAccepterad,
} = require('../db/schemaInbjudan');
const { hämtaSchemaViaId, uppdateraSchema } = require('../db/scheman');
const { hämtaJobbViaId, sättJobbPrivat } = require('../db/jobb');
const { hämtaNamnFörAnvändare, skapaAnsökan, hämtaAnsökanFörJobbOchSökande, hämtaGodkändaFörJobb } = require('../db/ansokningar');
const { hämtaAnvändareViaId, hämtaAvtalGodkant, hämtaPushToken } = require('../db/användare');
const { godkännAnsökan } = require('../db/godkannande');
const { normaliseraKrav } = require('../utils/behorighet');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { sändRealtidsPing, sändJobblistaPing } = require('../realtid');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');

const router = express.Router();

const WEBB_BAS_URL = process.env.WEBB_BAS_URL || 'https://fastgig.se';

// Token saneras till hex innan den används som uppslagsnyckel – samma princip som
// återställningssidan, så inget oväntat kan nå databasen.
function rensaToken(token) {
  return String(token ?? '').replace(/[^a-f0-9]/gi, '').slice(0, 128);
}

// Inbjudningslänken fungerar både utloggad (ny användare på väg till registrering) och
// inloggad. Därför ingen kräverInloggning på GET – men om en giltig token finns i headern
// läser vi användaren själva för att kunna stämpla inbjudan som inlöst.
function läsAnvändareValfritt(req) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_HEMLIG_NYCKEL);
  } catch {
    return null;
  }
}

// Stämplar en inbjudan som inlöst och avgör rabatt. Rabatt ges bara till en PRIVATPERSON
// vars konto skapades VID/EFTER att inbjudan genererades – alltså någon som registrerade
// sig via länken. markeraAccepterad är idempotent (accepterad_at IS NULL), så den endpoint
// som vinner stämplar både inlösen och rabatt i samma skrivning – oavsett om det blir GET
// eller koppla. Ett misslyckat uppslag får inte fälla inlösen; då uteblir bara rabatten.
async function stämplaInlöst(inbjudan, användareId) {
  let rabattGodkand = false;
  try {
    const u = await hämtaAnvändareViaId(användareId);
    if (
      u?.Typ === 'privat' &&
      u?.created_at &&
      inbjudan.skapad_datum &&
      new Date(u.created_at).getTime() >= new Date(inbjudan.skapad_datum).getTime()
    ) {
      rabattGodkand = true;
    }
  } catch (fel) {
    console.error('Kunde inte avgöra inbjudningsrabatt:', fel);
  }
  await markeraAccepterad(inbjudan.id, användareId, { rabattGodkand });
}

// POST /api/inbjudan/jobb/:jobbId — företaget genererar en inbjudningslänk till ett
// enstaka pass och gör det samtidigt privat. Returnerar den delbara länken.
router.post('/jobb/:jobbId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const jobb = await hämtaJobbViaId(req.params.jobbId);
    if (!jobb || jobb.schema_id) return res.status(404).json({ fel: 'Jobbet hittades inte' });
    if ((jobb.Foretag_id ?? jobb.foretag_id) !== req.användare.id) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await skapaInbjudan({ jobb_id: jobb.id, foretag_id: req.användare.id, tokenHash: hashaToken(token) });
    await sättJobbPrivat(jobb.id, req.användare.id, true);

    res.json({ url: `${WEBB_BAS_URL}/inbjudan/${token}` });
  } catch (fel) {
    console.error('Fel vid generering av jobbinbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel vid generering av inbjudan' });
  }
});

// POST /api/inbjudan/schema/:schemaId — samma för ett schema. Gör schemat privat så att
// det försvinner ur den öppna schemalistan.
router.post('/schema/:schemaId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.schemaId);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await skapaInbjudan({ schema_id: schema.id, foretag_id: req.användare.id, tokenHash: hashaToken(token) });
    if (!schema.privat) await uppdateraSchema(schema.id, req.användare.id, { privat: true });

    res.json({ url: `${WEBB_BAS_URL}/inbjudan/${token}` });
  } catch (fel) {
    console.error('Fel vid generering av schemainbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel vid generering av inbjudan' });
  }
});

// PATCH /api/inbjudan/jobb/:jobbId/publicera — tackade den inbjudne nej kan företaget göra
// jobbet publikt igen. Enbart ägaren, enbart enstaka pass (sättJobbPrivat filtrerar).
router.patch('/jobb/:jobbId/publicera', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const jobb = await hämtaJobbViaId(req.params.jobbId);
    if (!jobb || jobb.schema_id) return res.status(404).json({ fel: 'Jobbet hittades inte' });
    if ((jobb.Foretag_id ?? jobb.foretag_id) !== req.användare.id) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    await sättJobbPrivat(jobb.id, req.användare.id, false);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid publicering av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/inbjudan/:token/koppla — anropas av webben efter registrering med den nya
// JWT:n. Kopplar kontot till inbjudan och stämplar in rabatten. Idempotent.
router.post('/:token/koppla', kräverInloggning, async (req, res) => {
  const tokenHash = hashaToken(rensaToken(req.params.token));
  try {
    const inbjudan = await hämtaInbjudanViaTokenHash(tokenHash);
    if (!inbjudan) return res.status(404).json({ fel: 'Inbjudan hittades inte' });

    await stämplaInlöst(inbjudan, req.användare.id);
    res.json({ ok: true, jobbId: inbjudan.jobb_id ?? null, schemaId: inbjudan.schema_id ?? null });
  } catch (fel) {
    console.error('Fel vid koppling av inbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/inbjudan/:token/acceptera — den inbjudne accepterar förfrågan med ETT klick:
// ansökan skapas OCH godkänns direkt (samma kärna som när företaget godkänner), med
// inbjudningsrabatten på påslaget. Till skillnad från vanlig ansökan finns INGEN
// avtalsspärr här – ett ogodkänt avtal stoppar inte tilldelningen, det styr bara
// meddelandet som visas. Svarar { ansokanId, avtalGodkant }.
router.post('/:token/acceptera', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  const tokenHash = hashaToken(rensaToken(req.params.token));
  try {
    const inbjudan = await hämtaInbjudanViaTokenHash(tokenHash);
    if (!inbjudan) return res.status(404).json({ fel: 'Inbjudan hittades inte' });

    // Token får bara lösas in av rätt person: okopplad (anvandare_id null) ELLER den som
    // redan är kopplad. Annars kan vem som helst med länken ta passet.
    if (inbjudan.anvandare_id != null && String(inbjudan.anvandare_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Den här inbjudan tillhör någon annan.' });
    }

    // Koppla kontot + stämpla ev. rabatt (idempotent) INNAN godkännandet, så att
    // hämtaRabattInbjudan i godkännandekärnan hittar rätt.
    await stämplaInlöst(inbjudan, req.användare.id);

    // Målannonsen: schema-inbjudan går mot schemats annons-jobb, jobb-inbjudan mot jobbet.
    let jobb;
    if (inbjudan.schema_id) {
      const schema = await hämtaSchemaViaId(inbjudan.schema_id);
      if (!schema?.annons_jobb_id) return res.status(404).json({ fel: 'Schemat hittades inte' });
      jobb = await hämtaJobbViaId(schema.annons_jobb_id);
    } else {
      jobb = await hämtaJobbViaId(inbjudan.jobb_id);
    }
    if (!jobb) return res.status(404).json({ fel: 'Jobbet hittades inte' });
    const företagId = jobb.Foretag_id ?? jobb.foretag_id;

    // Redan tillsatt? Är det den inloggade själv som redan är godkänd → returnera den
    // (idempotent, t.ex. dubbelklick). Är det någon annan → passet är taget.
    const godkända = await hämtaGodkändaFörJobb(jobb.id);
    const egen = godkända.find(g => String(g.sokande_id) === String(req.användare.id));
    if (egen) {
      const avtalGodkant = Boolean(await hämtaAvtalGodkant(req.användare.id));
      return res.json({ ansokanId: egen.id, avtalGodkant });
    }
    if (godkända.length > 0) {
      return res.status(409).json({ fel: 'Passet är redan tillsatt.' });
    }

    // Skapa ansökan (eller återanvänd en befintlig väntande). Behörighetskraven intygas
    // automatiskt med jobbets egen lista – företaget bjöd uttryckligen in personen.
    let ansökan = await hämtaAnsökanFörJobbOchSökande(jobb.id, req.användare.id);
    if (!ansökan) {
      ansökan = await skapaAnsökan({
        jobb_id: jobb.id,
        sokande_id: req.användare.id,
        meddelande: null,
        intygade_krav: normaliseraKrav(jobb.behorighets_krav),
      });
    }

    // Godkänn direkt – SAMMA kärna som företagets godkännande. företagId = jobbets ägare,
    // så påslag och månadsräknare landar hos företaget, aldrig hos den inbjudne.
    try {
      await godkännAnsökan({
        ansökan,
        jobb,
        företagId,
        godkändaFöre: [],
        ärSchemaAnnons: !!(jobb.schema_id && !jobb.schema_pass_id),
      });
    } catch (e) {
      if (e.kod === 'SCHEMA_UTAN_PASS') {
        return res.status(409).json({ fel: e.message, kod: 'SCHEMA_UTAN_PASS' });
      }
      throw e;
    }

    const avtalGodkant = Boolean(await hämtaAvtalGodkant(req.användare.id));
    res.json({ ansokanId: ansökan.id, avtalGodkant });

    // Signalera företaget (ny tillsättning) + den delade jobblistan (jobbet döljs).
    sändRealtidsPing(företagId, 'ansokan');
    sändJobblistaPing('jobb-tillsatt');
    try {
      const [sökande, pushToken] = await Promise.all([
        hämtaAnvändareViaId(req.användare.id),
        hämtaPushToken(företagId),
      ]);
      await skickaNotifikation(
        pushToken,
        'Förfrågan accepterad',
        `${sökande?.Namn ?? 'Personen'} har accepterat passet "${jobb?.Titel ?? ''}".`
      );
    } catch (notisfel) {
      console.error('Push-notifikation fel (acceptera):', notisfel);
    }
  } catch (fel) {
    console.error('Fel vid acceptering av inbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel vid acceptering av inbjudan' });
  }
});

// GET /api/inbjudan/:token — löser in en länk (jobb eller schema). Ingen auth krävs; är
// anroparen inloggad stämplas inbjudan som inlöst. Svaret låter webben skicka personen
// vidare till rätt vy (jobb eller schema).
router.get('/:token', async (req, res) => {
  const tokenHash = hashaToken(rensaToken(req.params.token));
  try {
    const inbjudan = await hämtaInbjudanViaTokenHash(tokenHash);
    if (!inbjudan) return res.status(404).json({ fel: 'Inbjudan hittades inte' });

    let jobbId = null;
    let schemaId = null;
    let titel = null;
    let foretagId = null;

    if (inbjudan.schema_id) {
      const schema = await hämtaSchemaViaId(inbjudan.schema_id);
      if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
      schemaId = schema.id;
      titel = schema.titel;
      foretagId = schema.foretag_id;
    } else {
      const jobb = await hämtaJobbViaId(inbjudan.jobb_id);
      if (!jobb) return res.status(404).json({ fel: 'Jobbet hittades inte' });
      jobbId = jobb.id;
      titel = jobb.Titel;
      foretagId = jobb.Foretag_id ?? jobb.foretag_id;
    }

    const redan_inlost = inbjudan.accepterad_at != null;

    const användare = läsAnvändareValfritt(req);
    if (användare?.id) {
      // Idempotent – skriver inte över en tidigare inlösen. Stämplar även rabatten, så en
      // nyregistrerad som landar här inloggad får rätt påslag även utan separat koppla.
      await stämplaInlöst(inbjudan, användare.id);
    }

    const företagNamn = (await hämtaNamnFörAnvändare([foretagId]))[foretagId] || null;
    // schemaId behålls i svaret för bakåtkompatibilitet med den tidigare schema-endpointen.
    res.json({ jobbId, schemaId, titel, företagNamn, redan_inlost });
  } catch (fel) {
    console.error('Fel vid uppslag av inbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
