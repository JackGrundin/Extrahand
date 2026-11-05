// Databaslager för e-postinbjudningar till privata scheman. Endast SHA-256-hashen av
// token lagras – klartext-token finns bara i mejllänken, precis som
// lösenordsåterställningen (routes/auth.js). Se db/migrations/schema_privat.sql.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Samma hash som återställningstoken: SHA-256-hex. Token jämförs aldrig i klartext.
function hashaToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Skapar en inbjudan. Bär antingen schema_id ELLER jobb_id (exakt ett – se
// migrations/inbjudan_lankar.sql). E-posten lagras i gemener så matchningen mot
// användarens e-post blir konsekvent; en länk-inbjudan saknar e-post (email = null).
// Returnerar raden.
async function skapaInbjudan({ schema_id, jobb_id, email, tokenHash, anvandare_id, foretag_id }) {
  const { data, error } = await supabase
    .from('schema_inbjudningar')
    .insert([{
      schema_id: schema_id ?? null,
      jobb_id: jobb_id ?? null,
      email: email ? String(email).trim().toLowerCase() : null,
      token_hash: tokenHash,
      anvandare_id: anvandare_id ?? null,
      foretag_id: foretag_id ?? null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Finns en INLÖST inbjudan (accepterad_at satt) kopplad till den här personen för det
// här jobbet eller schemat, med rabatt_godkand = true? Styr om påslaget fryses till det
// rabatterade värdet vid godkännandet. Matchar på jobb_id ELLER schema_id – ett schema
// godkänns via sitt annons-jobb som bär schema_id. Returnerar raden eller null.
async function hämtaRabattInbjudan({ jobb_id, schema_id, anvandare_id }) {
  if (!anvandare_id) return null;
  let fråga = supabase
    .from('schema_inbjudningar')
    .select('id, jobb_id, schema_id')
    .eq('anvandare_id', anvandare_id)
    .eq('rabatt_godkand', true)
    .not('accepterad_at', 'is', null);
  if (schema_id) fråga = fråga.eq('schema_id', schema_id);
  else fråga = fråga.eq('jobb_id', jobb_id);
  const { data, error } = await fråga.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function hämtaInbjudanViaTokenHash(tokenHash) {
  const { data, error } = await supabase
    .from('schema_inbjudningar')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Inbjudan via sitt id – används när Förfrågningar-fliken accepterar via id (klartext-token
// finns inte där, bara hashen lagras).
async function hämtaInbjudanViaId(id) {
  const { data, error } = await supabase
    .from('schema_inbjudningar')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Personens inkomna förfrågningar via inbjudningslänk/mejl: rader kopplade till personen
// (anvandare_id) där hen ännu INTE skapat en ansökan på målannonsen. Berikas med jobbets/
// schemats titel, företagsnamn, datum och timlön så att Förfrågningar-fliken kan visa dem.
// Villkoret är ansökan-existens, inte accepterad_at: koppla stämplar accepterad_at, och en
// ny användare ska ändå se förfrågan tills hen faktiskt accepterat (= ansökan skapad).
async function hämtaMinaInbjudningar(anvandare_id) {
  const { data: inbjudningar, error } = await supabase
    .from('schema_inbjudningar')
    .select('id, jobb_id, schema_id, skapad_datum')
    .eq('anvandare_id', anvandare_id)
    .order('skapad_datum', { ascending: false });
  if (error) throw error;
  if (!inbjudningar?.length) return [];

  // Schema-inbjudningar pekar på schemats annons-jobb; berika schemadata.
  const schemaIds = [...new Set(inbjudningar.filter(i => i.schema_id).map(i => i.schema_id))];
  let schemaMap = {};
  if (schemaIds.length) {
    const { data: scheman } = await supabase
      .from('scheman')
      .select('id, titel, timlon, startdatum, foretag_id, annons_jobb_id')
      .in('id', schemaIds);
    schemaMap = Object.fromEntries((scheman || []).map(s => [s.id, s]));
  }

  // Målannonsens jobb-id per inbjudan (jobb-inbjudan: jobb_id; schema: annons_jobb_id).
  const målJobbId = (i) => i.jobb_id ?? schemaMap[i.schema_id]?.annons_jobb_id ?? null;
  const jobbIds = [...new Set(inbjudningar.map(målJobbId).filter(Boolean))];
  let jobbMap = {};
  if (jobbIds.length) {
    const { data: jobb } = await supabase
      .from('Jobb')
      .select('id, Titel, Lon, arbetstider, Foretag_id')
      .in('id', jobbIds);
    jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));
  }

  // Målannonser personen redan har en AKTIV ansökan på (uteslut dessa – de är inte längre
  // väntande förfrågningar). Bara 'väntande'/'godkänd' blockerar: en avvisad ansökan (företaget
  // nekade, eller personen hoppade av – båda ger status 'avvisad') ska INTE dölja en ny
  // inbjudan, så att ett omtag efter ett avslag syns igen i Förfrågningar.
  let sökta = new Set();
  if (jobbIds.length) {
    const { data: ansokningar } = await supabase
      .from('ansokningar')
      .select('jobb_id')
      .eq('sokande_id', anvandare_id)
      .in('jobb_id', jobbIds)
      .in('status', ['väntande', 'godkänd']);
    sökta = new Set((ansokningar || []).map(a => a.jobb_id));
  }

  // Företagsnamn.
  const foretagIds = [...new Set(inbjudningar.map(i =>
    i.schema_id ? schemaMap[i.schema_id]?.foretag_id : jobbMap[i.jobb_id]?.Foretag_id
  ).filter(Boolean))];
  let namnMap = {};
  if (foretagIds.length) {
    const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);
    namnMap = Object.fromEntries((foretag || []).map(f => [f.id, f.Namn]));
  }

  const förstaDatum = (jobb) => {
    const at = Array.isArray(jobb?.arbetstider)
      ? jobb.arbetstider
      : (() => { try { return JSON.parse(jobb?.arbetstider || '[]'); } catch { return []; } })();
    return at?.[0]?.datum ?? null;
  };

  const resultat = [];
  for (const i of inbjudningar) {
    const jobbId = målJobbId(i);
    if (!jobbId || sökta.has(jobbId)) continue;
    const ärSchema = !!i.schema_id;
    const schema = ärSchema ? schemaMap[i.schema_id] : null;
    const jobb = jobbMap[jobbId];
    const foretagId = ärSchema ? schema?.foretag_id : jobb?.Foretag_id;
    resultat.push({
      id: i.id,
      typ: ärSchema ? 'schema' : 'jobb',
      titel: ärSchema ? (schema?.titel ?? null) : (jobb?.Titel ?? null),
      företagNamn: namnMap[foretagId] ?? null,
      datum: ärSchema ? (schema?.startdatum ?? null) : förstaDatum(jobb),
      timlon: ärSchema ? (schema?.timlon ?? null) : (jobb?.Lon ?? null),
      skapad_datum: i.skapad_datum,
    });
  }
  return resultat;
}

// Inbjudningarna för ett schema, nyast först – matar företagets "inbjudna"-lista.
async function hämtaInbjudningarFörSchema(schema_id) {
  const { data, error } = await supabase
    .from('schema_inbjudningar')
    .select('email, anvandare_id, accepterad_at, skapad_datum')
    .eq('schema_id', schema_id)
    .order('skapad_datum', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Stämplar att en inbjudan lösts in av en inloggad användare (och kopplar kontot om det
// saknades). rabattGodkand sätts när kontot registrerades via länken och ska få
// rabatterat påslag. Idempotent: skriver inte över en tidigare accepterad_at, så
// rabatten kan inte sättas om i efterhand.
async function markeraAccepterad(id, anvandare_id, { rabattGodkand = false } = {}) {
  const { error } = await supabase
    .from('schema_inbjudningar')
    .update({
      accepterad_at: new Date().toISOString(),
      ...(anvandare_id ? { anvandare_id } : {}),
      ...(rabattGodkand ? { rabatt_godkand: true } : {}),
    })
    .eq('id', id)
    .is('accepterad_at', null);
  if (error) throw error;
}

module.exports = {
  hashaToken,
  skapaInbjudan,
  hämtaRabattInbjudan,
  hämtaInbjudanViaTokenHash,
  hämtaInbjudanViaId,
  hämtaMinaInbjudningar,
  hämtaInbjudningarFörSchema,
  markeraAccepterad,
};
