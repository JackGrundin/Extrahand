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

// Skapar (eller uppdaterar) en inbjudan. E-posten lagras i gemener så matchningen mot
// användarens e-post blir konsekvent. Returnerar raden.
async function skapaInbjudan({ schema_id, email, tokenHash, anvandare_id }) {
  const { data, error } = await supabase
    .from('schema_inbjudningar')
    .insert([{
      schema_id,
      email: String(email).trim().toLowerCase(),
      token_hash: tokenHash,
      anvandare_id: anvandare_id ?? null,
    }])
    .select()
    .single();
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
// saknades). Idempotent: skriver inte över en tidigare accepterad_at.
async function markeraAccepterad(id, anvandare_id) {
  const { error } = await supabase
    .from('schema_inbjudningar')
    .update({
      accepterad_at: new Date().toISOString(),
      ...(anvandare_id ? { anvandare_id } : {}),
    })
    .eq('id', id)
    .is('accepterad_at', null);
  if (error) throw error;
}

module.exports = {
  hashaToken,
  skapaInbjudan,
  hämtaInbjudanViaTokenHash,
  hämtaInbjudningarFörSchema,
  markeraAccepterad,
};
