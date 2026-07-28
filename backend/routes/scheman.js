const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const {
  skapaSchema,
  sättAnnonsJobb,
  hämtaSchemaViaId,
  hämtaÖppnaScheman,
  hämtaSchemanFörFöretag,
  uppdateraSchema,
  skapaSchemaPass,
  hämtaPassFörSchema,
  hämtaSchemaPassFörAnvändare,
  hämtaKalenderPass,
} = require('../db/scheman');
const { tilldelaSchema, frigörFramtidaPass, återställSchema } = require('../db/schemaTilldelning');
const { skapaJobb, räknaJobbDennaMånad, sättJobbPåslag, hämtaJobbFörFöretag } = require('../db/jobb');
const { hämtaAnsökningarFörJobb, uppdateraStatus, hämtaGodkändaFörFleraJobb, hämtaNamnFörAnvändare } = require('../db/ansokningar');
const { hämtaPrenumeration, ärPro, harGjortPlanval, sättPlanvalGjort, minskaPassDennaManad } = require('../db/prenumeration');
const { hämtaPrivatpersonerIStad, hämtaPushToken, hämtaAnvändareViaId } = require('../db/användare');
const { GRATIS_PASS_PER_MANAD } = require('../utils/pris');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { idagStockholm, parsaArbetstider } = require('../utils/tid');
const { sändJobblistaPing, sändRealtidsPing } = require('../realtid');

const router = express.Router();

const GILTIGA_TYPER = ['gig', 'sommarjobb', 'deltid', 'heltid', 'uppdrag'];
const DATUM_MÖNSTER = /^\d{4}-\d{2}-\d{2}$/;
const TID_MÖNSTER = /^\d{2}:\d{2}$/;

// Validerar ett inkommande schema. Returnerar felmeddelande (sträng) eller null.
// Samma roll som valideraJobbInput i routes/jobb.js: servern är sista försvaret, för en
// tom timlön ger tidrapporter på 0 kr och ett schema utan pass är meningslöst.
function valideraSchemaInput({ titel, beskrivning, typ, plats, adress, kategori, timlon, startdatum, slutdatum, pass }) {
  if (!titel || !String(titel).trim()) return 'Titel krävs';
  if (!beskrivning || !String(beskrivning).trim()) return 'Beskrivning krävs';
  if (typ && !GILTIGA_TYPER.includes(typ)) return 'Ogiltig typ';
  if (!plats || !String(plats).trim()) return 'Stad krävs';
  if (!adress || !String(adress).trim()) return 'Adress till arbetsplatsen krävs';
  if (!kategori || !String(kategori).trim()) return 'Kategori krävs';
  if (timlon == null || !(Number(timlon) > 0)) return 'Giltig timlön krävs';

  if (!DATUM_MÖNSTER.test(startdatum || '')) return 'Startdatum krävs';
  if (!DATUM_MÖNSTER.test(slutdatum || '')) return 'Slutdatum krävs';
  if (slutdatum < startdatum) return 'Slutdatum kan inte vara före startdatum';

  if (!Array.isArray(pass) || !pass.length) return 'Schemat måste innehålla minst ett pass';

  const sedda = new Set();
  for (const p of pass) {
    if (!DATUM_MÖNSTER.test(p?.datum || '')) return 'Varje pass måste ha ett datum';
    if (!TID_MÖNSTER.test(p?.starttid || '') || !TID_MÖNSTER.test(p?.sluttid || '')) {
      return 'Varje pass måste ha start- och sluttid';
    }
    if (p.datum < startdatum || p.datum > slutdatum) {
      return 'Alla pass måste ligga inom perioden';
    }
    // Ett datum två gånger skulle ge två tidrapporter samma dag och dubbel fakturering.
    const nyckel = `${p.datum} ${p.starttid}`;
    if (sedda.has(nyckel)) return 'Samma pass förekommer flera gånger';
    sedda.add(nyckel);
  }
  return null;
}

