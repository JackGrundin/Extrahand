// Cron-jobb som avslutar enstaka pass automatiskt när företaget inte hunnit göra det.
// Har ett enstaka pass (ett Jobb utan schema_id) passerat sin sluttid med mer än 24 timmar
// utan att företaget avslutat det manuellt, skapas tidrapporten här med de PLANERADE timmarna
// (minus rast), auto_skapad = true, status 'väntar' – precis som cron/schemaTidrapport.js gör
// för schemapass. Privatpersonen godkänner eller bestrider rapporten via TidrapportKort i
// chatten, och företaget kan korrigera den så länge den är auto_skapad och väntar.
//
// Idempotensen ligger i databasen: hämtaPassAttAvsluta returnerar bara pass UTAN tidrapport,
// och skapaTidrapport kastar { kod: 409 } om en aktiv tidrapport hunnit skapas (manuellt eller
// av en samtidig körning) mellan hämtning och insert. Cronen överlever därmed omstarter.
//
// Tider i arbetstider tolkas som svensk lokaltid via utils/tid.js, likt övriga cron-jobb.

const { hämtaPassAttAvsluta } = require('../db/ansokningar');
const { skapaTidrapport } = require('../db/tidrapporter');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { beräknaObBelopp, påslagEller40, beräknaBelopp } = require('../utils/pris');
const { parsaArbetstider, slutEpochFörPass, passTimmar } = require('../utils/tid');
const { sändRealtidsPing } = require('../realtid');

const INTERVALL_MS = 15 * 60 * 1000;
const TJUGOFYRA_TIMMAR_MS = 24 * 60 * 60 * 1000;

async function kollaPassAttAvsluta(nu = Date.now()) {
  const kandidater = await hämtaPassAttAvsluta();
  if (!kandidater.length) return 0;

  let skapade = 0;

  for (const p of kandidater) {
    const dagar = parsaArbetstider(p.arbetstider);

    // Passets SISTA sluttid: ett flerdagarsjobb är klart först när sista dagen slutat, och
    // vi vill inte auto-avsluta ett treddagarsjobb efter dag ett. slutEpochFörPass hanterar
    // midnattspass (sluttid <= starttid) genom att lägga sluttiden på nästa dag.
    let senasteSlut = null;
    let bruttoTimmar = 0;
    const senasteDatum = { datum: null, slut: null };
    for (const dag of dagar) {
      if (!dag?.datum || !dag?.slut) continue;
      const slut = slutEpochFörPass({ datum: dag.datum, starttid: dag.start, sluttid: dag.slut });
      if (slut == null) continue;
      bruttoTimmar += passTimmar({ datum: dag.datum, starttid: dag.start, sluttid: dag.slut });
      if (senasteSlut == null || slut > senasteSlut) {
        senasteSlut = slut;
        senasteDatum.datum = dag.datum;
      }
    }

    // Inget giltigt slut, eller sluttiden ligger mindre än 24 h bakåt – låt passet vara.
    if (senasteSlut == null || nu - senasteSlut <= TJUGOFYRA_TIMMAR_MS) continue;

    // Rasten dras av från de rapporterade timmarna: planerat − rast = netto, samma formel som
    // AvslutaPassModal/planeradeTimmar. OB räknas däremot på passets hela intervall.
    const rastMinuter = Math.max(0, Math.floor(Number(p.rastMinuter) || 0));
    const nettoTimmar = Math.max(0, Math.round((bruttoTimmar - rastMinuter / 60) * 100) / 100);
    if (nettoTimmar <= 0) {
      // Orimligt pass (t.ex. samma start- och sluttid). Hoppa över – nästa körning skulle
      // ändå få samma 0, och en tidrapport på 0 timmar hjälper ingen.
      console.error(`Enstaka pass (ansökan ${p.ansokanId}) har 0 timmar – hoppar över`);
      continue;
    }

    const timlon = Number(p.timlon) || 0;
    const obBelopp = beräknaObBelopp(p.obTillagg, timlon);
    // Enstaka pass har inga schema-avdrag; bruttot är hela utbetalningen.
    const belopp = beräknaBelopp({ timmar: nettoTimmar, timlon, obBelopp });

    try {
      await skapaTidrapport({
        ansokan_id: p.ansokanId,
        foretag_id: p.foretagId,
        anvandare_id: p.sokandeId,
        // Passets sista arbetsdatum – rapporten hör till den dag som arbetades, likt schemacronen.
        datum: senasteDatum.datum,
        timmar: nettoTimmar,
        timlon,
        ob_belopp: obBelopp,
        ob_tillagg: p.obTillagg,
        totalt_belopp: belopp.brutto,
        // Rasten fryses på rapporten så att en senare jobbredigering inte ändrar den.
        rast_minuter: rastMinuter,
        // Påslaget frystes på jobbet när personen godkändes.
        paslag: påslagEller40(p.paslag),
        auto_skapad: true,
      });
    } catch (fel) {
      // 409 = en aktiv tidrapport hann skapas efter vår hämtning. Inget fel, hoppa vidare.
      if (fel.kod === 409) continue;
      console.error(`Fel vid automatisk avslutning av pass (ansökan ${p.ansokanId}):`, fel);
      continue;
    }

    skapade++;

    sändRealtidsPing(p.sokandeId, 'tidrapport');
    sändRealtidsPing(p.foretagId, 'tidrapport');

    // Push till BÅDA parter. Var och en i egen try/catch så en misslyckad notis inte
    // blockerar den andra eller nästa pass.
    for (const mottagare of [p.sokandeId, p.foretagId]) {
      try {
        const token = await hämtaPushToken(mottagare);
        await skickaNotifikation(
          token,
          'Tidrapport skapad',
          'Tidrapport skapad automatiskt – kontrollera och godkänn.'
        );
      } catch (notisfel) {
        console.error('Push-notifikation fel (avsluta-pass):', notisfel);
      }
    }
  }

  return skapade;
}

function startaAvslutaPass() {
  setInterval(async () => {
    try {
      await kollaPassAttAvsluta();
    } catch (fel) {
      console.error('Fel i avsluta-pass-cron:', fel);
    }
  }, INTERVALL_MS);
  console.log('Avsluta-pass-cron startad (kontroll var 15:e minut)');
}

module.exports = { startaAvslutaPass, kollaPassAttAvsluta };
