const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { hämtaIBitar } = require('./ansokningar');
const { hämtaObetygsatta } = require('./betyg');
const { hämtaAvtalGodkant } = require('./användare');

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
  const { data: rapporter, error: rapportFel } = await supabase
    .from('tidrapporter')
    .select('ansokan_id, status, eskalerad, auto_skapad')
    .eq('foretag_id', företagId)
    .in('status', ['väntar', 'bestridd']);
  if (rapportFel) throw rapportFel;

  const väntande = (rapporter || []).filter(r => r.status === 'väntar' && r.auto_skapad === true);
  const bestridda = (rapporter || []).filter(r => r.status === 'bestridd' && r.eskalerad === false);

  const titlar = await titlarPerAnsökan([...väntande, ...bestridda].map(r => r.ansokan_id));

  const tidrapportPoster = väntande.map(r => ({
    typ: 'tidrapport',
    titel: titlar[r.ansokan_id]?.titel ?? 'Tidrapport',
    undertext: 'Godkänn tidrapport',
    ansokanId: r.ansokan_id,
    jobbId: null,
    schemaId: null,
  }));

  const bestridandePoster = bestridda.map(r => ({
    typ: 'bestridande',
    titel: titlar[r.ansokan_id]?.titel ?? 'Tidrapport',
    undertext: 'Tidrapporten är bestridd – skicka korrigerad',
    ansokanId: r.ansokan_id,
    jobbId: null,
    schemaId: null,
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
      supabase.from('ansokningar').select('jobb_id').eq('status', 'väntande').in('jobb_id', bit));

    const antalPerJobb = new Map();
    for (const a of ansökningar) {
      antalPerJobb.set(a.jobb_id, (antalPerJobb.get(a.jobb_id) || 0) + 1);
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
    .select('ansokan_id')
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
  }));

  // 3: avtal ej godkänt (avtal_godkant finns inte i JWT – hämta separat).
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
    }];
  }

  return [...tidrapportPoster, ...betygsPoster, ...avtalPoster];
}

// Härleder hela åtgärdslistan för den inloggade. Poster försvinner automatiskt när
// åtgärden utförts eftersom listan räknas fram vid varje anrop.
async function hämtaInkorg(användare) {
  if (användare.typ === 'företag') return inkorgFöretag(användare.id);
  if (användare.typ === 'privatperson') return inkorgPrivatperson(användare.id);
  return [];
}

module.exports = { hämtaInkorg };
