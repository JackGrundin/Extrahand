// Cron-jobb som varje minut kontrollerar om något pass sluttid precis passerat.
// När sluttiden passerar får företaget en push-notifikation som påminner dem att
// avsluta passet och rapportera timmar. Tider i arbetstider tolkas som svensk lokaltid.
const { hämtaPågåendePassFörPåminnelse } = require('../db/ansokningar');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');

const STOCKHOLM = 'Europe/Stockholm';
const INTERVALL_MS = 60 * 1000;

// Räknar ut tidszonsoffset (Stockholm − UTC) i millisekunder vid ett givet ögonblick.
function stockholmOffsetMs(epoch) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: STOCKHOLM,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const delar = {};
  for (const d of dtf.formatToParts(new Date(epoch))) delar[d.type] = d.value;
  const somUtc = Date.UTC(delar.year, delar.month - 1, delar.day, delar.hour, delar.minute, delar.second);
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

function parsaArbetstider(arbetstider) {
  if (Array.isArray(arbetstider)) return arbetstider;
  if (typeof arbetstider === 'string') {
    try { return JSON.parse(arbetstider); } catch { return []; }
  }
  return [];
}

// Kollar alla pågående pass och skickar påminnelser för dem vars sluttid passerade
// i intervallet (frånTid, tillTid]. Varje minut täcker exakt ett intervall, så varje
// pass påminns om en enda gång precis när sluttiden passerar.
async function kollaPassSomSlutat(frånTid, tillTid) {
  const pass = await hämtaPågåendePassFörPåminnelse();

  for (const p of pass) {
    for (const dag of parsaArbetstider(p.arbetstider)) {
      if (!dag?.datum || !dag?.slut) continue;

      // Pass som slutar efter midnatt (sluttid <= starttid) hamnar nästa dag.
      const slutDatum = dag.start && dag.slut <= dag.start ? nästaDatum(dag.datum) : dag.datum;
      const slutEpoch = stockholmTillEpoch(slutDatum, dag.slut);

      if (slutEpoch > frånTid && slutEpoch <= tillTid) {
        try {
          const token = await hämtaPushToken(p.foretagId);
          await skickaNotifikation(
            token,
            'Avsluta passet',
            `Kom ihåg att avsluta passet med ${p.sökandeNamn ?? 'din medarbetare'} - rapportera timmar!`
          );
        } catch (fel) {
          console.error('Fel vid utskick av pass-påminnelse:', fel);
        }
      }
    }
  }
}

// Startar cron-jobbet. Varje körning täcker intervallet sedan föregående körning,
// vilket ger sammanhängande täckning utan luckor eller dubbletter.
function startaPassPåminnelse() {
  let senasteKoll = Date.now();
  setInterval(async () => {
    const nu = Date.now();
    try {
      await kollaPassSomSlutat(senasteKoll, nu);
    } catch (fel) {
      console.error('Fel i pass-påminnelse-cron:', fel);
    } finally {
      senasteKoll = nu;
    }
  }, INTERVALL_MS);
  console.log('Pass-påminnelse-cron startad (kontroll var 60:e sekund)');
}

module.exports = { startaPassPåminnelse, kollaPassSomSlutat };
