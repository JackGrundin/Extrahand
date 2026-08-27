// Databaslager för schemafunktionen (längre uppdrag: sommarjobb, säsongsarbete).
// Se db/migrations/scheman.sql för datamodellen och varför schemat materialiseras som
// vanliga Jobb-rader.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

const SCHEMAFÄLT = '*';

// Ett schemapass ärver kategori och OB från schemat när passets egna fält är NULL.
//
// Skillnaden mellan NULL och [] är bärande: NULL betyder "ärv schemats OB", [] betyder
// "det här passet har medvetet inget OB". Utan den skillnaden går det inte att ta bort OB
// för ett enskilt pass – det skulle poppa tillbaka från schemat vid varje läsning.
//
// Pass som lades innan kategori och OB flyttades till passnivå har alltid NULL, så inget
// backfill behövs. Den här funktionen är ENDA stället bakåtkompatibiliteten hanteras –
// lägg aldrig till egna if-satser för det ute i koden.
function passMedArv(schema, pass) {
  return {
    ...pass,
    kategori: pass?.kategori ?? schema?.kategori ?? null,
    ob_tillagg: Array.isArray(pass?.ob_tillagg)
      ? pass.ob_tillagg
      : (Array.isArray(schema?.ob_tillagg) ? schema.ob_tillagg : []),
  };
}

// ---------------------------------------------------------------- Scheman

