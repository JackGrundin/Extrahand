const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { hämtaVäntandeFörAnvändare } = require('./jobbforfragan');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// PostgREST skickar .in()-listor i URL:en, som har en längdgräns. Ett schema med 60 pass
// ger 60 ansökningar per person, så listorna växer snabbt förbi den gränsen och anropet
// skulle svara 414. Kör frågan i bitar och slå ihop resultaten i stället.
const CHUNK = 500;

async function hämtaIBitar(ids, hämta) {
  const unika = [...new Set(ids.filter(id => id != null))];
  if (!unika.length) return [];
  const alla = [];
  for (let i = 0; i < unika.length; i += CHUNK) {
    const { data, error } = await hämta(unika.slice(i, i + CHUNK));
    if (error) throw error;
    alla.push(...(data || []));
  }
  return alla;
}

// Väver in tidrapporter i "senaste aktivitet" per ansökan. En ny tidrapport ska räknas
// som ett oläst meddelande, med företaget som avsändare (samma logik som vanliga
// meddelanden: mottagaren får röd prick och badge, avsändaren gör det inte).
function vävInTidrapporter(senasteMap, tidrapporter) {
  for (const r of (tidrapporter || [])) {
    if (!r.created_at) continue;
    const befintlig = senasteMap[r.ansokan_id];
    if (!befintlig || new Date(r.created_at) > new Date(befintlig.created_at)) {
      senasteMap[r.ansokan_id] = {
        ansokan_id: r.ansokan_id,
        avsandare_id: r.foretag_id,
        created_at: r.created_at,
        innehall: 'Tidrapport',
      };
    }
  }
}

async function skapaAnsökan({ jobb_id, sokande_id, meddelande }) {
  const { data, error } = await supabase
    .from('ansokningar')
    .insert([{ jobb_id, sokande_id, meddelande, status: 'väntande' }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAnsökningarFörSökande(sokande_id) {
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('sokande_id', sokande_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const jobbIds = [...new Set(ansökningar.map(a => a.jobb_id))];
  const ansökningsIds = ansökningar.map(a => a.id);

  const [jobb, tidrapporter, meddelanden] = await Promise.all([
    hämtaIBitar(jobbIds, bit => supabase.from('Jobb').select('*').in('id', bit)),
    hämtaIBitar(ansökningsIds, bit => supabase.from('tidrapporter').select('ansokan_id, status, created_at, foretag_id').in('ansokan_id', bit).order('created_at', { ascending: true })),
    hämtaIBitar(ansökningsIds, bit => supabase.from('meddelanden').select('ansokan_id, avsandare_id, created_at, innehall').in('ansokan_id', bit).order('created_at', { ascending: false })),
  ]);

  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));
  const rapportMap = Object.fromEntries((tidrapporter || []).map(r => [r.ansokan_id, r.status]));
  const senasteMap = {};
  for (const m of (meddelanden || [])) {
    if (!senasteMap[m.ansokan_id]) senasteMap[m.ansokan_id] = m;
  }
  vävInTidrapporter(senasteMap, tidrapporter);

  const foretagIds = [...new Set(
    (jobb || []).map(j => j.Foretag_id ?? j.foretag_id).filter(id => id != null)
  )];
  const { data: foretag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);

  const foretagMap = Object.fromEntries((foretag || []).map(f => [f.id, f]));

  return ansökningar.map(a => ({
    ...a,
    jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
    arbetstider: jobbMap[a.jobb_id]?.arbetstider ?? null,
    antalDagar: jobbMap[a.jobb_id]?.antal_dagar ?? null,
    // Mina pass använder dessa för att visa ETT samlat schemakort under Kommande
    // (annons-ansökan) och varje genomfört pass för sig under Genomförda.
    schemaId: jobbMap[a.jobb_id]?.schema_id ?? null,
    schemaPassId: jobbMap[a.jobb_id]?.schema_pass_id ?? null,
    rapportStatus: rapportMap[a.id] ?? null,
    senasteMeddelande: senasteMap[a.id] ?? null,
    foretagId: (() => {
      const j = jobbMap[a.jobb_id];
      return j?.Foretag_id ?? j?.foretag_id ?? null;
    })(),
    foretagNamn: (() => {
      const j = jobbMap[a.jobb_id];
      const fid = j?.Foretag_id ?? j?.foretag_id;
      return foretagMap[fid]?.Namn ?? null;
    })(),
  }));
}

async function hämtaTotalTimmar(sokande_id) {
  const { data: ansokningar } = await supabase
    .from('ansokningar')
    .select('id')
    .eq('sokande_id', sokande_id)
    .eq('status', 'godkänd');

  if (!ansokningar || !ansokningar.length) return 0;

  const ansokanIds = ansokningar.map(a => a.id);
  const rapporter = await hämtaIBitar(ansokanIds, bit =>
    supabase
      .from('tidrapporter')
      .select('timmar')
      .eq('anvandare_id', sokande_id)
      .eq('status', 'godkänd')
      .in('ansokan_id', bit)
  );

  return rapporter.reduce((sum, r) => sum + (r.timmar || 0), 0);
}


async function hämtaAnsökningarFörJobb(jobb_id) {
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('jobb_id', jobb_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id).filter(Boolean))];
  const { data: sökande } = await supabase.from('användare').select('id, Namn').in('id', sokandeIds);
  const sökandeMap = Object.fromEntries((sökande || []).map(s => [s.id, s]));

  return ansökningar.map(a => ({
    ...a,
    sökandeNamn: sökandeMap[a.sokande_id]?.Namn ?? null,
  }));
}

