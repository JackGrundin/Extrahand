// Cron-jobb som skapar tidrapporter automatiskt för schemapass vars sluttid passerat.
// Privatpersonen godkänner eller bestrider rapporten precis som vanligt, via
// TidrapportKort i chatten – ingen ny UI-väg behövs, eftersom varje schemapass har en
// riktig ansökan bakom sig (se db/schemaTilldelning.js).
//
// Idempotensen ligger i databasen, inte i minnet: krävPassFörRapport flyttar passet
// planerad -> rapporterad i en enda villkorad update, och bara den körning som vinner
// skapar rapporten. Till skillnad från cron/passPaminnelse.js, som håller sitt
// tidsfönster i en variabel och tappar det vid varje Railway-deploy, överlever det här
// både omstarter och två samtidiga körningar.

const {
  hämtaPassAttRapportera,
  krävPassFörRapport,
  återställPassStatus,
  sättPassTidrapport,
  hämtaSchemaViaId,
  passMedArv,
  räknaPassFörSchema,
} = require('../db/scheman');
const { hämtaAktivaAvdrag } = require('../db/schemaAvdrag');
const { skapaTidrapport } = require('../db/tidrapporter');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { beräknaObBelopp, påslagEller40, beräknaBelopp, beräknaAvdragFörPass } = require('../utils/pris');
const { idagStockholm, slutEpochFörPass, passTimmar } = require('../utils/tid');
const { sändRealtidsPing } = require('../realtid');

const INTERVALL_MS = 5 * 60 * 1000;

async function kollaPassAttRapportera(nu = Date.now()) {
  const pass = await hämtaPassAttRapportera(idagStockholm(new Date(nu)));
  if (!pass.length) return 0;

  // Ett uppslag per schema, inte ett per pass: en körning med 30 pass i samma schema ska
  // inte ge 90 databasfrågor. Avdragen och passantalet cachas tillsammans med schemat.
  const schemaCache = new Map();
  async function schemaFör(id) {
    if (!schemaCache.has(id)) {
      const [schema, avdrag, antalPass] = await Promise.all([
        hämtaSchemaViaId(id),
        hämtaAktivaAvdrag(id),
        räknaPassFörSchema(id),
      ]);
      schemaCache.set(id, { schema, avdrag, antalPass });
    }
    return schemaCache.get(id);
  }

  let skapade = 0;

  for (const p of pass) {
    const slut = slutEpochFörPass({ datum: p.datum, starttid: p.starttid, sluttid: p.sluttid });
    if (slut == null || slut > nu) continue;

    const { schema, avdrag, antalPass } = await schemaFör(p.schema_id);
    if (!schema) continue;

    // Ta biljetten först. Förlorar vi kapplöpningen har någon annan redan rapporterat.
    if (!(await krävPassFörRapport(p.id))) continue;

    try {
      const timmar = passTimmar({ datum: p.datum, starttid: p.starttid, sluttid: p.sluttid });
      if (timmar <= 0) {
        // Orimligt pass (samma start- och sluttid). Lämna det rapporterat men utan
        // rapport, annars försöker cronen om i all evighet.
        console.error(`Schemapass ${p.id} har 0 timmar (${p.starttid}-${p.sluttid}) – hoppar över`);
        continue;
      }

      // Passets egna OB, med fallback till schemats för pass som lades innan OB flyttades
      // till passnivå.
      const { ob_tillagg: obTillagg } = passMedArv(schema, p);
      const timlon = Number(schema.timlon) || 0;
      const obBelopp = beräknaObBelopp(obTillagg, timlon);

      // Löneavdragen fryses på rapporten. De påverkar inte faktureringsbeloppet – bara vad
      // personen får ut – så totalt_belopp förblir bruttot.
      const { rader: avdragsrader, summa: avdragsSumma } = beräknaAvdragFörPass(avdrag, antalPass);
      const belopp = beräknaBelopp({ timmar, timlon, obBelopp, avdragBelopp: avdragsSumma });

      const rapport = await skapaTidrapport({
        ansokan_id: p.ansokan_id,
        foretag_id: schema.foretag_id,
        anvandare_id: p.anvandare_id,
        // Passets datum, inte dagens – rapporten hör till den dag som arbetades.
        datum: p.datum,
        timmar,
        timlon,
        ob_belopp: obBelopp,
        ob_tillagg: obTillagg,
        totalt_belopp: belopp.brutto,
        avdrag: avdragsrader,
        avdrag_belopp: belopp.avdrag,
        // Påslaget frystes på schemat när personen godkändes.
        paslag: påslagEller40(schema.paslag),
        auto_skapad: true,
      });

      await sättPassTidrapport(p.id, rapport.id);
      skapade++;

      sändRealtidsPing(p.anvandare_id, 'tidrapport');
      sändRealtidsPing(schema.foretag_id, 'tidrapport');

      try {
        const token = await hämtaPushToken(p.anvandare_id);
        await skickaNotifikation(
          token,
          'Ny tidrapport',
          `Ditt pass ${p.starttid}–${p.sluttid} har rapporterats automatiskt. Granska och godkänn.`
        );
      } catch (notisfel) {
        console.error('Push-notifikation fel (schematidrapport):', notisfel);
      }
    } catch (fel) {
      // Släpp biljetten så att nästa körning försöker igen.
      console.error(`Fel vid automatisk tidrapport för schemapass ${p.id}:`, fel);
      try {
        await återställPassStatus(p.id, 'planerad');
      } catch (återställningsfel) {
        console.error('Kunde inte återställa passstatus:', återställningsfel);
      }
    }
  }

  return skapade;
}

function startaSchemaTidrapport() {
  setInterval(async () => {
    try {
      await kollaPassAttRapportera();
    } catch (fel) {
      console.error('Fel i schema-tidrapport-cron:', fel);
    }
  }, INTERVALL_MS);
  console.log('Schema-tidrapport-cron startad (kontroll var 5:e minut)');
}

module.exports = { startaSchemaTidrapport, kollaPassAttRapportera };