async function skapaSchema({ foretag_id, titel, beskrivning, plats, adress, kategori, typ, startdatum, slutdatum, timlon, ob_tillagg }) {
  const { data, error } = await supabase
    .from('scheman')
    .insert([{
      foretag_id, titel, beskrivning, plats, adress, kategori,
      typ: typ || 'sommarjobb',
      startdatum, slutdatum, timlon,
      ob_tillagg: ob_tillagg || [],
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Kopplar schemat till sitt annons-jobb. Görs direkt efter att jobbet skapats.
async function sättAnnonsJobb(id, annons_jobb_id) {
  const { error } = await supabase.from('scheman').update({ annons_jobb_id }).eq('id', id);
  if (error) throw error;
}

async function hämtaSchemaViaId(id) {
  const { data, error } = await supabase
    .from('scheman')
    .select(SCHEMAFÄLT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Slår upp schemat utifrån dess annons-jobb. Används av godkännandekroken i
// routes/ansokningar.js, som bara känner till jobbet ansökan gäller.
async function hämtaSchemaViaAnnonsJobb(jobb_id) {
  const { data, error } = await supabase
    .from('scheman')
    .select(SCHEMAFÄLT)
    .eq('annons_jobb_id', jobb_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Öppna scheman som privatpersoner kan söka: publicerade och utan tilldelad person.
//
// Ett schema lämnar listan när det TILLSÄTTS (anvandare_id sätts och
// statusen blir 'tillsatt') eller avbryts – aldrig för att ett datum passerat. Tidigare
// fanns här ett `.gte('slutdatum', idag)`, men att ett schema tyst försvann ur listan
// på kalenderns nåder gjorde det omöjligt för företaget att förstå varför ingen sökte.
// Det är godkännandet som ska stänga annonsen, inte klockan.
//
// Motvikten ligger i routes/ansokningar.js: ett schema vars pass alla hunnit ta slut går
// inte att godkänna någon till, så ett kvarliggande utgånget schema kan inte förbruka
// företagets gratisgräns.
async function hämtaÖppnaScheman() {
  const { data: scheman, error } = await supabase
    .from('scheman')
    .select(SCHEMAFÄLT)
    .eq('status', 'publicerat')
    .is('anvandare_id', null)
    .order('startdatum', { ascending: true });

  if (error) throw error;
  if (!scheman || !scheman.length) return [];

  const berikade = await berikaMedPassOchFöretag(scheman);
  // Samma regel som för enstaka pass i hämtaAllaJobb: scheman från raderade konton
  // ska inte gå att söka. foretagAktiv === false, inte !foretagAktiv – NULL betyder
  // konto från före kolumnen fanns.
  return berikade.filter(s => s.foretagAktiv !== false);
}

async function hämtaSchemanFörFöretag(foretag_id) {
  const { data: scheman, error } = await supabase
    .from('scheman')
    .select(SCHEMAFÄLT)
    .eq('foretag_id', foretag_id)
    .neq('status', 'avbrutet')
    .order('startdatum', { ascending: false });

  if (error) throw error;
  if (!scheman || !scheman.length) return [];

  return berikaMedNyaAnsökningar(await berikaMedPassOchFöretag(scheman));
}

// Antal ansökningar per schema: antalAnsökningar (alla som fortfarande väntar på svar) och
// nyaAnsökningar (de olästa). Två skilda storheter – badgen ska sluta tjata när företaget
// läst listan, men kortet ska fortfarande visa att det FINNS sökande.
//
// Olästa räknas med samma regel som filtreraAktivaJobb i db/jobb.js: ny = ansökans
// created_at är senare än företagets stämpel, och NULL-stämpel (aldrig öppnat) betyder att
// alla är nya.
//
// Ingen egen kolumn behövs: schemats ansökningar ligger på annons-jobbet, som är en vanlig
// Jobb-rad, så Jobb.ansokningar_sedda_at gäller redan för dem.
//
// Tillsatta scheman räknas inte alls. Ett vanligt jobb försvinner ur listan så fort någon
// godkänts, men schemat ligger kvar – utan villkoret hade badgen tjatat om ansökningar på
// scheman som redan är bemannade. Hoppar personen av nollas anvandare_id och räkningen
// börjar om av sig själv.
//
// Separat steg, inte inbakat i berikaMedPassOchFöretag: den delas med hämtaÖppnaScheman och
// andra vyer där ett ansökningsantal inte hör hemma.
async function berikaMedNyaAnsökningar(scheman) {
  const sökande = scheman.filter(s => s.annons_jobb_id && s.anvandare_id == null);
  if (!sökande.length) return scheman.map(s => ({ ...s, nyaAnsökningar: 0, antalAnsökningar: 0 }));

  const jobbIds = sökande.map(s => s.annons_jobb_id);
  const [{ data: annonsJobb }, { data: ansokningar }] = await Promise.all([
    supabase.from('Jobb').select('id, ansokningar_sedda_at').in('id', jobbIds),
    supabase.from('ansokningar').select('jobb_id, created_at, status').in('jobb_id', jobbIds),
  ]);

  const seddMap = Object.fromEntries((annonsJobb || []).map(j => [j.id, j.ansokningar_sedda_at]));
  const nyaPerJobb = {};
  const antalPerJobb = {};
  for (const a of (ansokningar || [])) {
    // Olästräkningen går på ALLA ansökningar, oavsett status – exakt som filtreraAktivaJobb
    // i db/jobb.js. De två måste ge samma svar, annars visar schemabadgen och jobbbadgen
    // olika siffror för samma sorts händelse.
    const sedd = seddMap[a.jobb_id];
    if (!sedd || new Date(a.created_at) > new Date(sedd)) {
      nyaPerJobb[a.jobb_id] = (nyaPerJobb[a.jobb_id] || 0) + 1;
    }

    // Totalen är däremot "hur många kan jag välja bland just nu". Avvisade och avhoppade
    // hör inte dit.
    if (a.status === 'väntande') antalPerJobb[a.jobb_id] = (antalPerJobb[a.jobb_id] || 0) + 1;
  }

  const sökandeIds = new Set(sökande.map(s => s.id));
  return scheman.map(s => ({
    ...s,
    nyaAnsökningar: sökandeIds.has(s.id) ? (nyaPerJobb[s.annons_jobb_id] || 0) : 0,
    antalAnsökningar: sökandeIds.has(s.id) ? (antalPerJobb[s.annons_jobb_id] || 0) : 0,
  }));
}

// Distinkta roller i en passlista, sorterade på hur många pass som har dem. Samma mönster
// som hämtaEgnaKategorier använder för företagets förslagslista.
function räknaKategorier(pass) {
  const antal = {};
  for (const p of pass) {
    const namn = p.kategori ? String(p.kategori).trim() : '';
    if (namn) antal[namn] = (antal[namn] || 0) + 1;
  }
  return Object.entries(antal)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
    .map(([namn]) => namn);
}

// Lägger på antal pass, nästa kommande datum och namn (företag + tilldelad person).
// Inga joins – samma lookup-map-mönster som resten av db-lagret.
async function berikaMedPassOchFöretag(scheman) {
  const schemaIds = scheman.map(s => s.id);
  const användarIds = [...new Set(
    scheman.flatMap(s => [s.foretag_id, s.anvandare_id]).filter(id => id != null)
  )];

  const [{ data: pass }, { data: användare }] = await Promise.all([
    supabase.from('schema_pass').select('schema_id, datum, starttid, sluttid, status, kategori, ob_tillagg').in('schema_id', schemaIds).order('datum', { ascending: true }),
    supabase.from('användare').select('id, Namn, aktiv').in('id', användarIds),
  ]);

  const passPerSchema = {};
  for (const p of (pass || [])) (passPerSchema[p.schema_id] ??= []).push(p);
  const namnMap = Object.fromEntries((användare || []).map(u => [u.id, u.Namn]));
  const aktivMap = Object.fromEntries((användare || []).map(u => [u.id, u.aktiv]));

  return scheman.map(s => {
    const egnaPass = (passPerSchema[s.id] ?? []).map(p => passMedArv(s, p));
    return {
      ...s,
      pass: egnaPass,
      // Rollerna som förekommer i schemat, VANLIGAST FÖRST – schemakortet visar de tre
      // första som brickor, så ordningen avgör vad företaget faktiskt får se.
      kategorier: räknaKategorier(egnaPass),
      antalPass: egnaPass.length,
      foretagNamn: namnMap[s.foretag_id] ?? null,
      // Bara till för hämtaÖppnaScheman, som filtrerar bort raderade företags scheman
      // ur den publika listan. Övriga vyer ignorerar fältet.
      foretagAktiv: aktivMap[s.foretag_id] ?? null,
      personNamn: s.anvandare_id != null ? (namnMap[s.anvandare_id] ?? null) : null,
    };
  });
}

async function sättSchemaStatus(id, status) {
  const { error } = await supabase.from('scheman').update({ status }).eq('id', id);
  if (error) throw error;
}

// Sätter (eller nollar) vem schemat är tilldelat och vilket påslag som frysts.
async function sättSchemaTilldelning(id, { anvandare_id, paslag }) {
  const uppdatering = {};
  if (anvandare_id !== undefined) uppdatering.anvandare_id = anvandare_id;
  if (paslag !== undefined) uppdatering.paslag = paslag;
  if (!Object.keys(uppdatering).length) return;

  const { error } = await supabase.from('scheman').update(uppdatering).eq('id', id);
  if (error) throw error;
}

// Uppdaterar ett ännu inte tillsatt schema. Returnerar null när inget matchade – schemat
// finns inte, ägs av någon annan, eller är redan tillsatt. maybeSingle i stället för single
// så att anropande route kan svara begripligt i stället för att single kastar PGRST116 och
// blir ett 500.
async function uppdateraSchema(id, foretag_id, fält) {
  const { data, error } = await supabase
    .from('scheman')
    .update(fält)
    .eq('id', id)
    .eq('foretag_id', foretag_id)
    // Även tillsatta scheman får redigeras – titel, beskrivning och timlön kan behöva
    // rättas efter att någon godkänts. Passens datum och tider ändras däremot aldrig här.
    // Avbrutna scheman är fortfarande låsta.
    .in('status', ['publicerat', 'tillsatt'])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Speglar schemats fält till dess annons-jobb.
//
// Annons-jobbet är en riktig Jobb-rad och det är DEN som visas i chatten, i personens
// Mina pass och som läses av routes/tidrapporter.js (Jobb.Lon). Utan den här synkningen
// låg gamla värden kvar på jobbet efter en redigering, så titeln kunde säga en sak i
// schemat och en annan i chatten – och en ändrad timlön slog aldrig igenom.
//
// db/jobb.js uppdateraJobb kan inte användas: den filtrerar medvetet bort schemajobb med
// .is('schema_id', null) så att de inte går att ändra via jobb-API:t.
// pass är valfritt: skickas det med speglas även arbetstiderna, vilket behövs när pass
// lagts till eller ställts in. Annons-jobbets arbetstider är det privatpersonens Mina
// pass-kort läser, så utan den synkningen visar kortet en gammal passlista.
async function synkaAnnonsJobb(schema, pass) {
  if (!schema?.annons_jobb_id) return;

  const fält = {
    Titel: schema.titel,
    Beskrivning: schema.beskrivning,
    Plats: schema.plats,
    adress: schema.adress,
    Lon: schema.timlon,
    Kategori: schema.kategori,
    // Typ saknades här tills schematypen blev redigerbar. Utan raden behåller annons-jobbet
    // den typ det skapades med, och glider isär från schemat vid varje typändring.
    Typ: schema.typ,
  };

  if (Array.isArray(pass)) {
    // Inställda pass hör inte hemma i annonsen – de ska inte dyka upp som arbetstid.
    const aktiva = pass.filter(p => p.status !== 'installt');
    fält.antal_dagar = aktiva.length;
    fält.arbetstider = JSON.stringify(aktiva.map(p => ({
      datum: p.datum,
      start: p.starttid,
      slut: p.sluttid,
      kategori: p.kategori?.trim() || null,
    })));
  }

  const { error } = await supabase
    .from('Jobb')
    .update(fält)
    .eq('id', schema.annons_jobb_id)
    .eq('schema_id', schema.id);

  if (error) throw error;
}

// Perioden räknas om när pass läggs till eller ställs in. Egen funktion i stället för
// uppdateraSchema, som filtrerar på status och ägare och returnerar raden.
async function sättSchemaPeriod(id, { startdatum, slutdatum }) {
  const { error } = await supabase
    .from('scheman')
    .update({ startdatum, slutdatum })
    .eq('id', id);
  if (error) throw error;
}

// Ett enskilt pass, för kontrollerna innan det ställs in.
async function hämtaPassViaId(id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------ Schema_pass

async function skapaSchemaPass(rader) {
  if (!rader.length) return [];
  const skapade = [];
  for (let i = 0; i < rader.length; i += 50) {
    const { data, error } = await supabase
      .from('schema_pass')
      .insert(rader.slice(i, i + 50))
      .select();
    if (error) throw error;
    skapade.push(...(data || []));
  }
  return skapade;
}

async function hämtaPassFörSchema(schema_id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('schema_id', schema_id)
    .order('datum', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Pass som ännu inte materialiserats för den godkända personen. Villkoret ansokan_id is
// null gör tilldelningen körbar om: ett avbrutet anrop kan köras igen utan dubbletter.
async function hämtaPassAttTilldela(schema_id, frånDatum) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('schema_id', schema_id)
    .eq('status', 'planerad')
    .is('ansokan_id', null)
    .gte('datum', frånDatum)
    .order('datum', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Framtida pass som kan frigöras när någon hoppar av. Pass med tidrapport rörs aldrig –
// arbetet är utfört och ska betalas.
async function hämtaPassAttFrigöra(schema_id, frånDatum) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('schema_id', schema_id)
    .eq('status', 'planerad')
    .is('tidrapport_id', null)
    .gte('datum', frånDatum)
    .order('datum', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function kopplaPassTillJobb(id, { jobb_id, ansokan_id, anvandare_id }) {
  const { error } = await supabase
    .from('schema_pass')
    .update({ jobb_id, ansokan_id, anvandare_id })
    .eq('id', id);
  if (error) throw error;
}

// Nollar kopplingen till person och ansökan men BEHÅLLER jobb_id, så att Jobb-raden kan
// återanvändas när en ny person godkänns (den har redan rätt fryst påslag).
async function frikopplaPass(id) {
  const { error } = await supabase
    .from('schema_pass')
    .update({ ansokan_id: null, anvandare_id: null, status: 'planerad' })
    .eq('id', id);
  if (error) throw error;
}

async function sättPassInställt(id) {
  const { error } = await supabase
    .from('schema_pass')
    .update({ status: 'installt', ansokan_id: null, anvandare_id: null })
    .eq('id', id);
  if (error) throw error;
}

// Har schemat något pass som redan genomförts? Avgör om påslag och passräknare ska
// nollas vid ett återkallande – ett schema där någon faktiskt jobbat ska faktureras.
async function harGenomförtPass(schema_id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('id')
    .eq('schema_id', schema_id)
    .not('tidrapport_id', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

async function hämtaJobbIdnFörSchema(schema_id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('jobb_id')
    .eq('schema_id', schema_id)
    .not('jobb_id', 'is', null);
  if (error) throw error;
  return [...new Set((data || []).map(p => p.jobb_id))];
}

// ------------------------------------------------------- Cron: tidrapport

// Pass som är redo att rapporteras: tilldelade, ännu inte rapporterade, och vars datum
// passerat (sluttiden kontrolleras av cron-jobbet, som kan tidszonerna).
async function hämtaPassAttRapportera(tillDatum) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('status', 'planerad')
    .not('ansokan_id', 'is', null)
    .lte('datum', tillDatum)
    .order('datum', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Atomisk biljett: bara den körning som lyckas flytta passet planerad -> rapporterad får
// skapa tidrapporten. En läs-sedan-skriv på tidrapport_id skulle kunna dubblera vid
// överlappande körningar eller en omstart mitt i.
async function krävPassFörRapport(id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .update({ status: 'rapporterad' })
    .eq('id', id)
    .eq('status', 'planerad')
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

async function återställPassStatus(id, status) {
  const { error } = await supabase.from('schema_pass').update({ status }).eq('id', id);
  if (error) throw error;
}

async function sättPassTidrapport(id, tidrapport_id) {
  const { error } = await supabase.from('schema_pass').update({ tidrapport_id }).eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------- Cron: påminnelse

async function hämtaPassFörPåminnelse(datum) {
  const { data, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('datum', datum)
    .eq('status', 'planerad')
    .not('anvandare_id', 'is', null)
    .is('paminnelse_skickad_at', null);
  if (error) throw error;
  return data || [];
}

// Samma atomiska biljettmönster som krävPassFörRapport. Stämpeln ligger i databasen och
// överlever därför omstarter.
async function krävPåminnelse(id) {
  const { data, error } = await supabase
    .from('schema_pass')
    .update({ paminnelse_skickad_at: new Date().toISOString() })
    .eq('id', id)
    .is('paminnelse_skickad_at', null)
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

// ------------------------------------------------------------ Vyer

// Privatpersonens kommande schemapass.
async function hämtaSchemaPassFörAnvändare(anvandare_id, frånDatum) {
  const { data: pass, error } = await supabase
    .from('schema_pass')
    .select('*')
    .eq('anvandare_id', anvandare_id)
    .gte('datum', frånDatum)
    .order('datum', { ascending: true });

  if (error) throw error;
  if (!pass || !pass.length) return [];

  const schemaIds = [...new Set(pass.map(p => p.schema_id))];
  const { data: scheman } = await supabase.from('scheman').select('id, titel, foretag_id, adress, kategori, ob_tillagg').in('id', schemaIds);
  const foretagIds = [...new Set((scheman || []).map(s => s.foretag_id))];
  const { data: företag } = await supabase.from('användare').select('id, Namn').in('id', foretagIds);

  const schemaMap = Object.fromEntries((scheman || []).map(s => [s.id, s]));
  const namnMap = Object.fromEntries((företag || []).map(f => [f.id, f.Namn]));

  // passMedArv även här, annars visas "ingen kategori" på pass från scheman som skapades
  // innan kategorin flyttades till passnivå.
  return pass.map(p => ({
    ...passMedArv(schemaMap[p.schema_id], p),
    schemaTitel: schemaMap[p.schema_id]?.titel ?? null,
    adress: schemaMap[p.schema_id]?.adress ?? null,
    foretagNamn: namnMap[schemaMap[p.schema_id]?.foretag_id] ?? null,
  }));
}

// Alla schemapass inom ett datumintervall för ett företag, med personens namn.
// Kalendervyn kombinerar detta med företagets godkända enstaka pass.
async function hämtaKalenderPass(foretag_id, från, till) {
  // kategori och ob_tillagg behövs för arvet när passet saknar egna värden.
  const { data: scheman } = await supabase
    .from('scheman')
    .select('id, titel, kategori, ob_tillagg')
    .eq('foretag_id', foretag_id)
    .neq('status', 'avbrutet');

  if (!scheman || !scheman.length) return [];

  const schemaMap = Object.fromEntries(scheman.map(s => [s.id, s]));
  const { data: pass, error } = await supabase
    .from('schema_pass')
    .select('*')
    .in('schema_id', scheman.map(s => s.id))
    .neq('status', 'installt')
    .gte('datum', från)
    .lte('datum', till)
    .order('datum', { ascending: true });

  if (error) throw error;
  if (!pass || !pass.length) return [];

  const användarIds = [...new Set(pass.map(p => p.anvandare_id).filter(id => id != null))];
  const { data: användare } = await supabase.from('användare').select('id, Namn').in('id', användarIds);
  const namnMap = Object.fromEntries((användare || []).map(u => [u.id, u.Namn]));

  return pass.map(p => {
    const medArv = passMedArv(schemaMap[p.schema_id], p);
    return {
      datum: p.datum,
      starttid: p.starttid,
      sluttid: p.sluttid,
      // Behövs för att kalenderns passkort ska kunna öppna schemat.
      schemaId: p.schema_id,
      // null när passet ännu inte är tillsatt. Kalendern skiljer bemannat från obemannat
      // på just det – obemannade pass kommer med här med flit, de är det företaget
      // behöver agera på.
      personId: p.anvandare_id,
      personNamn: p.anvandare_id != null ? (namnMap[p.anvandare_id] ?? null) : null,
      titel: schemaMap[p.schema_id]?.titel ?? null,
      // Rollen för just det här passet. Kalendern grupperar dagens pass per kategori så
      // att företaget ser vilka avdelningar som är bemannade.
      kategori: medArv.kategori,
      typ: 'schema',
      status: p.status,
    };
  });
}

// Distinkta kategorier företaget använt på sina schemapass förut, vanligast först.
// Företagets "sparade kategorier" är helt enkelt de de redan skrivit – ingen egen tabell,
// vilket gör listan självunderhållande.
async function hämtaEgnaKategorier(foretag_id) {
  const { data: scheman } = await supabase
    .from('scheman')
    .select('id')
    .eq('foretag_id', foretag_id);

  if (!scheman || !scheman.length) return [];

  const { data: pass, error } = await supabase
    .from('schema_pass')
    .select('kategori')
    .in('schema_id', scheman.map(s => s.id))
    .not('kategori', 'is', null);

  if (error) throw error;

  const antal = {};
  for (const p of (pass || [])) {
    const namn = String(p.kategori).trim();
    if (namn) antal[namn] = (antal[namn] || 0) + 1;
  }
  return Object.entries(antal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([namn]) => namn);
}

// Antal pass som räknas när ett 'totalt'-avdrag fördelas. Inställda pass exkluderas –
// de kommer aldrig ge någon tidrapport och ska inte späda ut fördelningen.
async function räknaPassFörSchema(schema_id) {
  const { count, error } = await supabase
    .from('schema_pass')
    .select('id', { count: 'exact', head: true })
    .eq('schema_id', schema_id)
    .neq('status', 'installt');

  if (error) throw error;
  return count ?? 0;
}

module.exports = {
  passMedArv,
  räknaKategorier,
  hämtaEgnaKategorier,
  räknaPassFörSchema,
  skapaSchema,
  sättAnnonsJobb,
  hämtaSchemaViaId,
  hämtaSchemaViaAnnonsJobb,
  hämtaÖppnaScheman,
  hämtaSchemanFörFöretag,
  sättSchemaStatus,
  sättSchemaTilldelning,
  uppdateraSchema,
  synkaAnnonsJobb,
  sättSchemaPeriod,
  hämtaPassViaId,
  skapaSchemaPass,
  hämtaPassFörSchema,
  hämtaPassAttTilldela,
  hämtaPassAttFrigöra,
  kopplaPassTillJobb,
  frikopplaPass,
  sättPassInställt,
  harGenomförtPass,
  hämtaJobbIdnFörSchema,
  hämtaPassAttRapportera,
  krävPassFörRapport,
  återställPassStatus,
  sättPassTidrapport,
  hämtaPassFörPåminnelse,
  krävPåminnelse,
  hämtaSchemaPassFörAnvändare,
  hämtaKalenderPass,
};
