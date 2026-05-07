const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaJobb({ titel, beskrivning, plats, lon, typ, foretag_id }) {
  const { data, error } = await supabase
    .from('Jobb')
    .insert([{ Titel: titel, Beskrivning: beskrivning, Plats: plats, Lon: lon, Typ: typ, Foretag_id: foretag_id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAllaJobb() {
  const { data, error } = await supabase
    .from('Jobb')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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