// POST /api/scheman — företag publicerar ett schema
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const {
    titel, beskrivning, plats, adress, kategori, typ,
    startdatum, slutdatum, timlon, ob_tillagg, pass, acceptera_hogre_paslag,
  } = req.body;

  const valideringsfel = valideraSchemaInput({
    titel, beskrivning, typ, plats, adress, kategori, timlon, startdatum, slutdatum, pass,
  });
  if (valideringsfel) return res.status(400).json({ fel: valideringsfel });

  try {
    // Samma planvals-gate som vid vanlig publicering. Ett schema räknas som EN
    // publicering: annons-jobbet nedan är en Jobb-rad, medan passjobben filtreras bort
    // i räknaJobbDennaMånad (se db/jobb.js).
    const prenumeration = await hämtaPrenumeration(req.användare.id);
    if (!ärPro(prenumeration) && !acceptera_hogre_paslag && !harGjortPlanval(prenumeration)) {
      const publicerade = await räknaJobbDennaMånad(req.användare.id);
      if (publicerade >= GRATIS_PASS_PER_MANAD) {
        return res.status(409).json({
          fel: 'Ni har redan publicerat två pass denna månad',
          kod: 'KRAVER_PLANVAL',
        });
      }
    }

    const sorteradePass = [...pass].sort((a, b) =>
      a.datum === b.datum ? a.starttid.localeCompare(b.starttid) : a.datum.localeCompare(b.datum)
    );

    const schema = await skapaSchema({
      foretag_id: req.användare.id,
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim(),
      adress: adress.trim(),
      kategori: kategori.trim(),
      typ: typ || 'sommarjobb',
      startdatum,
      slutdatum,
      timlon: Number(timlon),
      ob_tillagg: Array.isArray(ob_tillagg) ? ob_tillagg : [],
    });

    // Annons-jobbet. Det bär schemats ansökningar och därmed chatten, och det är här
    // påslaget fryses när en person godkänns. arbetstider innehåller ALLA pass, så
    // annons-ansökan blir det samlade schemakortet i privatpersonens Mina pass.
    // Påslaget sätts inte nu – det fryses vid godkännandet, precis som för vanliga jobb.
    const annonsJobb = await skapaJobb({
      titel: schema.titel,
      beskrivning: schema.beskrivning,
      plats: schema.plats,
      adress: schema.adress,
      lon: schema.timlon,
      typ: schema.typ,
      kategori: schema.kategori,
      antal_dagar: sorteradePass.length,
      arbetstider: JSON.stringify(
        sorteradePass.map(p => ({ datum: p.datum, start: p.starttid, slut: p.sluttid }))
      ),
      ob_tillagg: schema.ob_tillagg,
      foretag_id: req.användare.id,
      schema_id: schema.id,
    });

    await sättAnnonsJobb(schema.id, annonsJobb.id);

    await skapaSchemaPass(sorteradePass.map(p => ({
      schema_id: schema.id,
      datum: p.datum,
      starttid: p.starttid,
      sluttid: p.sluttid,
    })));

    if (acceptera_hogre_paslag && !ärPro(prenumeration) && !harGjortPlanval(prenumeration)) {
      await sättPlanvalGjort(req.användare.id);
    }

    res.status(201).json({ ...schema, annons_jobb_id: annonsJobb.id, antalPass: sorteradePass.length });

    sändJobblistaPing('schema-ny');

    notifieraPrivatpersonerIStad(schema).catch(notisfel =>
      console.error('Notisfel vid nytt schema:', notisfel)
    );
  } catch (fel) {
    console.error('Fel vid skapande av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av schema' });
  }
});

// Push till privatpersoner i schemats stad, samma mönster som routes/jobb.js
async function notifieraPrivatpersonerIStad(schema) {
  if (!schema?.plats) return;
  const mottagare = await hämtaPrivatpersonerIStad(schema.plats);
  for (const person of mottagare) {
    await skickaNotifikation(
      person.push_token,
      'Nytt längre uppdrag nära dig',
      `${schema.titel} i ${schema.plats}`
    );
  }
}

// GET /api/scheman — öppna scheman att söka
router.get('/', kräverInloggning, async (req, res) => {
  try {
    const scheman = await hämtaÖppnaScheman(idagStockholm());
    res.json(scheman);
  } catch (fel) {
    console.error('Fel vid hämtning av scheman:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av scheman' });
  }
});

// GET /api/scheman/mina — företagets egna scheman
router.get('/mina', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const scheman = await hämtaSchemanFörFöretag(req.användare.id);
    res.json(scheman);
  } catch (fel) {
    console.error('Fel vid hämtning av egna scheman:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av egna scheman' });
  }
});

// GET /api/scheman/mina-pass — privatpersonens kommande schemapass
router.get('/mina-pass', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const pass = await hämtaSchemaPassFörAnvändare(req.användare.id, idagStockholm());
    res.json(pass);
  } catch (fel) {
    console.error('Fel vid hämtning av schemapass:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av schemapass' });
  }
});

