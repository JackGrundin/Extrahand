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
  hämtaInbjudningarFörSchema,
  markeraAccepterad,
};
