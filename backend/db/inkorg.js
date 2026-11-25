const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { hämtaIBitar } = require('./ansokningar');
const { hämtaObetygsatta } = require('./betyg');
const { hämtaAvtalGodkant } = require('./användare');
const { hämtaMinaInbjudningar } = require('./schemaInbjudan');
const { hämtaVäntandeFörAnvändare } = require('./jobbforfragan');
const { idagStockholm, parsaArbetstider } = require('../utils/tid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Slår upp jobbtitel per ansökan. Används för tidrapport-/bestridandeposter som bara
// känner till ansokan_id. Returnerar en map ansokan_id → { titel, jobbId, schemaId }.
async function titlarPerAnsökan(ansokanIds) {
  const unika = [...new Set(ansokanIds.filter(Boolean))];
  if (!unika.length) return {};

  const ansökningar = await hämtaIBitar(unika, bit =>
    supabase.from('ansokningar').select('id, jobb_id').in('id', bit));
  const jobb = await hämtaIBitar(ansökningar.map(a => a.jobb_id), bit =>
    supabase.from('Jobb').select('id, Titel, schema_id').in('id', bit));
  const jobbMap = Object.fromEntries(jobb.map(j => [j.id, j]));

  const map = {};
  for (const a of ansökningar) {
    const j = jobbMap[a.jobb_id];
    map[a.id] = {
      titel: j?.Titel ?? null,
      jobbId: a.jobb_id ?? null,
      schemaId: j?.schema_id ?? null,
    };
  }
  return map;
}

// Bygger företagets åtgärdslista: tidrapporter att godkänna, bestridanden att korrigera
// och nya ansökningar per annons-jobb.
async function inkorgFöretag(företagId) {
  // 1 + 2: väntande och bestridda tidrapporter i ett svep (tidrapporter bär foretag_id).
  // 'godkänd' hämtas bara för existenskontrollen nedan – den ger inga egna inkorgsposter.
  const { data: rapporter, error: rapportFel } = await supabase
    .from('tidrapporter')
    .select('ansokan_id, status, eskalerad, auto_skapad, created_at, bestridd_at')
    .eq('foretag_id', företagId)
    .in('status', ['väntar', 'bestridd', 'godkänd']);
  if (rapportFel) throw rapportFel;

  const väntande = (rapporter || []).filter(r => r.status === 'väntar' && r.auto_skapad === true);

  // En ansökan är "redan hanterad" om den har en väntande eller godkänd rapport – då är ett
  // äldre bestridande ersatt av en korrigering (ny rad på samma ansokan_id) och ska inte
  // längre visas. Motsvarar SQL:ens NOT EXISTS (status IN ('väntar','godkänd') AND id != t.id);
  // en bestridd rad har aldrig själv status väntar/godkänd, så id-villkoret är alltid uppfyllt.
  const hanteradeAnsökningar = new Set(
    (rapporter || [])
      .filter(r => r.status === 'väntar' || r.status === 'godkänd')
      .map(r => r.ansokan_id)
  );

  const bestridda = (rapporter || []).filter(
    r => r.status === 'bestridd'
      && r.eskalerad === false
      && !hanteradeAnsökningar.has(r.ansokan_id)
  );

  const titlar = await titlarPerAnsökan([...väntande, ...bestridda].map(r => r.ansokan_id));

  const tidrapportPoster = väntande.map(r => ({
    typ: 'tidrapport',
    titel: titlar[r.ansokan_id]?.titel ?? 'Tidrapport',
    undertext: 'Godkänn tidrapport',
    ansokanId: r.ansokan_id,
    jobbId: null,
    schemaId: null,
    skapad_at: r.created_at ?? null,
  }));

  const bestridandePoster = bestridda.map(r => ({
    typ: 'bestridande',
    titel: titlar[r.ansokan_id]?.titel ?? 'Tidrapport',
    undertext: 'Tidrapporten är bestridd – skicka korrigerad',
    ansokanId: r.ansokan_id,
    jobbId: null,
    schemaId: null,
    skapad_at: r.bestridd_at ?? r.created_at ?? null,
  }));

  // 3: nya ansökningar grupperade per annons-jobb. Pass-jobben (schema_pass_id satt)
  // bär aldrig ansökningar, så .is('schema_pass_id', null) täcker både enstaka pass och
  // schemats annons-jobb.
  const { data: annonsJobb, error: jobbFel } = await supabase
    .from('Jobb')
    .select('id, Titel, schema_id')
    .eq('Foretag_id', företagId)
    .is('schema_pass_id', null);
  if (jobbFel) throw jobbFel;

  let ansökningsPoster = [];
  if (annonsJobb && annonsJobb.length) {
    const jobbMap = Object.fromEntries(annonsJobb.map(j => [j.id, j]));
    const ansökningar = await hämtaIBitar(annonsJobb.map(j => j.id), bit =>
      supabase.from('ansokningar').select('jobb_id, created_at').eq('status', 'väntande').in('jobb_id', bit));

    const antalPerJobb = new Map();
    const senastePerJobb = new Map();
    for (const a of ansökningar) {
      antalPerJobb.set(a.jobb_id, (antalPerJobb.get(a.jobb_id) || 0) + 1);
      const nuvarande = senastePerJobb.get(a.jobb_id);
      if (a.created_at && (!nuvarande || a.created_at > nuvarande)) {
        senastePerJobb.set(a.jobb_id, a.created_at);
      }
    }

    ansökningsPoster = [...antalPerJobb.entries()].map(([jobbId, antal]) => {
      const j = jobbMap[jobbId];
      return {
        typ: 'ansokningar',
        titel: j?.Titel ?? 'Annons',
        undertext: `${antal} ny${antal === 1 ? ' ansökan' : 'a ansökningar'}`,
        ansokanId: null,
        jobbId,
        schemaId: j?.schema_id ?? null,
        skapad_at: senastePerJobb.get(jobbId) ?? null,
      };
    });
  }

  return [...tidrapportPoster, ...bestridandePoster, ...ansökningsPoster];
}

// Bygger privatpersonens åtgärdslista: tidrapporter att bekräfta, obetygsatta pass och
// (om det saknas) avtal att godkänna.
async function inkorgPrivatperson(användareId) {
  // 1: auto-skapade tidrapporter som väntar på bekräftelse (tidrapporter bär anvandare_id).
  const { data: rapporter, error: rapportFel } = await supabase
    .from('tidrapporter')
    .select('ansokan_id, created_at')
    .eq('anvandare_id', användareId)
    .eq('status', 'väntar')
    .eq('auto_skapad', true);
  if (rapportFel) throw rapportFel;

  const titlar = await titlarPerAnsökan((rapporter || []).map(r => r.ansokan_id));
  const tidrapportPoster = (rapporter || []).map(r => ({
    typ: 'tidrapport',
    titel: titlar[r.ansokan_id]?.titel ?? 'Tidrapport',
    undertext: 'Bekräfta arbetstid',
    ansokanId: r.ansokan_id,
    jobbId: null,
    schemaId: null,
    skapad_at: r.created_at ?? null,
  }));

  // 2: obetygsatta pass – återanvänder betygspopupens underlag (grupperat per schema).
  const obetygsatta = await hämtaObetygsatta(användareId, false);
  const betygsPoster = obetygsatta.map(g => ({
    typ: 'betyg',
    titel: g.motpartNamn ?? g.jobbTitel ?? 'Betygsätt',
    undertext: 'Betygsätt',
    ansokanId: g.ansokanId,
    jobbId: null,
    schemaId: null,
    skapad_at: g.datum ?? null,
  }));

  // 3: godkända ansökningar för pass/scheman som ännu inte passerat.
  const godkändaPoster = await godkändaAnsökningsPoster(användareId);

  // 4: inkomna inbjudningar (schema + enstaka pass) som ännu inte accepterats.
  const inbjudningsPoster = await inbjudanPoster(användareId);

  // 4b: väntande jobbförfrågningar som företag skickat via chatten. Inget jobb finns ännu
  // (skapas först vid accept), så posten länkar till chatten med företaget.
  const förfråganPoster = await jobbforfraganPoster(användareId);

  // 5: avtal ej godkänt (avtal_godkant finns inte i JWT – hämta separat).
  let avtalPoster = [];
  const avtalGodkant = await hämtaAvtalGodkant(användareId);
  if (!avtalGodkant) {
    avtalPoster = [{
      typ: 'avtal',
      titel: 'Avtal saknas',
      undertext: 'Ditt avtal är inte godkänt ännu',
      ansokanId: null,
      jobbId: null,
      schemaId: null,
      skapad_at: null,
    }];
  }

  return [...tidrapportPoster, ...betygsPoster, ...godkändaPoster, ...inbjudningsPoster, ...förfråganPoster, ...avtalPoster];
}

// Väntande jobbförfrågningar (ett pass erbjudet direkt via chatten) som personen fått.
// Återanvänder hämtaVäntandeFörAnvändare – bara 'väntar' tas med, så en accepterad/avböjd
// förfrågan försvinner ur inkorgen automatiskt. Förfrågan saknar jobb (skapas vid accept),
// så posten bär medAnvandareId för att öppna chatten med företaget.
async function jobbforfraganPoster(användareId) {
  const förfrågningar = await hämtaVäntandeFörAnvändare(användareId);
  return (förfrågningar || []).map(f => ({
    typ: 'jobbforfragan',
    titel: f.titel ?? 'Jobbförfrågan',
    undertext: f.företagNamn ? `Förfrågan från ${f.företagNamn}` : 'Du har fått en jobbförfrågan',
    ansokanId: null,
    jobbId: null,
    schemaId: null,
    medAnvandareId: f.fran_anvandare_id,
    skapad_at: f.skapad_datum ?? null,
  }));
}

// Godkända ansökningar där passet/schemat ännu inte passerat → "du är godkänd, öppna chatten".
// Bara annons-/enstaka-jobb (schema_pass_id NULL) tas med: pass-jobben bär var sin direkt
// godkänd ansökan, så utan filtret skulle ett 14-passschema ge 14 poster. Ett schema
// kollapsar därmed till EN post (annons-ansökan), enstaka pass ger en post var.
async function godkändaAnsökningsPoster(användareId) {
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('id, jobb_id, created_at')
    .eq('sokande_id', användareId)
    .eq('status', 'godkänd');
  if (error) throw error;
  if (!ansökningar || !ansökningar.length) return [];

  const jobb = await hämtaIBitar(ansökningar.map(a => a.jobb_id), bit =>
    supabase.from('Jobb').select('id, Titel, arbetstider, schema_id').is('schema_pass_id', null).in('id', bit));
  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));

  // Schemats slutdatum avgör om annons-ansökan fortfarande är aktuell.
  const schemaIds = [...new Set((jobb || []).map(j => j.schema_id).filter(Boolean))];
  let slutdatumMap = {};
  if (schemaIds.length) {
    const scheman = await hämtaIBitar(schemaIds, bit =>
      supabase.from('scheman').select('id, slutdatum').in('id', bit));
    slutdatumMap = Object.fromEntries((scheman || []).map(s => [s.id, s.slutdatum ?? null]));
  }

  // Enstaka pass med redan skapad tidrapport hör till tidrapport-flödet, inte hit.
  const tidrapporter = await hämtaIBitar(ansökningar.map(a => a.id), bit =>
    supabase.from('tidrapporter').select('ansokan_id').in('ansokan_id', bit));
  const harTidrapport = new Set((tidrapporter || []).map(r => r.ansokan_id));

  const idag = idagStockholm();
  const poster = [];
  for (const a of ansökningar) {
    const j = jobbMap[a.jobb_id];
    if (!j) continue; // pass-jobb (schema_pass_id satt) filtrerades bort i queryn
    let framtid;
    if (j.schema_id) {
      const slut = slutdatumMap[j.schema_id];
      framtid = slut != null && slut >= idag;
    } else {
      if (harTidrapport.has(a.id)) continue;
      const datum = parsaArbetstider(j.arbetstider).map(p => p?.datum).filter(Boolean);
      const sista = datum.length ? datum.reduce((x, y) => (y > x ? y : x)) : null;
      framtid = sista != null && sista >= idag;
    }
    if (!framtid) continue;
    poster.push({
      typ: 'godkänd_ansökan',
      titel: j.Titel ?? 'Godkänd',
      undertext: 'Du är godkänd – öppna chatten',
      ansokanId: a.id,
      jobbId: null,
      schemaId: null,
      skapad_at: a.created_at ?? null,
    });
  }
  return poster;
}

