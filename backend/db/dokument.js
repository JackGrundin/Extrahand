const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Skapar en dokumentrad efter att filen laddats upp till Storage.
async function skapaDokument({ anvandare_id, namn, lagring_path, url, mime_type, storlek }) {
  const { data, error } = await supabase
    .from('dokument')
    .insert([{ anvandare_id, namn, lagring_path, url, mime_type, storlek }])
    .select('id, namn, url, mime_type, storlek, skapad_datum')
    .single();

  if (error) throw error;
  return data;
}

// Dokumenten som visas på profilen, i uppladdningsordning. lagring_path utelämnas
// medvetet – den är en intern Storage-detalj och ska inte läcka till klienten.
async function hämtaDokumentFörAnvändare(anvandare_id) {
  const { data, error } = await supabase
    .from('dokument')
    .select('id, namn, url, mime_type, storlek, skapad_datum')
    .eq('anvandare_id', anvandare_id)
    .order('skapad_datum', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Hela raden inklusive lagring_path och ägare – för ägarkontroll och radering.
async function hämtaDokument(id) {
  const { data, error } = await supabase
    .from('dokument')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Antal dokument en användare har, för att hålla taket på max 10.
async function räknaDokument(anvandare_id) {
  const { count, error } = await supabase
    .from('dokument')
    .select('id', { count: 'exact', head: true })
    .eq('anvandare_id', anvandare_id);

  if (error) throw error;
  return count || 0;
}

async function raderaDokument(id) {
  const { error } = await supabase.from('dokument').delete().eq('id', id);
  if (error) throw error;
}

// Storage-sökvägarna för alla en användares dokument. Används vid kontoradering,
// där både filerna i Storage och raderna måste bort (användarraden raderas aldrig,
// så FK-cascade hjälper inte).
async function hämtaLagringPathsFörAnvändare(anvandare_id) {
  const { data, error } = await supabase
    .from('dokument')
    .select('lagring_path')
    .eq('anvandare_id', anvandare_id);

  if (error) throw error;
  return (data || []).map(d => d.lagring_path);
}

async function raderaAllaDokumentFörAnvändare(anvandare_id) {
  const { error } = await supabase.from('dokument').delete().eq('anvandare_id', anvandare_id);
  if (error) throw error;
}

module.exports = {
  skapaDokument,
  hämtaDokumentFörAnvändare,
  hämtaDokument,
  räknaDokument,
  raderaDokument,
  hämtaLagringPathsFörAnvändare,
  raderaAllaDokumentFörAnvändare,
};
