const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaAnvändare({ namn, email, lösenord, typ, beskrivning, bransch, stad, hemsida, telefonnummer }) {
  const { data, error } = await supabase
    .from('användare')
    .insert([{ Namn: namn, Email: email, Lösenord: lösenord, Typ: typ, beskrivning, bransch, stad, hemsida, telefonnummer }])
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
    .select('id, Namn, Typ, created_at, cv, erfarenheter, kompetenser, intressen, profil_bild, beskrivning, bransch, stad, hemsida, telefonnummer')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

async function uppdateraProfilBild(id, url) {
  const { error } = await supabase.from('användare').update({ profil_bild: url }).eq('id', id);
  if (error) throw error;
}

async function uppdateraProfil(id, { cv, erfarenheter, kompetenser, intressen, beskrivning, bransch, stad, hemsida, telefonnummer }) {
  const { error } = await supabase
    .from('användare')
    .update({ cv, erfarenheter, kompetenser, intressen, beskrivning, bransch, stad, hemsida, telefonnummer })
    .eq('id', id);
  if (error) throw error;
}

async function sparaPushToken(id, token) {
  const { error } = await supabase
    .from('användare')
    .update({ push_token: token })
    .eq('id', id);
  if (error) throw error;
}

async function hämtaPushToken(id) {
  const { data } = await supabase
    .from('användare')
    .select('push_token')
    .eq('id', id)
    .single();
  return data?.push_token || null;
}

async function hämtaAllaFöretag() {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Email, telefonnummer, created_at')
    .eq('Typ', 'företag')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || !data.length) return [];

  const { data: jobb } = await supabase
    .from('jobb')
    .select('Foretag_id');

  const jobbRäkning = (jobb || []).reduce((acc, j) => {
    const fid = j.Foretag_id;
    if (fid != null) acc[fid] = (acc[fid] || 0) + 1;
    return acc;
  }, {});

  return data.map(f => ({ ...f, antalJobb: jobbRäkning[f.id] ?? 0 }));
}

async function hämtaAllaPrivatpersoner() {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Email, telefonnummer, avtal_godkant, created_at')
    .eq('Typ', 'privatperson')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function godkännAvtal(id) {
  const { error } = await supabase
    .from('användare')
    .update({ avtal_godkant: true })
    .eq('id', id);
  if (error) throw error;
}

module.exports = { skapaAnvändare, hämtaAnvändareViaEmail, hämtaAnvändareViaId, uppdateraProfil, uppdateraProfilBild, sparaPushToken, hämtaPushToken, hämtaAllaPrivatpersoner, godkännAvtal, hämtaAllaFöretag };
