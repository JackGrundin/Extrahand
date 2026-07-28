// Cron-jobb som varje minut kontrollerar om något pass sluttid precis passerat.
// När sluttiden passerar får företaget en push-notifikation som påminner dem att
// avsluta passet och rapportera timmar. Tider i arbetstider tolkas som svensk lokaltid.
const { hämtaPågåendePassFörPåminnelse } = require('../db/ansokningar');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { parsaArbetstider, slutEpochFörPass } = require('../utils/tid');

const INTERVALL_MS = 60 * 1000;

// Kollar alla pågående pass och skickar påminnelser för dem vars sluttid passerade
// i intervallet (frånTid, tillTid]. Varje minut täcker exakt ett intervall, så varje
// pass påminns om en enda gång precis när sluttiden passerar.
async function kollaPassSomSlutat(frånTid, tillTid) {
  const pass = await hämtaPågåendePassFörPåminnelse();

  for (const p of pass) {
    for (const dag of parsaArbetstider(p.arbetstider)) {
      if (!dag?.datum || !dag?.slut) continue;

      // Pass som slutar efter midnatt (sluttid <= starttid) hamnar nästa dag – hanteras
      // av slutEpochFörPass i utils/tid.js.
      const slutEpoch = slutEpochFörPass({ datum: dag.datum, starttid: dag.start, sluttid: dag.slut });

      if (slutEpoch != null && slutEpoch > frånTid && slutEpoch <= tillTid) {
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
