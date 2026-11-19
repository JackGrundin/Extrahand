// Punkt 17: eskalerar obesvarade bestridanden till admin.
//
// OBS: trots filnamnet godkänner jobbet INGENTING automatiskt – ett bestridande som
// legat obesvarat i 24 h flaggas i stället för manuell hantering (eskalerad = true) och
// båda parter notifieras. Admin löser sedan ärendet via "Bestridanden"-fliken.
//
// Idempotensen ligger i databasen: krävEskalering sätter eskalerad = true i en villkorad
// update, och bara den körning som vinner skickar notiserna. En omstartad process kan
// därför varken dubblera eller tappa eskaleringar (samma mönster som cron/schemaPaminnelse.js).

const { hämtaBestridandenAttEskalera, krävEskalering } = require('../db/tidrapporter');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');

const INTERVALL_MS = 15 * 60 * 1000;
const GRÄNS_MS = 24 * 60 * 60 * 1000;

async function kollaBestridanden(nu = Date.now()) {
  const cutoff = new Date(nu - GRÄNS_MS).toISOString();
  const rader = await hämtaBestridandenAttEskalera(cutoff);
  if (!rader.length) return 0;

  let eskalerade = 0;

  for (const r of rader) {
    // Claima eskaleringen FÖRST. En misslyckad push ska inte leda till att vi försöker om
    // i all evighet – stämpeln är redan satt, precis som i schemaPåminnelse.
    if (!(await krävEskalering(r.id))) continue;

    try {
      const [personToken, företagToken] = await Promise.all([
        hämtaPushToken(r.anvandare_id),
        hämtaPushToken(r.foretag_id),
      ]);
      await Promise.all([
        skickaNotifikation(
          personToken,
          'Bestridande eskalerat',
          'Ditt bestridande har eskalerats till FastGig för manuell hantering.'
        ),
        skickaNotifikation(
          företagToken,
          'Bestridande eskalerat',
          'En bestridd tidrapport har eskalerats till FastGig eftersom den inte hanterades inom 24 timmar.'
        ),
      ]);
      eskalerade++;
    } catch (fel) {
      console.error(`Fel vid eskalering av bestridande ${r.id}:`, fel);
    }
  }

  return eskalerade;
}

function startaGodkännBestridande() {
  setInterval(async () => {
    try {
      await kollaBestridanden();
    } catch (fel) {
      console.error('Fel i bestridande-eskalerings-cron:', fel);
    }
  }, INTERVALL_MS);
  console.log('Bestridande-eskalerings-cron startad (kontroll var 15:e minut)');
}

module.exports = { startaGodkännBestridande, kollaBestridanden };