// GET /api/scheman/kalender?from&till — bemanningen per datum för kalendervyn.
// Unionerar schemapass OCH företagets godkända enstaka pass. Utan det senare skulle
// företaget bara se halva sin bemanning i kalendern.
router.get('/kalender', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { from, till } = req.query;
  if (!DATUM_MÖNSTER.test(from || '') || !DATUM_MÖNSTER.test(till || '')) {
    return res.status(400).json({ fel: 'Ange from och till som YYYY-MM-DD' });
  }

  try {
    const [schemaPass, enstakaPass] = await Promise.all([
      hämtaKalenderPass(req.användare.id, from, till),
      hämtaEnstakaPassFörKalender(req.användare.id, from, till),
    ]);

    const alla = [...schemaPass, ...enstakaPass].sort((a, b) =>
      a.datum === b.datum ? (a.starttid ?? '').localeCompare(b.starttid ?? '') : a.datum.localeCompare(b.datum)
    );
    res.json(alla);
  } catch (fel) {
    console.error('Fel vid hämtning av kalender:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av kalender' });
  }
});

// Företagets godkända enstaka pass i intervallet, plockade ur jobbens arbetstider.
// Schemajobb hoppas över – de kommer via hämtaKalenderPass i stället, med rätt status.
async function hämtaEnstakaPassFörKalender(foretag_id, från, till) {
  const jobb = await hämtaJobbFörFöretag(foretag_id);
  if (!jobb.length) return [];

  const godkända = await hämtaGodkändaFörFleraJobb(jobb.map(j => j.id));
  if (!godkända.length) return [];

  const namn = await hämtaNamnFörAnvändare(godkända.map(a => a.sokande_id));
  const personPerJobb = Object.fromEntries(godkända.map(a => [a.jobb_id, a]));

  const rader = [];
  for (const j of jobb) {
    const person = personPerJobb[j.id];
    if (!person) continue;
    for (const dag of parsaArbetstider(j.arbetstider)) {
      if (!dag?.datum || dag.datum < från || dag.datum > till) continue;
      rader.push({
        datum: dag.datum,
        starttid: dag.start ?? null,
        sluttid: dag.slut ?? null,
        personId: person.sokande_id,
        personNamn: namn[person.sokande_id] ?? null,
        titel: j.Titel ?? null,
        typ: 'pass',
        status: 'planerad',
      });
    }
  }
  return rader;
}

// GET /api/scheman/:id — schema med pass. Ägaren får dessutom sökandelistan.
router.get('/:id', kräverInloggning, async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });

    const pass = await hämtaPassFörSchema(schema.id);
    const ärÄgare = String(schema.foretag_id) === String(req.användare.id);

    const svar = { ...schema, pass, antalPass: pass.length };

    if (ärÄgare && schema.annons_jobb_id) {
      svar.ansokningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
    }

    res.json(svar);
  } catch (fel) {
    console.error('Fel vid hämtning av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av schema' });
  }
});

// PATCH /api/scheman/:id/ersatt — företag byter person för schemats framtida pass.
// Den nya personen måste redan ha sökt schemat. Genomförda pass behåller den gamla
// personen, och påslaget är redan fryst så ingen ny debitering sker.
router.patch('/:id/ersatt', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { ny_anvandare_id } = req.body;
  if (ny_anvandare_id == null) return res.status(400).json({ fel: 'Ny person krävs' });

  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (!schema.annons_jobb_id) return res.status(400).json({ fel: 'Schemat saknar annons' });

    const ansökningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
    const nyAnsökan = ansökningar.find(a => String(a.sokande_id) === String(ny_anvandare_id));
    if (!nyAnsökan) {
      return res.status(400).json({ fel: 'Personen har inte sökt det här schemat' });
    }

    const tidigare = ansökningar.filter(a => a.status === 'godkänd' && a.id !== nyAnsökan.id);

    // Frigör den förra personens framtida pass innan den nya tilldelas, annars skulle
    // passen redan ha en godkänd ansökan och hoppas över av tilldelaSchema.
    await frigörFramtidaPass(schema.id);
    for (const a of tidigare) await uppdateraStatus(a.id, 'avvisad');
    await uppdateraStatus(nyAnsökan.id, 'godkänd');

    // Samma frysta påslag som tidigare – ett personbyte får inte ändra ett avtalat pris.
    await tilldelaSchema(schema.id, nyAnsökan.sokande_id, schema.paslag);

    res.json({ ok: true });

    for (const a of tidigare) sändRealtidsPing(a.sokande_id, 'pass-status');
    sändRealtidsPing(nyAnsökan.sokande_id, 'pass-status');

    (async () => {
      const token = await hämtaPushToken(nyAnsökan.sokande_id);
      await skickaNotifikation(token, 'Grattis!', `Du är godkänd för schemat "${schema.titel}"!`);
    })().catch(console.error);
  } catch (fel) {
    console.error('Fel vid byte av person i schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid byte av person' });
  }
});

