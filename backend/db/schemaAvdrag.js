// Löneavdrag knutna till ett schema, t.ex. boende eller kost som företaget står för.
//
// Avdraget påverkar INTE faktureringsbeloppet – företaget faktureras på bruttot precis som
// förut. Det reglerar bara vad personen får ut. Se beräknaBelopp i utils/pris.js.
//
// Avdragen kopieras (fryses) till tidrapporten när den skapas, så en ändring här påverkar
// bara framtida pass. Det är avsiktligt: faktureringsunderlaget produceras uteslutande ur
// tidrapporter, och en redigering i september får inte ändra en faktura från juli.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

const GILTIGA_TYPER = ['per_dag', 'totalt'];

async function skapaAvdrag({ schema_id, namn, belopp, typ }) {
  const { data, error } = await supabase
    .from('schema_avdrag')
    .insert([{
      schema_id,
      namn: String(namn).trim(),
      belopp: Number(belopp),
      typ: GILTIGA_TYPER.includes(typ) ? typ : 'per_dag',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAktivaAvdrag(schema_id) {
  const { data, error } = await supabase
    .from('schema_avdrag')
    .select('*')
    .eq('schema_id', schema_id)
    .eq('aktiv', true)
    .order('skapad_datum', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function hämtaAvdragViaId(id) {
  const { data, error } = await supabase
    .from('schema_avdrag')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Mjuk borttagning. Raden behålls så att en tidrapport från i somras går att förklara i
// höst – det här är lön, och historiken måste vara läsbar.
async function avaktiveraAvdrag(id, schema_id) {
  const { error } = await supabase
    .from('schema_avdrag')
    .update({ aktiv: false })
    .eq('id', id)
    .eq('schema_id', schema_id);

  if (error) throw error;
}

module.exports = { GILTIGA_TYPER, skapaAvdrag, hämtaAktivaAvdrag, hämtaAvdragViaId, avaktiveraAvdrag };
