const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

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
    .eq('fakturerad', false)
    .order('datum', { ascending: true });
  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const foretagIds = [...new Set(rapporter.map(r => r.foretag_id))];
  const { data: företag } = await supabase
    .from('användare')
    .select('id, Namn, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson')
    .in('id', foretagIds);

  const företagMap = Object.fromEntries((företag || []).map(f => [f.id, f]));

  return rapporter.map(r => {
    const f = företagMap[r.foretag_id] || {};
    const faktureringsbelopp = (r.timmar * r.timlon + (r.ob_belopp || 0)) * 1.32 * 1.06 * 1.40;
    return {
      id: r.id,
      datum: r.datum,
      timmar: r.timmar,
      timlon: r.timlon,
      ob_belopp: r.ob_belopp || 0,
      faktureringsbelopp,
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