// Inkomna inbjudningar (schema OCH enstaka pass) som ännu inte accepterats. Återanvänder
// Förfrågningar-flikens underlag (avböjda + redan ansökta döljs redan där). Tillsatta/avbrutna
// scheman går inte längre att acceptera och tas bort, och passerade jobb-pass filtreras på datum.
async function inbjudanPoster(användareId) {
  const inbjudningar = await hämtaMinaInbjudningar(användareId);
  if (!inbjudningar?.length) return [];
  const idag = idagStockholm();

  const undertext = (i) => (i.företagNamn ? `Inbjudan från ${i.företagNamn}` : 'Du har fått en inbjudan');

  const schemaPoster = inbjudningar
    .filter(i => i.typ === 'schema' && i.schema_id && i.status !== 'tillsatt' && i.status !== 'avbrutet')
    .map(i => ({
      typ: 'schema_inbjudan',
      titel: i.titel ?? 'Schemainbjudan',
      undertext: undertext(i),
      ansokanId: null,
      jobbId: null,
      schemaId: i.schema_id,
      skapad_at: i.skapad_datum ?? null,
    }));

  const jobbPoster = inbjudningar
    .filter(i => i.typ === 'jobb' && i.jobb_id && (i.datum == null || i.datum >= idag))
    .map(i => ({
      typ: 'jobb_inbjudan',
      titel: i.titel ?? 'Jobbinbjudan',
      undertext: undertext(i),
      ansokanId: null,
      jobbId: i.jobb_id,
      schemaId: null,
      skapad_at: i.skapad_datum ?? null,
    }));

  return [...schemaPoster, ...jobbPoster];
}

// Härleder hela åtgärdslistan för den inloggade. Poster försvinner automatiskt när
// åtgärden utförts eftersom listan räknas fram vid varje anrop.
async function hämtaInkorg(användare) {
  let poster = [];
  if (användare.typ === 'företag') poster = await inkorgFöretag(användare.id);
  else if (användare.typ === 'privatperson') poster = await inkorgPrivatperson(användare.id);
  else return [];

  // Nyaste först. Poster utan tidsstämpel (t.ex. avtal) hamnar sist.
  return poster.sort((a, b) => {
    const at = a.skapad_at ?? '';
    const bt = b.skapad_at ?? '';
    if (at === bt) return 0;
    return at > bt ? -1 : 1;
  });
}

module.exports = { hämtaInkorg };
