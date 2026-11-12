const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { beräknaFakturapris, påslagEller40, BRUTTO_KOEFFICIENT } = require('../utils/pris');
const { hämtaAllaFöretag, hämtaAllaPrivatpersoner } = require('./användare');
const { nuvarandeMånad } = require('../utils/manad');
const { beräknaLönedatum } = require('../utils/lonedatum');

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
// och påslagsintäkten är skillnaden mot vad arbetet kostar via Invoicery
// (brutto * BRUTTO_KOEFFICIENT, dvs. fakturapriset utan vårt påslag).
async function hämtaStatistik({ from, till } = {}) {
  const sedan30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Tidrapporter-queryn (pengar, timmar och pass) filtreras på passets datum (date-kolumn),
  // samma mönster som hämtaTidrapporterFörAdmin. from/till är YYYY-MM-DD. Användar-räknarna
  // nedan är medvetet OFILTRERADE – de visar alltid totaler oavsett vald period.
  let rapportQuery = supabase.from('tidrapporter').select('timmar, timlon, ob_belopp, paslag').eq('status', 'godkänd');
  if (from) rapportQuery = rapportQuery.gte('datum', from);
  if (till) rapportQuery = rapportQuery.lte('datum', till);

  const [
    { count: antalFöretag },
    { count: antalPrivatpersoner },
    { count: proPrenumeranter },
    { count: nyaAnvändare30d },
    { data: rapporter, error: rapportFel },
  ] = await Promise.all([
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'företag').not('aktiv', 'is', false),
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'privatperson').not('aktiv', 'is', false),
    supabase.from('användare').select('id', { count: 'exact', head: true }).eq('Typ', 'företag').eq('prenumeration_status', 'pro').not('aktiv', 'is', false),
    supabase.from('användare').select('id', { count: 'exact', head: true }).not('aktiv', 'is', false).gte('created_at', sedan30),
    rapportQuery,
  ]);

  if (rapportFel) throw rapportFel;

  // Godkända pass i perioden = antalet godkända tidrapporter (samma dataset som pengar/timmar).
  const godkändaPass = (rapporter || []).length;

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
    // Vår intäkt: det som blir kvar av fakturan när arbetskostnaden via Invoicery
    // (brutto uppräknat med sociala avgifter + Invoicery-avgift = brutto * BRUTTO_KOEFFICIENT)
    // räknats bort.
    påslagsintäkt: fakturerat - bruttolön * BRUTTO_KOEFFICIENT,
    proPrenumeranter: proPrenumeranter ?? 0,
    nyaAnvändare30d: nyaAnvändare30d ?? 0,
  };
}

