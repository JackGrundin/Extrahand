const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { månadensStart } = require('../utils/manad');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// schema_id/schema_pass_id sätts bara av schemafunktionen. schema_id ensamt = schemats
// annons-jobb (bär ansökningar och chatt), båda satta = ett materialiserat schemapass.
// Se db/migrations/scheman.sql.
async function skapaJobb({ titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, behorighets_krav, paslag, foretag_id, schema_id = null, schema_pass_id = null }) {
  const { data, error } = await supabase
    .from('Jobb')
    .insert([{ Titel: titel, Beskrivning: beskrivning, Plats: plats, adress, Lon: lon, Typ: typ, Kategori: kategori, antal_dagar, arbetstider, ob_tillagg: ob_tillagg || [], behorighets_krav: behorighets_krav || [], paslag, Foretag_id: foretag_id, schema_id, schema_pass_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Skapar flera jobb i ett anrop. Ett schema med 60 pass ska inte bli 60 rundturer till
// databasen. Chunkas om 50 rader så att varken PostgREST eller Supabase stryper anropet.
async function skapaJobbBatch(rader) {
  if (!rader.length) return [];
  const skapade = [];
  for (let i = 0; i < rader.length; i += 50) {
    const { data, error } = await supabase
      .from('Jobb')
      .insert(rader.slice(i, i + 50).map(r => ({
        Titel: r.titel, Beskrivning: r.beskrivning, Plats: r.plats, adress: r.adress,
        Lon: r.lon, Typ: r.typ, Kategori: r.kategori, antal_dagar: r.antal_dagar,
        arbetstider: r.arbetstider, ob_tillagg: r.ob_tillagg || [], paslag: r.paslag,
        Foretag_id: r.foretag_id, schema_id: r.schema_id ?? null, schema_pass_id: r.schema_pass_id ?? null,
      })))
      .select();
    if (error) throw error;
    skapade.push(...(data || []));
  }
  return skapade;
}

async function filtreraAktivaJobb(jobb) {
  if (!jobb.length) return [];

  const jobbIds = jobb.map(j => j.id);
  const { data: ansokningar } = await supabase
    .from('ansokningar')
    .select('id, jobb_id, status, created_at')
    .in('jobb_id', jobbIds);

  // Räkna nya ansökningar per jobb – de som kommit in efter att företaget senast öppnade
  // jobbets ansökningslista (ansokningar_sedda_at). NULL = aldrig öppnat → alla är nya.
  const nyaPerJobb = {};
  const seddMap = Object.fromEntries(jobb.map(j => [j.id, j.ansokningar_sedda_at]));
  for (const a of (ansokningar || [])) {
    const sedd = seddMap[a.jobb_id];
    if (!sedd || new Date(a.created_at) > new Date(sedd)) {
      nyaPerJobb[a.jobb_id] = (nyaPerJobb[a.jobb_id] || 0) + 1;
    }
  }

  // Ett jobb ska försvinna från listan så snart en ansökan blivit godkänd – då är
  // passet tillsatt och ska inte längre gå att söka. Vi tar även med jobb vars
  // tidrapport godkänts (avslutade pass) för bakåtkompatibilitet.
  const godkändaJobbIds = new Set();
  for (const a of (ansokningar || [])) {
    if (a.status === 'godkänd') godkändaJobbIds.add(a.jobb_id);
  }

  const ansokningsIds = (ansokningar || []).map(a => a.id);
  if (ansokningsIds.length > 0) {
    const { data: godkändaRapporter } = await supabase
      .from('tidrapporter')
      .select('ansokan_id')
      .eq('status', 'godkänd')
      .in('ansokan_id', ansokningsIds);

    const godkändaAnsokIds = new Set((godkändaRapporter || []).map(r => r.ansokan_id));
    for (const a of (ansokningar || [])) {
      if (godkändaAnsokIds.has(a.id)) godkändaJobbIds.add(a.jobb_id);
    }
  }

  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  const aktiva = jobb.filter(j => {
    if (godkändaJobbIds.has(j.id)) return false;

    const schema = Array.isArray(j.arbetstider)
      ? j.arbetstider
      : (() => { try { return JSON.parse(j.arbetstider); } catch { return null; } })();


    if (schema && schema.length > 0) {
      const datum = schema.map(d => d.datum).filter(Boolean);
      if (datum.length > 0) {
        const sistaDate = datum
          .map(d => new Date(d + 'T12:00:00'))
          .sort((a, b) => b - a)[0];
        if (sistaDate < idag) return false;
      } else {
        // Schema finns men saknar datum – behandla som gammalt jobb
        const skapad = new Date(j.created_at);
        if (idag - skapad > 30 * 24 * 60 * 60 * 1000) return false;
      }
    } else {
      // Inget schema alls – filtrera ut om jobbet är äldre än 30 dagar
      const skapad = new Date(j.created_at);
      if (idag - skapad > 30 * 24 * 60 * 60 * 1000) return false;
    }

    return true;
  });

  return aktiva.map(j => ({ ...j, nyaAnsökningar: nyaPerJobb[j.id] || 0 }));
}

// Returnerar en Set med de jobb-id (bland de angivna) som har minst en godkänd ansökan.
// Ett jobb behöver bara avslutas om någon faktiskt blivit godkänd att jobba passet.
async function jobbMedGodkändAnsökan(jobbIds) {
  if (!jobbIds.length) return new Set();
  const { data } = await supabase
    .from('ansokningar')
    .select('jobb_id')
    .eq('status', 'godkänd')
    .in('jobb_id', jobbIds);
  return new Set((data || []).map(a => a.jobb_id));
}

async function hämtaAllaJobb() {
  // Schemats jobb hör hemma i schemafliken, aldrig i listan över enstaka pass. Filtret
  // är en korrekthetsfråga och inte kosmetika: i glappet när en person hoppat av och en
  // ny ännu inte godkänts saknar de framtida passjobben godkänd ansökan, och skulle
  // annars slinka igenom filtreraAktivaJobb som sökbara annonser.
  const { data: jobb, error } = await supabase
    .from('Jobb')
    .select('*')
    .is('schema_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!jobb.length) return [];

  const aktivaJobb = await filtreraAktivaJobb(jobb);

  const foretagIds = [...new Set(
    aktivaJobb.map(j => j.Foretag_id ?? j.foretag_id).filter(id => id != null)
  )];
  const { data: foretag } = await supabase.from('användare').select('id, Namn, aktiv').in('id', foretagIds);
  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return aktivaJobb
    // Annonser från raderade konton ska inte gå att söka. Jobbraderna blir kvar
    // (de bär ansökningar och chatt), men företaget finns inte längre och kan
    // varken svara eller godkänna. aktiv === false, inte !aktiv: NULL betyder
    // konto från före kolumnen fanns och är aktivt.
    .filter(j => foretagMap[j.Foretag_id ?? j.foretag_id]?.aktiv !== false)
    .map(j => ({
      ...j,
      foretagNamn: (() => {
        const fid = j.Foretag_id ?? j.foretag_id;
        return foretagMap[fid]?.Namn ?? null;
      })(),
    }));
}

async function hämtaJobbViaId(id) {
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Företagets egna annonser. Schemajobb filtreras bort – de visas i Scheman-fliken.
// Anropas även av routes/användare.js för företagets publika profil, så filtret måste
// sitta här och inte i routen.
async function hämtaJobbFörFöretag(foretag_id, { endastAktiva = false } = {}) {
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('Foretag_id', foretag_id)
    .is('schema_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || !data.length) return [];
  if (endastAktiva) return filtreraAktivaJobb(data);
  return data;
}

// Hämtar företagets tidigare pass: jobb vars sista arbetsdatum redan passerat, samt
// gamla jobb (äldre än 30 dagar) som saknar datum. Detta är den exakta inversen av
// datumlogiken i filtreraAktivaJobb.
async function hämtaTidigareJobbFörFöretag(foretag_id) {
  // Schemajobb hålls utanför även här. Utöver att listan annars skulle floodas ger det
  // rätt badge i AttAvslutaContext utan ändring: schemapass rapporteras automatiskt och
  // ska aldrig räknas som "behöver avslutas".
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('Foretag_id', foretag_id)
    .is('schema_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || !data.length) return [];

  const idag = new Date();
  idag.setHours(0, 0, 0, 0);
  const trettioDagar = 30 * 24 * 60 * 60 * 1000;

  const passerade = data.filter(j => {
    const schema = Array.isArray(j.arbetstider)
      ? j.arbetstider
      : (() => { try { return JSON.parse(j.arbetstider); } catch { return null; } })();

    const datum = (schema || []).map(d => d.datum).filter(Boolean);

    if (datum.length > 0) {
      // Har datum: tidigare när sista arbetsdatum passerat.
      const sistaDate = datum
        .map(d => new Date(d + 'T12:00:00'))
        .sort((a, b) => b - a)[0];
      return sistaDate < idag;
    }

    // Saknar datum (med eller utan schema): tidigare när jobbet är äldre än 30 dagar.
    return idag - new Date(j.created_at) > trettioDagar;
  });

  // Märk varje passerat jobb med om någon blev godkänd. Frontend visar "Behöver avslutas"
  // bara när harGodkänd är sant – ett jobb som ingen tillsattes för har inget pass att avsluta.
  const godkända = await jobbMedGodkändAnsökan(passerade.map(j => j.id));
  return passerade.map(j => ({ ...j, harGodkänd: godkända.has(j.id) }));
}

// Schemajobb får inte ändras via jobb-API:t – de ägs av schemat och redigeras via
// /api/scheman. Därför .is('schema_id', null) utöver ägarkontrollen.
async function uppdateraJobb(id, foretag_id, { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, behorighets_krav }) {
  const { data, error } = await supabase
    .from('Jobb')
    .update({ Titel: titel, Beskrivning: beskrivning, Plats: plats, adress, Lon: lon, Typ: typ, Kategori: kategori, antal_dagar, arbetstider, ob_tillagg: ob_tillagg || [], behorighets_krav: behorighets_krav || [] })
    .eq('id', id)
    .eq('Foretag_id', foretag_id)
    .is('schema_id', null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Fryser (eller nollar) jobbets påslag. Sätts när en ansökan godkänns – passet är då
// tillsatt och priset avgjort. Nollas igen om godkännandet tas tillbaka.
async function sättJobbPåslag(id, paslag) {
  const { error } = await supabase.from('Jobb').update({ paslag }).eq('id', id);
  if (error) throw error;
}

// Antal jobb företaget publicerat denna månad. Styr popupen vid publicering. Räknas
// direkt ur tabellen i stället för via en kolumn, så att ett borttaget jobb automatiskt
// försvinner ur räkningen.
// Ett schema räknas som EN publicering: schemats annons-jobb (schema_id satt,
// schema_pass_id null) räknas med, medan de materialiserade passjobben filtreras bort.
// Därmed behövs ingen separat räkning av scheman-tabellen.
async function räknaJobbDennaMånad(foretag_id) {
  const { count, error } = await supabase
    .from('Jobb')
    .select('id', { count: 'exact', head: true })
    .eq('Foretag_id', foretag_id)
    .is('schema_pass_id', null)
    .gte('created_at', månadensStart());

  if (error) throw error;
  return count ?? 0;
}

// Nollställer räknaren för nya ansökningar genom att stämpla att företaget nyss öppnade
// jobbets ansökningslista. Scoped på Foretag_id så bara ägaren kan markera sitt jobb.
async function markeraAnsökningarSedda(id, foretag_id) {
  const { error } = await supabase
    .from('Jobb')
    .update({ ansokningar_sedda_at: new Date().toISOString() })
    .eq('id', id)
    .eq('Foretag_id', foretag_id);
  if (error) throw error;
}

// Schemajobb raderas aldrig härifrån – ett schema avbryts via /api/scheman, vilket
// bevarar genomförda pass och deras tidrapporter.
async function taBortJobb(id, foretag_id) {
  const { error } = await supabase
    .from('Jobb')
    .delete()
    .eq('id', id)
    .eq('Foretag_id', foretag_id)
    .is('schema_id', null);
  if (error) throw error;
}

module.exports = { skapaJobb, skapaJobbBatch, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, hämtaTidigareJobbFörFöretag, uppdateraJobb, taBortJobb, sättJobbPåslag, räknaJobbDennaMånad, markeraAnsökningarSedda };
