const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaAnvändare({ namn, email, lösenord, typ }) {
  const { data, error } = await supabase
    .from('användare')
    .insert([{ Namn: namn, Email: email, Lösenord: lösenord, Typ: typ }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAnvändareViaEmail(email) {
  const { data, error } = await supabase
    .from('användare')
    .select('*')
    .eq('Email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function hämtaAnvändareViaId(id) {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Email, Typ, created_at')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

module.exports = { skapaAnvändare, hämtaAnvändareViaEmail, hämtaAnvändareViaId };
