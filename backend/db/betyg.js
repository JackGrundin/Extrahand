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

  return { snitt: snitt ? parseFloat(snitt) : null, antal: data.length, betyg: data };
}

module.exports = { skapaBetyg, finnsDublettBetyg, hämtaBetyg };
