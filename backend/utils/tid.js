// Tidszonshjälpare för pass och schemapass. Alla datum ('YYYY-MM-DD') och klockslag
// ('HH:MM') som lagras på jobb och schemapass tolkas som SVENSK lokaltid, aldrig UTC.
// Servern på Railway kör i UTC, så utan den här översättningen skulle ett pass som slutar
// 17:00 räknas som avslutat 19:00 svensk tid på sommaren.
//
// Låg av tre filer: cron/passPaminnelse.js, cron/schemaTidrapport.js och
// cron/schemaPaminnelse.js. Håll den fri från databasanrop.

const STOCKHOLM = 'Europe/Stockholm';

// Räknar ut tidszonsoffset (Stockholm − UTC) i millisekunder vid ett givet ögonblick.
//
// OBS hourCycle: 'h23'. Med hour12: false returnerar Intl i flera ICU-versioner timmen
// "24" vid midnatt, och gör det inkonsekvent med dagfältet – ett ögonblick som är
// midnatt i Stockholm kan komma tillbaka som både dag+1 OCH timme 24, vilket ger ett
// dygns fel i offseten. h23 låser timmarna till 0–23.
function stockholmOffsetMs(epoch) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: STOCKHOLM,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const delar = {};
  for (const d of dtf.formatToParts(new Date(epoch))) delar[d.type] = d.value;
  // Bältesspänne mot ICU-versioner som ändå svarar 24: räkna om till 0.
  const timme = Number(delar.hour) % 24;
  const somUtc = Date.UTC(delar.year, delar.month - 1, delar.day, timme, delar.minute, delar.second);
  return somUtc - epoch;
}

// Översätter datum (YYYY-MM-DD) + klockslag (HH:MM) i svensk lokaltid till epoch-ms.
function stockholmTillEpoch(datum, tid) {
  const [år, mån, dag] = datum.split('-').map(Number);
  const [tim, min] = tid.split(':').map(Number);
  const gissning = Date.UTC(år, mån - 1, dag, tim, min);
  return gissning - stockholmOffsetMs(gissning);
}

// Returnerar nästa kalenderdag som YYYY-MM-DD (för pass som slutar efter midnatt).
function nästaDatum(datum) {
  const [år, mån, dag] = datum.split('-').map(Number);
  const dt = new Date(Date.UTC(år, mån - 1, dag));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Returnerar föregående kalenderdag som YYYY-MM-DD (används för påminnelsen dagen före).
function föregåendeDatum(datum) {
  const [år, mån, dag] = datum.split('-').map(Number);
  const dt = new Date(Date.UTC(år, mån - 1, dag));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Dagens datum som YYYY-MM-DD i svensk lokaltid. Kan inte ersättas med
// toISOString().slice(0,10) – det ger fel dag mellan midnatt och 02:00 svensk tid.
function idagStockholm(nu = new Date()) {
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: STOCKHOLM,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const delar = {};
  for (const d of dtf.formatToParts(nu)) delar[d.type] = d.value;
  return `${delar.year}-${delar.month}-${delar.day}`;
}

// arbetstider lagras som JSON-array men kan komma tillbaka som antingen array (jsonb)
// eller sträng (text) beroende på hur raden skrevs. Tål båda.
function parsaArbetstider(arbetstider) {
  if (Array.isArray(arbetstider)) return arbetstider;
  if (typeof arbetstider === 'string') {
    try { return JSON.parse(arbetstider); } catch { return []; }
  }
  return [];
}

// Startpunkten för ett pass i epoch-ms.
function startEpochFörPass({ datum, starttid }) {
  if (!datum || !starttid) return null;
  return stockholmTillEpoch(datum, starttid);
}

// Sluttidpunkten för ett pass i epoch-ms. Ett pass vars sluttid är mindre än eller lika
// med starttiden går över midnatt och slutar därmed nästa dag.
function slutEpochFörPass({ datum, starttid, sluttid }) {
  if (!datum || !sluttid) return null;
  const slutDatum = starttid && sluttid <= starttid ? nästaDatum(datum) : datum;
  return stockholmTillEpoch(slutDatum, sluttid);
}

// Passets längd i timmar, avrundat till två decimaler. Midnattspass hanteras av
// slutEpochFörPass, så ett pass 22:00–06:00 blir 8 timmar och inte −16.
function passTimmar({ datum, starttid, sluttid }) {
  const start = startEpochFörPass({ datum, starttid });
  const slut = slutEpochFörPass({ datum, starttid, sluttid });
  if (start == null || slut == null || slut <= start) return 0;
  return Math.round(((slut - start) / 3600000) * 100) / 100;
}

module.exports = {
  STOCKHOLM,
  stockholmOffsetMs,
  stockholmTillEpoch,
  nästaDatum,
  föregåendeDatum,
  idagStockholm,
  parsaArbetstider,
  startEpochFörPass,
  slutEpochFörPass,
  passTimmar,
};
