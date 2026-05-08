const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaJobb({ titel, beskrivning, plats, lon, typ, kategori, antal_dagar, arbetstider, foretag_id }) {
  const { data, error } = await supabase
    .from('Jobb')
    .insert([{ Titel: titel, Beskrivning: beskrivning, Plats: plats, Lon: lon, Typ: typ, Kategori: kategori, antal_dagar, arbetstider, Foretag_id: foretag_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAllaJobb() {
  const { data: jobb, error } = await supabase
    .from('Jobb')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!jobb.length) return [];

  const foretagIds = [...new Set(
    jobb.map(j => j.Foretag_id ?? j.foretag_id).filter(id => id != null)
  )];
  const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);
  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return jobb.map(j => ({
    ...j,
    foretagNamn: (() => {
      const fid = j.Foretag_id ?? j.foretag_id;
      return foretagMap[fid]?.Namn ?? null;
    })(),
  }));
}

async function hämtaJobbViaId(id) {
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

module.exports = { skapaJobb, hämtaAllaJobb, hämtaJobbViaId };
