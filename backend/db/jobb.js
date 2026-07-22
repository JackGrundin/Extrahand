const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { månadensStart } = require('../utils/manad');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaJobb({ titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, paslag, foretag_id }) {
  const { data, error } = await supabase
    .from('Jobb')
    .insert([{ Titel: titel, Beskrivning: beskrivning, Plats: plats, adress, Lon: lon, Typ: typ, Kategori: kategori, antal_dagar, arbetstider, ob_tillagg: ob_tillagg || [], paslag, Foretag_id: foretag_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
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
  const { data: jobb, error } = await supabase
    .from('Jobb')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!jobb.length) return [];

  const aktivaJobb = await filtreraAktivaJobb(jobb);

  const foretagIds = [...new Set(
    aktivaJobb.map(j => j.Foretag_id ?? j.foretag_id).filter(id => id != null)
  )];
  const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);
  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return aktivaJobb.map(j => ({
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

async function hämtaJobbFörFöretag(foretag_id, { endastAktiva = false } = {}) {
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('Foretag_id', foretag_id)
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
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('Foretag_id', foretag_id)
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

async function uppdateraJobb(id, foretag_id, { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg }) {
  const { data, error } = await supabase
    .from('Jobb')
    .update({ Titel: titel, Beskrivning: beskrivning, Plats: plats, adress, Lon: lon, Typ: typ, Kategori: kategori, antal_dagar, arbetstider, ob_tillagg: ob_tillagg || [] })
    .eq('id', id)
    .eq('Foretag_id', foretag_id)
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
async function räknaJobbDennaMånad(foretag_id) {
  const { count, error } = await supabase
    .from('Jobb')
    .select('id', { count: 'exact', head: true })
    .eq('Foretag_id', foretag_id)
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

async function taBortJobb(id, foretag_id) {
  const { error } = await supabase
    .from('Jobb')
    .delete()
    .eq('id', id)
    .eq('Foretag_id', foretag_id);
  if (error) throw error;
}

module.exports = { skapaJobb, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, hämtaTidigareJobbFörFöretag, uppdateraJobb, taBortJobb, sättJobbPåslag, räknaJobbDennaMånad, markeraAnsökningarSedda };
