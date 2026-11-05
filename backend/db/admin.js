const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { beräknaFakturapris, påslagEller40 } = require('../utils/pris');
const { hämtaAllaFöretag, hämtaAllaPrivatpersoner } = require('./användare');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// PostgREST skickar .in()-listor i URL:en, som har en längdgräns. Samma skäl som CHUNK i
// db/ansokningar.js och db/betyg.js: dela upp stora id-listor och slå ihop resultaten.
const CHUNK = 500;

async function hämtaIBitar(ids, hämta) {
  const unika = [...new Set((ids || []).filter(id => id != null))];
  if (!unika.length) return [];
  const alla = [];
  for (let i = 0; i < unika.length; i += CHUNK) {
    const { data, error } = await hämta(unika.slice(i, i + CHUNK));
    if (error) throw error;
    alla.push(...(data || []));
  }
  return alla;
}

// Dashboard-statistik i ETT anrop. Siffrorna speglar faktiska pengar: fakturerat räknas
// via beräknaFakturapris (samma formel som faktureringsvyn), bruttolön är arbetskostnaden
// och påslagsintäkten är skillnaden efter sociala avgifter + semester (brutto * 1.38).
async function hämtaStatistik() {
  const sedan30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: antalFöretag },
    { count: antalPrivatpersoner },
    { count: godkändaPass },
    { count: proPrenumeranter },
    { count: nyaAnvändare30d },
    { data: rapporter, error: rapportFel },
  ] = await Promise.all([
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'företag').not('aktiv', 'is', false),
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'privatperson').not('aktiv', 'is', false),
    supabase.from('ansokningar').select('id', { count: 'exact', head: true }).eq('status', 'godkänd'),
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'företag').eq('prenumeration_status', 'pro').not('aktiv', 'is', false),
    supabase.from('användare').select('id', { count: 'exact', head: true }).not('aktiv', 'is', false).gte('created_at', sedan30),
    supabase.from('tidrapporter').select('timmar, timlon, ob_belopp, paslag').eq('status', 'godkänd'),
  ]);

  if (rapportFel) throw rapportFel;

  let totaltTimmar = 0;
  let bruttolön = 0;
  let fakturerat = 0;
  for (const r of rapporter || []) {
    const timmar = Number(r.timmar) || 0;
    const brutto = timmar * (Number(r.timlon) || 0) + (Number(r.ob_belopp) || 0);
    totaltTimmar += timmar;
    bruttolön += brutto;
    fakturerat += beräknaFakturapris(brutto, påslagEller40(r.paslag));
  }

  return {
    antalFöretag: antalFöretag ?? 0,
    antalPrivatpersoner: antalPrivatpersoner ?? 0,
    antalAnvändare: (antalFöretag ?? 0) + (antalPrivatpersoner ?? 0),
    godkändaPass: godkändaPass ?? 0,
    totaltTimmar,
    bruttolön,
    fakturerat,
    // Vår intäkt: det som blir kvar av fakturan när arbetskostnaden (brutto + 32% sociala
    // avgifter + 6% semester = brutto * 1.38) räknats bort.
    påslagsintäkt: fakturerat - bruttolön * 1.38,
    proPrenumeranter: proPrenumeranter ?? 0,
    nyaAnvändare30d: nyaAnvändare30d ?? 0,
  };
}

