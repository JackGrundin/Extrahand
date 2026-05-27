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
    .insert([{ jobb_id, sokande_id, meddelande, status: 'väntande' }])
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
  const ansökningsIds = ansökningar.map(a => a.id);

  const [{ data: jobb }, { data: tidrapporter }, { data: meddelanden }] = await Promise.all([
    supabase.from('Jobb').select('*').in('id', jobbIds),
    supabase.from('tidrapporter').select('ansokan_id, status').in('ansokan_id', ansökningsIds),
    supabase.from('meddelanden').select('ansokan_id, avsandare_id, created_at').in('ansokan_id', ansökningsIds).order('created_at', { ascending: false }),
  ]);

  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));
  const rapportMap = Object.fromEntries((tidrapporter || []).map(r => [r.ansokan_id, r.status]));
  const senasteMap = {};
  for (const m of (meddelanden || [])) {
    if (!senasteMap[m.ansokan_id]) senasteMap[m.ansokan_id] = m;
  }

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
    rapportStatus: rapportMap[a.id] ?? null,
    senasteMeddelande: senasteMap[a.id] ?? null,
    foretagNamn: (() => {
      const j = jobbMap[a.jobb_id];
      const fid = j?.Foretag_id ?? j?.foretag_id;
      return foretagMap[fid]?.Namn ?? null;
    })(),
  }));
}

async function hämtaTotalTimmar(sokande_id) {
  const { data: ansokningar } = await supabase
    .from('ansokningar')
    .select('id')
    .eq('sokande_id', sokande_id)
    .eq('status', 'godkänd');

  if (!ansokningar || !ansokningar.length) return 0;

  const ansokanIds = ansokningar.map(a => a.id);
  const { data } = await supabase
    .from('tidrapporter')
    .select('timmar')
    .eq('anvandare_id', sokande_id)
    .eq('status', 'godkänd')
    .in('ansokan_id', ansokanIds);

  return (data || []).reduce((sum, r) => sum + (r.timmar || 0), 0);
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
    .select('id, Titel, arbetstider, antal_dagar')
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

  const ansökningsIds = ansökningar.map(a => a.id);
  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id).filter(Boolean))];

  const [{ data: sökande }, { data: tidrapporter }, { data: meddelanden }] = await Promise.all([
    supabase.from('användare').select('id, Namn').in('id', sokandeIds),
    supabase.from('tidrapporter').select('ansokan_id, status').in('ansokan_id', ansökningsIds),
    supabase.from('meddelanden').select('ansokan_id, avsandare_id, created_at').in('ansokan_id', ansökningsIds).order('created_at', { ascending: false }),
  ]);

  const sökandeMap = Object.fromEntries((sökande || []).map(s => [s.id, s]));
  const rapportMap = Object.fromEntries((tidrapporter || []).map(r => [r.ansokan_id, r.status]));
  const senasteMap = {};
  for (const m of (meddelanden || [])) {
    if (!senasteMap[m.ansokan_id]) senasteMap[m.ansokan_id] = m;
  }

  return ansökningar.map(a => ({
    ...a,
    sökandeNamn: sökandeMap[a.sokande_id]?.Namn ?? null,
    jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
    arbetstider: jobbMap[a.jobb_id]?.arbetstider ?? null,
    antalDagar: jobbMap[a.jobb_id]?.antal_dagar ?? null,
    rapportStatus: rapportMap[a.id] ?? null,
    senasteMeddelande: senasteMap[a.id] ?? null,
  }));
}

async function hämtaGodkändaFörJobb(jobb_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('id, sokande_id')
    .eq('jobb_id', jobb_id)
    .eq('status', 'godkänd');
  if (error) throw error;
  return data || [];
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

async function ångraAnsökan(id, sokande_id) {
  const { error } = await supabase
    .from('ansokningar')
    .delete()
    .eq('id', id)
    .eq('sokande_id', sokande_id)
    .eq('status', 'väntande');
  if (error) throw error;
}

async function hämtaAnsökanMedJobbInfo(id) {
  const { data: ansökan, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !ansökan) return null;

  const { data: jobb } = await supabase
    .from('Jobb')
    .select('Titel, arbetstider, antal_dagar, Foretag_id')
    .eq('id', ansökan.jobb_id)
    .single();

  return {
    ...ansökan,
    jobbTitel: jobb?.Titel ?? null,
    arbetstider: jobb?.arbetstider ?? null,
    antalDagar: jobb?.antal_dagar ?? null,
    foretagId: jobb?.Foretag_id ?? null,
  };
}

module.exports = { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, hämtaTotalTimmar, uppdateraStatus, hämtaAnsökanViaId, avvisaAllaUtomEn, återställAllaFörJobb, hämtaAllaKonversationerFörFöretag, hämtaGodkändaFörJobb, ångraAnsökan, hämtaAnsökanMedJobbInfo };