// Alla tidrapporter för admin, oavsett status (väntar/godkänd/bestridd) och betald-flagga.
// Till skillnad från hämtaAllaTidrapporter (som bara ger godkända obetalda) – admin ska
// kunna se hela bilden och filtrera själv. Valfritt status-filter. Berikas med person-,
// företags- och jobbinfo via samma join-mönster som hämtaAllaTidrapporter.
async function hämtaTidrapporterFörAdmin({ status, from, till } = {}) {
  let query = supabase
    .from('tidrapporter')
    .select('*')
    .order('datum', { ascending: false });
  if (status) query = query.eq('status', status);
  // Tidsfilter på passets datum (date-kolumn). from/till är YYYY-MM-DD.
  if (from) query = query.gte('datum', from);
  if (till) query = query.lte('datum', till);

  const { data: rapporter, error } = await query;
  if (error) throw error;
  if (!rapporter || !rapporter.length) return [];

  const anvandareIds = rapporter.map(r => r.anvandare_id);
  const foretagIds = rapporter.map(r => r.foretag_id);
  const ansokanIds = rapporter.map(r => r.ansokan_id);

  const [anvandare, foretag, ansokningar] = await Promise.all([
    hämtaIBitar(anvandareIds, bit => supabase.from('användare').select('id, Namn, Email, telefonnummer, utbetalning_installning').in('id', bit)),
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
    // Utbetalningsinställningen + härlett lönedatum följer med så att adminvyn kan gruppera
    // godkända '25:e'-pass till en samlad utbetalning (samma berikning som hämtaAllaTidrapporter).
    const installning = anvandareMap[r.anvandare_id]?.utbetalning_installning ?? 'direkt';
    return {
      ...r,
      anvandareNamn: anvandareMap[r.anvandare_id]?.Namn ?? null,
      anvandareEmail: anvandareMap[r.anvandare_id]?.Email ?? null,
      anvandareTelefon: anvandareMap[r.anvandare_id]?.telefonnummer ?? null,
      foretagNamn: foretagMap[r.foretag_id]?.Namn ?? null,
      jobbTitel: j?.Titel ?? null,
      ärSchemapass: j?.schema_id != null,
      utbetalning_installning: installning,
      lonedatum: beräknaLönedatum(r.godkand_at, installning, r.created_at),
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

// Godkända tidrapporter för en period (svensk tidszon). Delas av faktureringsöversikten
// och fakturering-per-företag så att båda vyerna utgår från exakt samma rader. Utan
// from faller den tillbaka på innevarande månad – samma beteende som adminvyn hade
// innan tidsfiltret fanns. Returnerar bruttot (totalt_belopp) + det frysta påslaget;
// fakturabeloppet räknas av anroparen via beräknaFakturapris.
async function hämtaMånadensGodkändaRapporter({ from, till } = {}) {
  // datum är en date-kolumn, så rena 'YYYY-MM-DD'-gränser räcker och undviker
  // tidszonströskel vid månadens första midnatt.
  const undreGräns = from || `${nuvarandeMånad()}-01`;
  let query = supabase
    .from('tidrapporter')
    .select('foretag_id, totalt_belopp, paslag')
    .eq('status', 'godkänd')
    .gte('datum', undreGräns);
  if (till) query = query.lte('datum', till);
  const { data: rapporter, error } = await query;
  if (error) throw error;
  return rapporter || [];
}

// Etikett per fryst påslagsvärde. Samma påslag kan ha flera orsaker (20% = Pro ELLER
// gratis 1–2, 15% = inbjudan-pass ELLER schema) och det frysta värdet bär inte orsaken,
// så etiketterna är medvetet sammanslagna.
const PÅSLAG_ETIKETT = {
  0.07: 'Inbjudan schema',
  0.15: 'Inbjudan pass / Schema',
  0.20: 'Gratis (1–2) / Pro',
  0.40: 'Gratis (3+)',
};

// Faktureringsöversikt för innevarande månad, grupperad på det frysta påslaget.
// Returnerar [{ paslag, etikett, antal, totalFaktura }], sorterad på påslag stigande.
async function hämtaFaktureringsstatistik({ from, till } = {}) {
  const rapporter = await hämtaMånadensGodkändaRapporter({ from, till });

  const perPåslag = new Map();
  for (const r of rapporter) {
    const paslag = påslagEller40(r.paslag);
    const fakturabelopp = beräknaFakturapris(Number(r.totalt_belopp) || 0, paslag);
    const grupp = perPåslag.get(paslag) || { paslag, antal: 0, totalFaktura: 0 };
    grupp.antal += 1;
    grupp.totalFaktura += fakturabelopp;
    perPåslag.set(paslag, grupp);
  }

  return [...perPåslag.values()]
    .sort((a, b) => a.paslag - b.paslag)
    .map(g => ({
      ...g,
      etikett: PÅSLAG_ETIKETT[g.paslag] || `Påslag ${Math.round(g.paslag * 100)}%`,
    }));
}

// Vad vi ska fakturera varje företag denna månad. Returnerar
// [{ foretag_id, foretagsnamn, antal, totalFaktura }], sorterad på belopp fallande.
async function hämtaFaktureringPerFöretag({ from, till } = {}) {
  const rapporter = await hämtaMånadensGodkändaRapporter({ from, till });
  if (!rapporter.length) return [];

  const perFöretag = new Map();
  for (const r of rapporter) {
    const paslag = påslagEller40(r.paslag);
    const fakturabelopp = beräknaFakturapris(Number(r.totalt_belopp) || 0, paslag);
    const nyckel = String(r.foretag_id);
    const grupp = perFöretag.get(nyckel) || { foretag_id: r.foretag_id, antal: 0, totalFaktura: 0 };
    grupp.antal += 1;
    grupp.totalFaktura += fakturabelopp;
    perFöretag.set(nyckel, grupp);
  }

  const företag = await hämtaIBitar(
    [...perFöretag.values()].map(g => g.foretag_id),
    bit => supabase.from('användare').select('id, Namn').in('id', bit)
  );
  const namnMap = Object.fromEntries(företag.map(f => [String(f.id), f.Namn]));

  return [...perFöretag.values()]
    .map(g => ({ ...g, foretagsnamn: namnMap[String(g.foretag_id)] ?? null }))
    .sort((a, b) => b.totalFaktura - a.totalFaktura);
}

module.exports = {
  hämtaStatistik,
  hämtaTidrapporterFörAdmin,
  hämtaFöretagMedStatistik,
  hämtaPrivatpersonerMedStatistik,
  hämtaFaktureringsstatistik,
  hämtaFaktureringPerFöretag,
};
