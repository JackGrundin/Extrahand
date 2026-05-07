const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skickaMeddelande({ ansokan_id, avsandare_id, innehall }) {
  const { data, error } = await supabase
    .from('meddelanden')
    .insert([{ ansokan_id, avsandare_id, innehall }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaMeddelanden(ansokan_id) {
  const { data, error } = await supabase
    .from('meddelanden')
    .select('*')
    .eq('ansokan_id', ansokan_id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

module.exports = { skickaMeddelande, hämtaMeddelanden };
