// Cron-jobb som påminner privatpersonen kvällen före varje schemapass:
// "Påminnelse: Du jobbar imorgon 08:00–17:00 hos Café Solen".
//
// Idempotensen ligger i databasen: krävPåminnelse stämplar paminnelse_skickad_at i en
// villkorad update, och bara den körning som vinner skickar notisen. En omstartad process
// kan därför varken dubblera påminnelser eller tappa dem – till skillnad från
// cron/passPaminnelse.js, vars tidsfönster bara finns i minnet.

const { hämtaPassFörPåminnelse, krävPåminnelse, hämtaSchemaViaId } = require('../db/scheman');
const { hämtaPushToken, hämtaAnvändareViaId } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { idagStockholm, nästaDatum, stockholmTillEpoch } = require('../utils/tid');

const INTERVALL_MS = 15 * 60 * 1000;

// Påminnelsen skickas tidigast kl. 18 kvällen före, så att ingen väcks mitt i natten.
const SKICKA_EFTER = '18:00';

async function kollaPåminnelser(nu = Date.now()) {
  const imorgon = nästaDatum(idagStockholm(new Date(nu)));
  const pass = await hämtaPassFörPåminnelse(imorgon);
  if (!pass.length) return 0;

  const schemaCache = new Map();
  async function schemaFör(id) {
    if (!schemaCache.has(id)) schemaCache.set(id, await hämtaSchemaViaId(id));
    return schemaCache.get(id);
  }

  const namnCache = new Map();
  async function företagsnamn(id) {
    if (!namnCache.has(id)) {
      const användare = await hämtaAnvändareViaId(id);
      namnCache.set(id, användare?.Namn ?? 'företaget');
    }
    return namnCache.get(id);
  }

  let skickade = 0;

  for (const p of pass) {
    // Kvällen före, men bara om passet inte redan hunnit börja (t.ex. efter ett längre
    // driftstopp) – då är "imorgon" fel ord och notisen gör mer skada än nytta.
    if (nu < stockholmTillEpoch(idagStockholm(new Date(nu)), SKICKA_EFTER)) continue;
    if (nu >= stockholmTillEpoch(p.datum, p.starttid)) continue;

    const schema = await schemaFör(p.schema_id);
    if (!schema) continue;

    if (!(await krävPåminnelse(p.id))) continue;

    try {
      const [token, namn] = await Promise.all([
        hämtaPushToken(p.anvandare_id),
        företagsnamn(schema.foretag_id),
      ]);
      await skickaNotifikation(
        token,
        'Påminnelse',
        `Du jobbar imorgon ${p.starttid}–${p.sluttid} hos ${namn}`
      );
      skickade++;
    } catch (fel) {
      // Stämpeln är redan satt. En misslyckad push ska inte leda till att vi försöker om
      // i all evighet – notisen är en påminnelse, inte kritisk data.
      console.error(`Fel vid påminnelse för schemapass ${p.id}:`, fel);
    }
  }

  return skickade;
}

function startaSchemaPåminnelse() {
  setInterval(async () => {
    try {
      await kollaPåminnelser();
    } catch (fel) {
      console.error('Fel i schema-påminnelse-cron:', fel);
    }
  }, INTERVALL_MS);
  console.log('Schema-påminnelse-cron startad (kontroll var 15:e minut)');
}

module.exports = { startaSchemaPåminnelse, kollaPåminnelser };
