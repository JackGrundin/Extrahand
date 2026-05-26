const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaTidrapport({ ansokan_id, foretag_id, anvandare_id, datum, timmar, timlon, totalt_belopp }) {
  const befintlig = await hämtaTidrapportFörAnsökan(ansokan_id);
  if (befintlig) throw Object.assign(new Error('En tidrapport finns redan för denna ansökan'), { kod: 409 });

  const { data, error } = await supabase
    .from('tidrapporter')
    .insert([{ ansokan_id, foretag_id, anvandare_id, datum, timmar, timlon, totalt_belopp, status: 'väntar' }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaTidrapportFörAnsökan(ansokan_id) {
  const { data, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('ansokan_id', ansokan_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function uppdateraTidrapportStatus(id, status) {
  const { error } = await supabase
    .from('tidrapporter')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

async function hämtaAllaTidrapporter({ fromDate, toDate } = {}) {
  let query = supabase
    .from('tidrapporter')
    .select('*')
    .eq('status', 'godkänd')
    .order('datum', { ascending: false });

  if (fromDate) query = query.gte('datum', fromDate);
  if (toDate) query = query.lte('datum', toDate);

  const { data: rapporter, error } = await query;
  if (error) throw error;
  if (!rapporter.length) return [];

  const anvandareIds = [...new Set(rapporter.map(r => r.anvandare_id))];
  const foretagIds = [...new Set(rapporter.map(r => r.foretag_id))];

  const [{ data: anvandare }, { data: foretag }] = await Promise.all([
    supabase.from('användare').select('id, Namn, Email, telefonnummer').in('id', anvandareIds),
    supabase.from('användare').select('id, Namn').in('id', foretagIds),
  ]);

  const anvandareMap = Object.fromEntries((anvandare || []).map(a => [a.id, a]));
  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return rapporter.map(r => ({
    ...r,
    anvandareNamn: anvandareMap[r.anvandare_id]?.Namn ?? null,
    anvandareEmail: anvandareMap[r.anvandare_id]?.Email ?? null,
    anvardareTelefon: anvandareMap[r.anvandare_id]?.telefonnummer ?? null,
    foretagNamn: foretagMap[r.foretag_id]?.Namn ?? null,
  }));
}

async function hämtaTidrapporterFörFöretag(foretagId) {
  const { data: rapporter, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('foretag_id', foretagId)
    .order('datum', { ascending: false });

  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const ansokanIds = rapporter.map(r => r.ansokan_id);
  const anvandareIds = [...new Set(rapporter.map(r => r.anvandare_id))];

  const [{ data: ansokningar }, { data: anvandare }] = await Promise.all([
    supabase.from('ansokningar').select('id, jobb_id').in('id', ansokanIds),
    supabase.from('användare').select('id, Namn').in('id', anvandareIds),
  ]);

  const jobbIds = [...new Set((ansokningar || []).map(a => a.jobb_id))];
  const { data: jobb } = await supabase.from('jobb').select('id, Titel').in('id', jobbIds);

  const ansokanMap = Object.fromEntries((ansokningar || []).map(a => [a.id, a]));
  const anvandareMap = Object.fromEntries((anvandare || []).map(a => [a.id, a]));
  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));

  return rapporter.map(r => {
    const ansökan = ansokanMap[r.ansokan_id];
    return {
      ...r,
      jobbId: ansökan?.jobb_id ?? null,
      jobbTitel: jobbMap[ansökan?.jobb_id]?.Titel ?? null,
      privatpersonNamn: anvandareMap[r.anvandare_id]?.Namn ?? null,
    };
  });
}

async function taBortTidrapport(id) {
  const { error } = await supabase
    .from('tidrapporter')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

module.exports = { skapaTidrapport, hämtaTidrapportFörAnsökan, uppdateraTidrapportStatus, hämtaAllaTidrapporter, hämtaTidrapporterFörFöretag, taBortTidrapport };
