const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { beräknaFakturapris, påslagEller40 } = require('../utils/pris');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Hämtar alla godkända tidrapporter som inte är fakturerade, med företagsinfo
async function hämtaFaktureringsunderlag() {
  const { data: rapporter, error } = await supabase
    .from('tidrapporter')
    .select('*')
    .eq('status', 'godkänd')
    .neq('fakturerad', true)
    .eq('betald', false)
    .order('datum', { ascending: true });
  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const foretagIds = [...new Set(rapporter.map(r => r.foretag_id))];
  const ansokanIds = [...new Set(rapporter.map(r => r.ansokan_id))];

  const [{ data: företag }, { data: ansokningar }] = await Promise.all([
    supabase
      .from('användare')
      .select('id, Namn, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson')
      .in('id', foretagIds),
    supabase.from('ansokningar').select('id, jobb_id').in('id', ansokanIds),
  ]);

  // Jobbtiteln så att den som fakturerar ser vilket pass/schema en rad avser, och
  // schema_id för att kunna märka schemapass.
  const jobbIds = [...new Set((ansokningar || []).map(a => a.jobb_id))];
  const { data: jobb } = await supabase.from('Jobb').select('id, Titel, schema_id').in('id', jobbIds);

  const företagMap = Object.fromEntries((företag || []).map(f => [f.id, f]));
  const ansokanMap = Object.fromEntries((ansokningar || []).map(a => [a.id, a]));
  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));

  return rapporter.map(r => {
    const f = företagMap[r.foretag_id] || {};
    const j = jobbMap[ansokanMap[r.ansokan_id]?.jobb_id];
    // Påslaget frystes när jobbet publicerades. Rapporter från före prenumerations-
    // systemet saknar påslag och faktureras med 40%.
    const paslag = påslagEller40(r.paslag);
    const faktureringsbelopp = beräknaFakturapris(r.timmar * r.timlon + (r.ob_belopp || 0), paslag);
    return {
      id: r.id,
      datum: r.datum,
      timmar: r.timmar,
      timlon: r.timlon,
      ob_belopp: r.ob_belopp || 0,
      paslag,
      faktureringsbelopp,
      // Löneavdragen påverkar INTE faktureringsbeloppet – företaget faktureras på bruttot
      // precis som förut. De följer med hit enbart som information, så att den som
      // fakturerar kan se varför personens utbetalning skiljer sig från arbetskostnaden.
      // Returobjektet är en explicit vitlista, så nya kolumner måste läggas till här för
      // att synas (till skillnad från hämtaAllaTidrapporter som gör select('*')).
      avdrag: Array.isArray(r.avdrag) ? r.avdrag : [],
      avdrag_belopp: r.avdrag_belopp || 0,
      jobbTitel: j?.Titel ?? null,
      ärSchemapass: j?.schema_id != null,
      foretagsnamn: f.Namn ?? null,
      organisationsnummer: f.organisationsnummer ?? null,
      fakturaadress: f.fakturaadress ?? null,
      postnummer: f.postnummer ?? null,
      ort: f.ort ?? null,
      fakturamail: f.fakturamail ?? null,
      referensperson: f.referensperson ?? null,
    };
  });
}

async function markeraFakturerad(id) {
  const { error } = await supabase
    .from('tidrapporter')
    .update({ fakturerad: true })
    .eq('id', id);
  if (error) throw error;
}

module.exports = { hämtaFaktureringsunderlag, markeraFakturerad };