// Alla tidrapporter för admin, oavsett status (väntar/godkänd/bestridd) och betald-flagga.
// Till skillnad från hämtaAllaTidrapporter (som bara ger godkända obetalda) – admin ska
// kunna se hela bilden och filtrera själv. Valfritt status-filter. Berikas med person-,
// företags- och jobbinfo via samma join-mönster som hämtaAllaTidrapporter.
async function hämtaTidrapporterFörAdmin({ status } = {}) {
  let query = supabase
    .from('tidrapporter')
    .select('*')
    .order('datum', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data: rapporter, error } = await query;
  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const anvandareIds = rapporter.map(r => r.anvandare_id);
  const foretagIds = rapporter.map(r => r.foretag_id);
  const ansokanIds = rapporter.map(r => r.ansokan_id);

  const [anvandare, foretag, ansokningar] = await Promise.all([
    hämtaIBitar(anvandareIds, bit => supabase.from('användare').select('id, Namn, Email, telefonnummer').in('id', bit)),
    hämtaIBitar(foretagIds, bit => supabase.from('användare').select('id, Namn').in('id', bit)),
    hämtaIBitar(ansokanIds, bit => supabase.from('ansokningar').select('id, jobb_id').in('id', bit)),
  ]);

  const jobbIds = ansokningar.map(a => a.jobb_id);
  const jobb = await hämtaIBitar(jobbIds, bit => supabase.from('Jobb').select('id, Titel, schema_id').in('id', bit));

  const anvandareMap = Object.fromEntries(anvandare.map(a => [a.id, a]));
  const foretagMap = Object.fromEntries(foretag.map(f => [f.id, f]));
  const ansokanMap = Object.fromEntries(ansokningar.map(a => [a.id, a]));
  const jobbMap = Object.fromEntries(jobb.map(j => [j.id, j]));

  return rapporter.map(r => {
    const j = jobbMap[ansokanMap[r.ansokan_id]?.jobb_id];
    return {
      ...r,
      anvandareNamn: anvandareMap[r.anvandare_id]?.Namn ?? null,
      anvandareEmail: anvandareMap[r.anvandare_id]?.Email ?? null,
      anvandareTelefon: anvandareMap[r.anvandare_id]?.telefonnummer ?? null,
      foretagNamn: foretagMap[r.foretag_id]?.Namn ?? null,
      jobbTitel: j?.Titel ?? null,
      ärSchemapass: j?.schema_id != null,
    };
  });
}

// Företagslistan berikad med antal godkända pass. hämtaAllaFöretag ger redan antalJobb +
// prenumeration_status; här läggs godkändaPass till genom att räkna godkända ansökningar
// mot företagets jobb.
async function hämtaFöretagMedStatistik() {
  const företag = await hämtaAllaFöretag();
  if (!företag.length) return [];

  // Alla godkända ansökningar → deras jobb → företag. Vi vet inte jobb-id:na i förväg, så
  // hämta godkända ansökningar och slå upp motsvarande jobbs Foretag_id.
  const { data: godkända, error } = await supabase
    .from('ansokningar')
    .select('jobb_id')
    .eq('status', 'godkänd');
  if (error) throw error;

  const jobb = await hämtaIBitar((godkända || []).map(a => a.jobb_id), bit =>
    supabase.from('Jobb').select('id, Foretag_id').in('id', bit));
  const jobbTillFöretag = Object.fromEntries(jobb.map(j => [String(j.id), j.Foretag_id]));

  const passRäkning = {};
  for (const a of godkända || []) {
    const fid = jobbTillFöretag[String(a.jobb_id)];
    if (fid != null) passRäkning[String(fid)] = (passRäkning[String(fid)] || 0) + 1;
  }

  return företag.map(f => ({ ...f, godkändaPass: passRäkning[String(f.id)] ?? 0 }));
}

// Privatpersonslistan berikad med genomförda pass (godkända ansökningar) + betygssnitt.
async function hämtaPrivatpersonerMedStatistik() {
  const personer = await hämtaAllaPrivatpersoner();
  if (!personer.length) return [];

  const personIds = personer.map(p => p.id);

  const [ansökningar, betyg] = await Promise.all([
    hämtaIBitar(personIds, bit => supabase.from('ansokningar').select('sokande_id').eq('status', 'godkänd').in('sokande_id', bit)),
    hämtaIBitar(personIds, bit => supabase.from('betyg').select('till_anvandare_id, stjarnor').in('till_anvandare_id', bit)),
  ]);

  const passRäkning = {};
  for (const a of ansökningar) {
    if (a.sokande_id != null) passRäkning[String(a.sokande_id)] = (passRäkning[String(a.sokande_id)] || 0) + 1;
  }

  const betygAck = {};
  for (const b of betyg) {
    const nyckel = String(b.till_anvandare_id);
    const ack = betygAck[nyckel] || (betygAck[nyckel] = { summa: 0, antal: 0 });
    ack.summa += Number(b.stjarnor) || 0;
    ack.antal += 1;
  }

  return personer.map(p => {
    const ack = betygAck[String(p.id)];
    return {
      ...p,
      genomfördaPass: passRäkning[String(p.id)] ?? 0,
      betygSnitt: ack && ack.antal ? parseFloat((ack.summa / ack.antal).toFixed(1)) : null,
      betygAntal: ack ? ack.antal : 0,
    };
  });
}

module.exports = {
  hämtaStatistik,
  hämtaTidrapporterFörAdmin,
  hämtaFöretagMedStatistik,
  hämtaPrivatpersonerMedStatistik,
};
