const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Skapar en ny jobbförfrågan från ett företag till en privatperson
async function skapaJobbforfragan({ fran_anvandare_id, till_anvandare_id, titel, datum, starttid, sluttid, timlon, ob_tillagg }) {
  const { data, error } = await supabase
    .from('jobbforfragan')
    .insert([{
      fran_anvandare_id,
      till_anvandare_id,
      titel: titel || null,
      datum,
      starttid,
      sluttid,
      timlon,
      ob_tillagg: Array.isArray(ob_tillagg) ? ob_tillagg : [],
      status: 'väntar',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Hämtar alla förfrågningar mellan två användare (oavsett riktning), nyast först
async function hämtaJobbforfraganMellan(anvandareA, anvandareB) {
  const { data, error } = await supabase
    .from('jobbforfragan')
    .select('*')
    .or(`and(fran_anvandare_id.eq.${anvandareA},till_anvandare_id.eq.${anvandareB}),and(fran_anvandare_id.eq.${anvandareB},till_anvandare_id.eq.${anvandareA})`)
    .order('skapad_datum', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Väntande jobbförfrågningar SOM PERSONEN FÅTT (inkommande), nyast först. Matar
// Förfrågningar-fliken i Meddelanden, så fulla fält + avsändarens företagsnamn berikas.
// Bara 'väntar' = inte redan accepterad (en accepterad ger ett riktigt pass + godkänd
// ansökan). Filtrerar på till_anvandare_id: ett företag skickar, en privatperson tar emot.
async function hämtaVäntandeFörAnvändare(userId) {
  const { data, error } = await supabase
    .from('jobbforfragan')
    .select('id, fran_anvandare_id, till_anvandare_id, titel, datum, starttid, sluttid, timlon, ob_tillagg, status, skapad_datum')
    .eq('status', 'väntar')
    .eq('till_anvandare_id', userId)
    .order('skapad_datum', { ascending: false });

  if (error) throw error;
  const förfrågningar = data || [];
  if (!förfrågningar.length) return [];

  const franIds = [...new Set(förfrågningar.map(f => f.fran_anvandare_id).filter(Boolean))];
  const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', franIds);
  const namnMap = Object.fromEntries((foretag || []).map(f => [f.id, f.Namn]));

  return förfrågningar.map(f => ({ ...f, företagNamn: namnMap[f.fran_anvandare_id] ?? null }));
}

async function hämtaJobbforfraganViaId(id) {
  const { data, error } = await supabase
    .from('jobbforfragan')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function uppdateraJobbforfraganStatus(id, status) {
  const { error } = await supabase
    .from('jobbforfragan')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

module.exports = {
  skapaJobbforfragan,
  hämtaJobbforfraganMellan,
  hämtaVäntandeFörAnvändare,
  hämtaJobbforfraganViaId,
  uppdateraJobbforfraganStatus,
};
