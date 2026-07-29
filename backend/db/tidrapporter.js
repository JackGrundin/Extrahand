const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaTidrapport({ ansokan_id, foretag_id, anvandare_id, datum, timmar, timlon, ob_belopp, ob_tillagg, totalt_belopp, paslag, auto_skapad = false, avdrag = [], avdrag_belopp = 0 }) {
  // Blockera bara om det redan finns en aktiv tidrapport (väntar på svar eller godkänd).
  // En bestridd tidrapport får ersättas av en ny korrigerad rapport.
  const befintlig = await hämtaTidrapportFörAnsökan(ansokan_id);
  if (befintlig && befintlig.status !== 'bestridd') {
    throw Object.assign(new Error('En aktiv tidrapport finns redan för denna ansökan'), { kod: 409 });
  }

  const { data, error } = await supabase
    .from('tidrapporter')
    .insert([{ ansokan_id, foretag_id, anvandare_id, datum, timmar, timlon, ob_belopp: ob_belopp || 0, ob_tillagg: ob_tillagg || [], totalt_belopp, paslag, status: 'väntar', auto_skapad, avdrag: avdrag || [], avdrag_belopp: avdrag_belopp || 0 }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Korrigerar en automatiskt skapad tidrapport PÅ PLATS, så länge den fortfarande väntar
// på svar. Schemapass rapporteras med schemalagda timmar; blev det övertid eller rast ska
// företaget kunna rätta siffran utan att lägga ett andra kort i chatten. Efter ett
// bestridande gäller i stället det vanliga flödet: en ny rapport via skapaTidrapport.
async function uppdateraAutoTidrapport(id, foretag_id, { timmar, ob_belopp, ob_tillagg, totalt_belopp, avdrag_belopp }) {
  const { data, error } = await supabase
    .from('tidrapporter')
    .update({
      timmar,
      ob_belopp: ob_belopp || 0,
      ob_tillagg: ob_tillagg || [],
      totalt_belopp,
      // avdrag-arrayen rörs inte – bara summan, som kan behöva klampas mot ett lägre brutto.
      ...(avdrag_belopp != null ? { avdrag_belopp } : {}),
    })
    .eq('id', id)
    .eq('foretag_id', foretag_id)
    .eq('auto_skapad', true)
    .eq('status', 'väntar')
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Returnerar den senaste tidrapporten för en ansökan (det kan nu finnas flera, där
// äldre är bestridda och ersatta av korrigerade rapporter).
async function hämtaTidrapportFörAnsökan(ansokan_id) {
  const { data, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('ansokan_id', ansokan_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function uppdateraTidrapportStatus(id, status, bestridande_orsak) {
  const fält = { status };
  if (status === 'bestridd') fält.bestridande_orsak = bestridande_orsak ?? null;
  const { error } = await supabase
    .from('tidrapporter')
    .update(fält)
    .eq('id', id);

  if (error) throw error;
}

async function hämtaAllaTidrapporter({ fromDate, toDate } = {}) {
  let query = supabase
    .from('tidrapporter')
    .select('*')
    .eq('status', 'godkänd')
    .eq('betald', false)
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
  const { data: allaRapporter, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('foretag_id', foretagId)
    .order('datum', { ascending: false });

  if (error) throw error;
  if (!allaRapporter || !allaRapporter.length) return [];

  // En ansökan kan ha flera tidrapporter (bestridd + korrigerad). Visa bara den
  // senaste per ansökan så att "Tidigare pass" inte dubbleras.
  const senastePerAnsökan = {};
  for (const r of allaRapporter) {
    const befintlig = senastePerAnsökan[r.ansokan_id];
    if (!befintlig || new Date(r.created_at ?? r.datum) > new Date(befintlig.created_at ?? befintlig.datum)) {
      senastePerAnsökan[r.ansokan_id] = r;
    }
  }
  const rapporter = Object.values(senastePerAnsökan);

  const ansokanIds = rapporter.map(r => r.ansokan_id);
  const anvandareIds = [...new Set(rapporter.map(r => r.anvandare_id))];

  const [{ data: ansokningar }, { data: anvandare }] = await Promise.all([
    supabase.from('ansokningar').select('id, jobb_id').in('id', ansokanIds),
    supabase.from('användare').select('id, Namn').in('id', anvandareIds),
  ]);

  const jobbIds = [...new Set((ansokningar || []).map(a => a.jobb_id))];
  const { data: jobb } = await supabase.from('Jobb').select('id, Titel').in('id', jobbIds);

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

async function hämtaTidrapportViaId(id) {
  const { data, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Markerar en tidrapport som betald (mjuk markering – raden behålls för historiken)
async function markeraTidrapportBetald(id) {
  const { error } = await supabase
    .from('tidrapporter')
    .update({ betald: true })
    .eq('id', id);
  if (error) throw error;
}

module.exports = { skapaTidrapport, uppdateraAutoTidrapport, hämtaTidrapportFörAnsökan, hämtaTidrapportViaId, uppdateraTidrapportStatus, hämtaAllaTidrapporter, hämtaTidrapporterFörFöretag, markeraTidrapportBetald };
