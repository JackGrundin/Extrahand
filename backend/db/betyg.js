const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaBetyg({ ansokan_id, av_anvandare_id, till_anvandare_id, stjarnor, kommentar }) {
  const { data, error } = await supabase
    .from('betyg')
    .insert([{ ansokan_id, av_anvandare_id, till_anvandare_id, stjarnor, kommentar }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function finnsDublettBetyg(ansokan_id, av_anvandare_id) {
  const { data, error } = await supabase
    .from('betyg')
    .select('id')
    .eq('ansokan_id', ansokan_id)
    .eq('av_anvandare_id', av_anvandare_id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

async function hämtaBetyg(till_anvandare_id) {
  const { data, error } = await supabase
    .from('betyg')
    .select('stjarnor, kommentar, created_at, av_anvandare_id')
    .eq('till_anvandare_id', till_anvandare_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const snitt = data.length
    ? (data.reduce((sum, b) => sum + b.stjarnor, 0) / data.length).toFixed(1)
    : null;

  const avIds = [...new Set(data.map(b => b.av_anvandare_id).filter(Boolean))];
  const { data: företag } = avIds.length
    ? await supabase.from('användare').select('id, Namn').in('id', avIds)
    : { data: [] };
  const företagMap = Object.fromEntries((företag || []).map(f => [f.id, f.Namn]));

  const betyg = data.map(b => ({
    ...b,
    företagNamn: företagMap[b.av_anvandare_id] ?? null,
  }));

  return { snitt: snitt ? parseFloat(snitt) : null, antal: data.length, betyg };
}

// PostgREST skickar .in()-listor i URL:en, som har en längdgräns. Ett schema ger en
// tidrapport och en ansökan per pass, så listorna växer snabbt – samma skäl som CHUNK i
// db/ansokningar.js.
const CHUNK = 500;

async function hämtaIBitar(ids, hämta) {
  const unika = [...new Set((ids || []).filter(id => id != null))];
  if (!unika.length) return [];
  const alla = [];
  for (let i = 0; i < unika.length; i += CHUNK) {
    const { data, error } = await hämta(unika.slice(i, i + CHUNK));
    if (error) throw error;
    alla.push(...(data || []));
  }
  return alla;
}

// Uppdrag som är klara men ännu obetygsatta av den inloggade – underlaget för betygspopupen.
//
// "Klart" = tidrapporten är godkänd. Det är den enda punkt där båda parter vet att arbetet
// är utfört OCH att timmarna är överenskomna; ett bestridande betyder att de inte är det.
//
// GRUPPERINGEN ÄR BÄRANDE: ett schema ger en tidrapport per pass, alltså 14 rader för ett
// tvåveckorsuppdrag. Utan gruppering på schema_id hade popupen kommit fjorton gånger för
// samma person. Ett betyg på vilken som helst av gruppens ansökningar gör hela gruppen
// betygsatt – annars kom de tretton andra tillbaka direkt efter att man satt sitt betyg.
async function hämtaObetygsatta(anvandareId, ärFöretag) {
  const kolumn = ärFöretag ? 'foretag_id' : 'anvandare_id';
  const { data: rapporter, error } = await supabase
    .from('tidrapporter')
    .select('ansokan_id, created_at, datum')
    .eq('status', 'godkänd')
    .eq(kolumn, anvandareId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const ansökningsIdn = [...new Set(rapporter.map(r => r.ansokan_id).filter(Boolean))];
  if (!ansökningsIdn.length) return [];

  const ansökningar = await hämtaIBitar(ansökningsIdn, bit =>
    supabase.from('ansokningar').select('id, jobb_id, sokande_id').in('id', bit));
  const ansökanMap = Object.fromEntries(ansökningar.map(a => [a.id, a]));

  const jobb = await hämtaIBitar(ansökningar.map(a => a.jobb_id), bit =>
    supabase.from('Jobb').select('id, Titel, Foretag_id, schema_id').in('id', bit));
  const jobbMap = Object.fromEntries(jobb.map(j => [j.id, j]));

  // Grupp = ett schema, eller en ensam ansökan för ett enstaka pass.
  const grupper = new Map();
  for (const r of rapporter) {
    const ansökan = ansökanMap[r.ansokan_id];
    if (!ansökan) continue;
    const j = jobbMap[ansökan.jobb_id];
    if (!j) continue;

    const motpartId = ärFöretag ? ansökan.sokande_id : (j.Foretag_id ?? null);
    // Motparten ingår i nyckeln: hoppar någon av ett schema och ersätts av en annan person
    // har företaget arbetat med TVÅ personer i samma schema och ska kunna betygsätta båda.
    const nyckel = j.schema_id ? `schema:${j.schema_id}:${motpartId}` : `ansokan:${ansökan.id}`;
    const grupp = grupper.get(nyckel);
    if (grupp) {
      grupp.ansökningsIdn.push(ansökan.id);
    } else {
      // Rapporterna kommer nyast först, så den första i varje grupp är den senaste och
      // blir gruppens representant.
      grupper.set(nyckel, {
        ansokanId: ansökan.id,
        ansökningsIdn: [ansökan.id],
        datum: r.datum ?? null,
        jobbTitel: j.Titel ?? null,
        motpartId,
      });
    }
  }

  if (!grupper.size) return [];

  const mina = await hämtaIBitar([...grupper.values()].flatMap(g => g.ansökningsIdn), bit =>
    supabase.from('betyg').select('ansokan_id').eq('av_anvandare_id', anvandareId).in('ansokan_id', bit));
  const betygsatta = new Set(mina.map(b => b.ansokan_id));

  const kvar = [...grupper.values()].filter(g => !g.ansökningsIdn.some(id => betygsatta.has(id)));
  if (!kvar.length) return [];

  const motparter = await hämtaIBitar(kvar.map(g => g.motpartId), bit =>
    supabase.from('användare').select('id, Namn').in('id', bit));
  const namnMap = Object.fromEntries(motparter.map(m => [m.id, m.Namn]));

  return kvar.map(g => ({
    ansokanId: g.ansokanId,
    jobbTitel: g.jobbTitel,
    datum: g.datum,
    motpartNamn: namnMap[g.motpartId] ?? null,
  }));
}

module.exports = { skapaBetyg, finnsDublettBetyg, hämtaBetyg, hämtaObetygsatta };
