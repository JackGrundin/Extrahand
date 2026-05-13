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
    arbetstider: jobbMap[a.jobb_id]?.arbetstider ?? null,
    antalDagar: jobbMap[a.jobb_id]?.antal_dagar ?? null,
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
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('jobb_id', jobb_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id).filter(Boolean))];
  const { data: sökande } = await supabase.from('användare').select('id, Namn').in('id', sokandeIds);
  const sökandeMap = Object.fromEntries((sökande || []).map(s => [s.id, s]));

  return ansökningar.map(a => ({
    ...a,
    sökandeNamn: sökandeMap[a.sokande_id]?.Namn ?? null,
  }));
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

async function uppdateraStatus(id, status) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

async function hämtaAnsökanViaId(id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function hämtaAllaKonversationerFörFöretag(foretag_id) {
  const { data: jobb } = await supabase
    .from('Jobb')
    .select('id, Titel')
    .eq('Foretag_id', foretag_id);

  if (!jobb || !jobb.length) return [];

  const jobbIds = jobb.map(j => j.id);
  const jobbMap = Object.fromEntries(jobb.map(j => [j.id, j]));

  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .in('jobb_id', jobbIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id).filter(Boolean))];
  const { data: sökande } = await supabase.from('användare').select('id, Namn').in('id', sokandeIds);
  const sökandeMap = Object.fromEntries((sökande || []).map(s => [s.id, s]));

  return ansökningar.map(a => ({
    ...a,
    sökandeNamn: sökandeMap[a.sokande_id]?.Namn ?? null,
    jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
  }));
}

async function avvisaAllaUtomEn(jobb_id, godkänd_id) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ status: 'avvisad' })
    .eq('jobb_id', jobb_id)
    .neq('id', godkänd_id);
  if (error) throw error;
}

async function återställAllaFörJobb(jobb_id) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ status: 'väntande' })
    .eq('jobb_id', jobb_id);
  if (error) throw error;
}

module.exports = { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, hämtaTotalTimmar, uppdateraTimmar, uppdateraStatus, hämtaAnsökanViaId, avvisaAllaUtomEn, återställAllaFörJobb, hämtaAllaKonversationerFörFöretag };