async function finnsDubblettAnsökan(jobb_id, sokande_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('id')
    .eq('jobb_id', jobb_id)
    .eq('sokande_id', sokande_id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

async function uppdateraStatus(id, status) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// Stämplar ansökningar som avhoppade. Statusen är fortfarande 'avvisad' – kolumnen är bara
// det som skiljer "jag lämnade uppdraget" från "företaget nekade mig" i UI:t.
//
// Anropas BARA från avhoppsvägen. Företaget kan också ta tillbaka ett godkännande via
// samma återställSchema, och det är inget avhopp.
//
// Bitas upp av samma skäl som hämtaIBitar: ett schema med 200 pass ger lika många
// ansöknings-id, och PostgREST skickar .in()-listan i URL:en.
async function markeraAvhopp(idn) {
  const unika = [...new Set((idn || []).filter(id => id != null))];
  if (!unika.length) return;

  const nu = new Date().toISOString();
  for (let i = 0; i < unika.length; i += CHUNK) {
    const { error } = await supabase
      .from('ansokningar')
      .update({ avhoppad_at: nu })
      .in('id', unika.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

// Avvisar alla ansökningar som fortfarande väntar på svar. Används när en
// privatperson raderar sitt konto: företaget ska inte sitta kvar med ansökningar
// från någon som inte längre finns. GODKÄNDA ansökningar rörs inte – de hänger
// ihop med utfört arbete, tidrapporter och fakturaunderlag.
async function avvisaVäntandeAnsökningar(sokande_id) {
  const { error } = await supabase
    .from('ansokningar')
    .update({ status: 'avvisad' })
    .eq('sokande_id', sokande_id)
    .eq('status', 'väntande');
  if (error) throw error;
}

async function hämtaAnsökanViaId(id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function hämtaAllaKonversationerFörFöretag(foretag_id) {
  const { data: jobb } = await supabase
    .from('Jobb')
    .select('id, Titel, arbetstider, antal_dagar, schema_id, schema_pass_id')
    .eq('Foretag_id', foretag_id);

  if (!jobb || !jobb.length) return [];

  const jobbIds = jobb.map(j => j.id);
  const jobbMap = Object.fromEntries(jobb.map(j => [j.id, j]));

  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('*')
    .in('jobb_id', jobbIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!ansökningar.length) return [];

  const ansökningsIds = ansökningar.map(a => a.id);
  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id).filter(Boolean))];

  const [sökande, tidrapporter, meddelanden] = await Promise.all([
    hämtaIBitar(sokandeIds, bit => supabase.from('användare').select('id, Namn').in('id', bit)),
    hämtaIBitar(ansökningsIds, bit => supabase.from('tidrapporter').select('ansokan_id, status, created_at, foretag_id').in('ansokan_id', bit).order('created_at', { ascending: true })),
    hämtaIBitar(ansökningsIds, bit => supabase.from('meddelanden').select('ansokan_id, avsandare_id, created_at, innehall').in('ansokan_id', bit).order('created_at', { ascending: false })),
  ]);

  const sökandeMap = Object.fromEntries((sökande || []).map(s => [s.id, s]));
  const rapportMap = Object.fromEntries((tidrapporter || []).map(r => [r.ansokan_id, r.status]));
  const senasteMap = {};
  for (const m of (meddelanden || [])) {
    if (!senasteMap[m.ansokan_id]) senasteMap[m.ansokan_id] = m;
  }
  vävInTidrapporter(senasteMap, tidrapporter);

  return ansökningar.map(a => ({
    ...a,
    sökandeNamn: sökandeMap[a.sokande_id]?.Namn ?? null,
    jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
    arbetstider: jobbMap[a.jobb_id]?.arbetstider ?? null,
    antalDagar: jobbMap[a.jobb_id]?.antal_dagar ?? null,
    schemaId: jobbMap[a.jobb_id]?.schema_id ?? null,
    schemaPassId: jobbMap[a.jobb_id]?.schema_pass_id ?? null,
    rapportStatus: rapportMap[a.id] ?? null,
    senasteMeddelande: senasteMap[a.id] ?? null,
  }));
}

// Godkända ansökningar för flera jobb i ett svep, med sökandens id. Kalendervyn behöver
// veta vem som är bokad på varje enstaka pass.
async function hämtaGodkändaFörFleraJobb(jobbIds) {
  return hämtaIBitar(jobbIds, bit =>
    supabase
      .from('ansokningar')
      .select('id, jobb_id, sokande_id')
      .eq('status', 'godkänd')
      .in('jobb_id', bit)
  );
}

// Namnuppslag för en lista användar-id. Returnerar en map id -> Namn.
async function hämtaNamnFörAnvändare(ids) {
  const rader = await hämtaIBitar(ids, bit =>
    supabase.from('användare').select('id, Namn').in('id', bit)
  );
  return Object.fromEntries(rader.map(u => [u.id, u.Namn]));
}

async function hämtaGodkändaFörJobb(jobb_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('id, sokande_id')
    .eq('jobb_id', jobb_id)
    .eq('status', 'godkänd');
  if (error) throw error;
  return data || [];
}

// Returnerar de berörda sökandenas id så att anropande route kan skicka realtidssignaler
// om statusändringen till varje påverkad person.
async function avvisaAllaUtomEn(jobb_id, godkänd_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .update({ status: 'avvisad' })
    .eq('jobb_id', jobb_id)
    .neq('id', godkänd_id)
    .select('sokande_id');
  if (error) throw error;
  return (data || []).map(a => a.sokande_id).filter(Boolean);
}

async function återställAllaFörJobb(jobb_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .update({ status: 'väntande' })
    .eq('jobb_id', jobb_id)
    .select('sokande_id');
  if (error) throw error;
  return (data || []).map(a => a.sokande_id).filter(Boolean);
}

// Returnerar de borttagna raderna (med jobb_id) så att anropande route kan signalera
// företaget om att en väntande ansökan tagits tillbaka. Tom lista = inget togs bort.
async function ångraAnsökan(id, sokande_id) {
  const { data, error } = await supabase
    .from('ansokningar')
    .delete()
    .eq('id', id)
    .eq('sokande_id', sokande_id)
    .eq('status', 'väntande')
    .select('jobb_id');
  if (error) throw error;
  return data || [];
}

async function hämtaAnsökanMedJobbInfo(id) {
  const { data: ansökan, error } = await supabase
    .from('ansokningar')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !ansökan) return null;

  const { data: jobb } = await supabase
    .from('Jobb')
    .select('Titel, arbetstider, antal_dagar, Foretag_id')
    .eq('id', ansökan.jobb_id)
    .single();

  return {
    ...ansökan,
    jobbTitel: jobb?.Titel ?? null,
    arbetstider: jobb?.arbetstider ?? null,
    antalDagar: jobb?.antal_dagar ?? null,
    foretagId: jobb?.Foretag_id ?? null,
  };
}

// Hämtar all chattinformation mellan ett företag och en privatperson:
// alla pass (ansökningar) med jobbinfo + tidrapport, alla meddelanden, samt aktiv ansökan att posta till.
async function hämtaKonversationMellan(företagId, privatpersonId, motpartId) {
  const { data: jobb } = await supabase
    .from('Jobb')
    .select('id, Titel, arbetstider, schema_id, schema_pass_id')
    .eq('Foretag_id', företagId);

  const jobbIds = (jobb || []).map(j => j.id);
  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));

  let ansökningar = [];
  if (jobbIds.length) {
    ansökningar = await hämtaIBitar(jobbIds, bit =>
      supabase
        .from('ansokningar')
        .select('*')
        .eq('sokande_id', privatpersonId)
        .in('jobb_id', bit)
        .order('created_at', { ascending: true })
    );
    ansökningar.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  const ansokanIds = ansökningar.map(a => a.id);
  let meddelanden = [];
  let tidrapporter = [];
  if (ansokanIds.length) {
    const [m, t] = await Promise.all([
      hämtaIBitar(ansokanIds, bit => supabase.from('meddelanden').select('*').in('ansokan_id', bit).order('created_at', { ascending: true })),
      hämtaIBitar(ansokanIds, bit => supabase.from('tidrapporter').select('*').in('ansokan_id', bit)),
    ]);
    meddelanden = m;
    meddelanden.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    tidrapporter = t;
  }

  // Flera tidrapporter kan finnas per ansökan (bestridda + korrigerade). Samla dem
  // per ansökan, sorterade kronologiskt, så att var och en visas som ett eget kort.
  const tidrapporterPerAnsökan = {};
  for (const r of tidrapporter) {
    (tidrapporterPerAnsökan[r.ansokan_id] ??= []).push(r);
  }
  for (const lista of Object.values(tidrapporterPerAnsökan)) {
    lista.sort((a, b) => new Date(a.created_at ?? a.datum) - new Date(b.created_at ?? b.datum));
  }

  // Aktiv ansökan = den med senast aktivitet (senaste meddelandet, annars senast skapad)
  let aktivAnsokanId = ansökningar.length ? ansökningar[ansökningar.length - 1].id : null;
  if (meddelanden.length) aktivAnsokanId = meddelanden[meddelanden.length - 1].ansokan_id;

  const { data: motpart } = await supabase
    .from('användare')
    .select('Namn')
    .eq('id', motpartId)
    .maybeSingle();

  const pass = ansökningar.map(a => {
    const rapporter = tidrapporterPerAnsökan[a.id] ?? [];
    return {
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      jobbTitel: jobbMap[a.jobb_id]?.Titel ?? null,
      arbetstider: jobbMap[a.jobb_id]?.arbetstider ?? null,
      // Chatten kollapsar alla pass som hör till samma schema till ett enda kort –
      // annars får ett sommarschema 60 passkort i tidslinjen.
      schemaId: jobbMap[a.jobb_id]?.schema_id ?? null,
      schemaPassId: jobbMap[a.jobb_id]?.schema_pass_id ?? null,
      tidrapporter: rapporter,
      // Behåll senaste rapporten för bakåtkompatibilitet med äldre klienter.
      tidrapport: rapporter[rapporter.length - 1] ?? null,
    };
  });

  return { motpartNamn: motpart?.Namn ?? null, aktivAnsokanId, meddelanden, pass };
}

// Listar konversationer grupperade per motpart (ett kort per företag/privatperson)
async function hämtaGrupperadeKonversationer(userId, ärFöretag) {
  const konversationer = ärFöretag
    ? await hämtaAllaKonversationerFörFöretag(userId)
    : await hämtaAnsökningarFörSökande(userId);

  // Markering ska bara visas för mottagaren av förfrågan (privatpersonen),
  // inte för företaget som skickade den. Företaget är alltid avsändare (fran).
  const väntande = await hämtaVäntandeFörAnvändare(userId);
  const väntandeMotparter = new Set(
    väntande
      .filter(f => String(f.till_anvandare_id) === String(userId))
      .map(f => String(f.fran_anvandare_id))
  );

  const grupper = {};
  for (const k of konversationer) {
    const motpartId = ärFöretag ? k.sokande_id : k.foretagId;
    if (motpartId == null) continue;
    const nyckel = String(motpartId);
    if (!grupper[nyckel]) {
      grupper[nyckel] = {
        id: nyckel,
        motpartId,
        motpartNamn: ärFöretag ? k.sökandeNamn : k.foretagNamn,
        items: [],
      };
    }
    grupper[nyckel].items.push(k);
  }

  return Object.values(grupper).map(g => {
    let senasteMeddelande = null;
    for (const k of g.items) {
      const sm = k.senasteMeddelande;
      if (sm && (!senasteMeddelande || new Date(sm.created_at) > new Date(senasteMeddelande.created_at))) {
        senasteMeddelande = sm;
      }
    }

    const aktiv = g.items.slice().sort((a, b) => {
      const ta = a.senasteMeddelande ? new Date(a.senasteMeddelande.created_at) : new Date(a.created_at);
      const tb = b.senasteMeddelande ? new Date(b.senasteMeddelande.created_at) : new Date(b.created_at);
      return tb - ta;
    })[0];

    return {
      id: g.id,
      motpartId: g.motpartId,
      motpartNamn: g.motpartNamn,
      aktivAnsokanId: aktiv?.id ?? null,
      jobbTitlar: [...new Set(g.items.map(k => k.jobbTitel).filter(Boolean))],
      senasteMeddelande,
      harVäntandeFörfragan: väntandeMotparter.has(String(g.motpartId)),
      harVäntandeTidrapport: g.items.some(k => k.rapportStatus === 'väntar'),
      harAktivtPass: g.items.some(k => k.status === 'godkänd' && k.rapportStatus !== 'godkänd'),
      harAvslutat: g.items.some(k => k.rapportStatus === 'godkänd' || k.status === 'avvisad'),
    };
  });
}

// Hämtar alla godkända pass som ännu saknar tidrapport, för att kunna påminna
// företaget när passets sluttid passerat. Returnerar företag-id, sökandes namn
// och jobbets arbetstider per pass.
async function hämtaPågåendePassFörPåminnelse() {
  const { data: ansökningar, error } = await supabase
    .from('ansokningar')
    .select('id, jobb_id, sokande_id')
    .eq('status', 'godkänd');

  if (error) throw error;
  if (!ansökningar || !ansökningar.length) return [];

  const jobbIds = [...new Set(ansökningar.map(a => a.jobb_id))];
  const ansokanIds = ansökningar.map(a => a.id);
  const sokandeIds = [...new Set(ansökningar.map(a => a.sokande_id))];

  // Schemapass rapporteras automatiskt av cron/schemaTidrapport.js – företaget ska inte
  // få en "Avsluta passet"-påminnelse för dem. Filtret ligger på jobbet, så pass utan
  // träff i jobbMap faller bort i mappningen nedan.
  const [jobb, tidrapporter, användare] = await Promise.all([
    hämtaIBitar(jobbIds, bit => supabase.from('Jobb').select('id, arbetstider, Foretag_id').is('schema_id', null).in('id', bit)),
    hämtaIBitar(ansokanIds, bit => supabase.from('tidrapporter').select('ansokan_id').in('ansokan_id', bit)),
    hämtaIBitar(sokandeIds, bit => supabase.from('användare').select('id, Namn').in('id', bit)),
  ]);

  const jobbMap = Object.fromEntries((jobb || []).map(j => [j.id, j]));
  const namnMap = Object.fromEntries((användare || []).map(u => [u.id, u.Namn]));
  const harTidrapport = new Set((tidrapporter || []).map(r => r.ansokan_id));

  return ansökningar
    .filter(a => !harTidrapport.has(a.id))
    .map(a => {
      const j = jobbMap[a.jobb_id];
      return {
        ansokanId: a.id,
        foretagId: j?.Foretag_id ?? j?.foretag_id ?? null,
        sökandeNamn: namnMap[a.sokande_id] ?? null,
        arbetstider: j?.arbetstider ?? null,
      };
    })
    .filter(p => p.foretagId != null && p.arbetstider != null);
}

module.exports = { skapaAnsökan, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, hämtaTotalTimmar, uppdateraStatus, markeraAvhopp, avvisaVäntandeAnsökningar, hämtaAnsökanViaId, avvisaAllaUtomEn, återställAllaFörJobb, hämtaAllaKonversationerFörFöretag, hämtaGodkändaFörJobb, hämtaGodkändaFörFleraJobb, hämtaNamnFörAnvändare, ångraAnsökan, hämtaAnsökanMedJobbInfo, hämtaKonversationMellan, hämtaGrupperadeKonversationer, hämtaPågåendePassFörPåminnelse };
