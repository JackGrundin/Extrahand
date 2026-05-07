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
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('sokande_id', sokande_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const jobbIds = [...new Set(ansökningar.map(a => a.jobb_id))];
  const { data: jobb } = await supabase.from('Jobb').select('*').in('id', jobbIds);

  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));

  const foretagIds = [...new Set(
    (jobb || []).map(j => j.Foretag_id ?? j.foretag_id).filter(id => id != null)
  )];
  const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);

  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return ansökningar.map(a => ({
    ...a,
    jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
    foretagNamn: (() => {
      const j = jobbMap[a.jobb_id];
      const fid = j?.Foretag_id ?? j?.foretag_id;
      return foretagMap[fid]?.Namn ?? null;
    })(),
  }));
}

async function hämtaTotalTimmar(sokande_id) {
  const { data } = await supabase
    .from('ansokningar')
    .select('timmar')
    .eq('sokande_id', sokande_id);
  return (data || []).reduce((sum, a) => sum + (a.timmar || 0), 0);
}

async function uppdateraTimmar(id, timmar) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ timmar })
    .eq('id', id);
  if (error) throw error;
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

module.exports = { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, hämtaTotalTimmar, uppdateraTimmar };