// POST /api/scheman/:id/hoppa-av — privatpersonen lämnar schemat
router.post('/:id/hoppa-av', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.anvandare_id ?? '') !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Du är inte tilldelad det här schemat' });
    }

    // Frigör framtida pass och gör schemat sökbart igen. Genomförda pass och deras
    // tidrapporter rörs inte – arbetet är utfört och ska betalas.
    const { harGenomfört } = await återställSchema(schema.id);

    // Har inget pass genomförts blev schemat aldrig av och ska inte förbruka ett
    // gratispass. Samma regel som när företaget tar tillbaka ett godkännande.
    if (!harGenomfört) {
      await minskaPassDennaManad(schema.foretag_id);
      if (schema.annons_jobb_id) await sättJobbPåslag(schema.annons_jobb_id, null);
    }

    // Annons-ansökan sätts tillbaka till väntande så att företaget kan välja en ny person.
    if (schema.annons_jobb_id) {
      const ansökningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
      for (const a of ansökningar) {
        if (String(a.sokande_id) === String(req.användare.id)) await uppdateraStatus(a.id, 'avvisad');
        else if (a.status === 'avvisad') await uppdateraStatus(a.id, 'väntande');
      }
    }

    res.json({ ok: true });

    sändRealtidsPing(schema.foretag_id, 'ansokan');
    sändJobblistaPing('schema-ledigt');

    (async () => {
      const [person, token] = await Promise.all([
        hämtaAnvändareViaId(req.användare.id),
        hämtaPushToken(schema.foretag_id),
      ]);
      await skickaNotifikation(
        token,
        'Någon har hoppat av',
        `${person?.Namn ?? 'Personen'} har hoppat av "${schema.titel}". Framtida pass är lediga igen.`
      );
    })().catch(console.error);
  } catch (fel) {
    console.error('Fel vid avhopp från schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid avhopp' });
  }
});

// POST /api/scheman/:id/avbryt — företaget ställer in schemat
router.post('/:id/avbryt', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    // ställInPass: framtida pass markeras 'installt' i stället för att bli sökbara igen.
    const { harGenomfört } = await återställSchema(schema.id, { ställInPass: true });

    if (!harGenomfört) {
      const godkända = schema.anvandare_id != null;
      if (godkända) {
        await minskaPassDennaManad(schema.foretag_id);
        if (schema.annons_jobb_id) await sättJobbPåslag(schema.annons_jobb_id, null);
      }
    }

    res.json({ ok: true });

    sändJobblistaPing('schema-borttagen');

    if (schema.anvandare_id != null) {
      sändRealtidsPing(schema.anvandare_id, 'pass-status');
      (async () => {
        const token = await hämtaPushToken(schema.anvandare_id);
        await skickaNotifikation(token, 'Schema inställt', `"${schema.titel}" har ställts in av företaget.`);
      })().catch(console.error);
    }
  } catch (fel) {
    console.error('Fel vid avbrytande av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid avbrytande av schema' });
  }
});

// PUT /api/scheman/:id — företag redigerar ett ännu inte tillsatt schema
router.put('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, adress, kategori, timlon } = req.body;
  if (!titel || !String(titel).trim()) return res.status(400).json({ fel: 'Titel krävs' });
  if (timlon != null && !(Number(timlon) > 0)) return res.status(400).json({ fel: 'Giltig timlön krävs' });

  try {
    const schema = await uppdateraSchema(req.params.id, req.användare.id, {
      titel: titel.trim(),
      beskrivning: beskrivning?.trim() ?? null,
      plats: plats?.trim() ?? null,
      adress: adress?.trim() ?? null,
      kategori: kategori?.trim() ?? null,
      ...(timlon != null ? { timlon: Number(timlon) } : {}),
    });
    res.json(schema);
  } catch (fel) {
    console.error('Fel vid uppdatering av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid uppdatering av schema' });
  }
});

module.exports = router;
