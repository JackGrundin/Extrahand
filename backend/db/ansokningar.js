const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaAnsökan({ jobb_id, sokande_id, meddelande }) {
  const { data, error } = await supabase
    .from('ansokningar')
    .insert([{ jobb_id, sokande_id, meddelande }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAnsökningarFörSökande(sokande_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('sokande_id', sokande_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function hämtaAnsökningarFörJobb(jobb_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('jobb_id', jobb_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function finnsDubblettAnsökan(jobb_id, sokande_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('id')
    .eq('jobb_id', jobb_id)
    .eq('sokande_id', sokande_id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

module.exports = { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan };
