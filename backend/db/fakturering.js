const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaFaktureringsunderlag({ tidrapport_id, foretag_id, anvandare_id, foretagsnamn, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson, timmar, timlon, faktureringsbelopp, datum }) {
  const { data, error } = await supabase
    .from('faktureringsunderlag')
    .insert([{ tidrapport_id, foretag_id, anvandare_id, foretagsnamn, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson, timmar, timlon, faktureringsbelopp, datum }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function hämtaFaktureringsunderlag() {
  const { data, error } = await supabase
    .from('faktureringsunderlag')
    .select('*')
    .eq('fakturerad', false)
    .order('datum', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function markeraFakturerad(id) {
  const { error } = await supabase
    .from('faktureringsunderlag')
    .update({ fakturerad: true })
    .eq('id', id);
  if (error) throw error;
}

module.exports = { skapaFaktureringsunderlag, hämtaFaktureringsunderlag, markeraFakturerad };
