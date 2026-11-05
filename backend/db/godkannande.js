// Kärnan i att godkänna en ansökan – DELAD mellan företagets
// PATCH /api/ansokningar/:id/status och den inbjudnes POST /api/inbjudan/:token/acceptera.
//
// Att logiken bor på exakt ett ställe är en PENNINGFRÅGA: påslaget fryses här (och bara
// här), så en andra kopia hade kunnat glida isär. `företagId` är ALLTID jobbets ägare,
// aldrig den som utför godkännandet – det är företagets prenumeration som styr påslaget och
// företagets månadsräknare som ökas. Den inbjudne godkänner sig själv, men priset är
// fortfarande företagets.
//
// Funktionen gör bara DB-skrivningar och returnerar vilka andra sökande som berördes.
// Realtidssignaler och push lämnas till respektive route (de notifierar olika mottagare).

const { uppdateraStatus, avvisaAllaUtomEn } = require('./ansokningar');
const { hämtaPrenumeration, gällandePåslag, ökaPassDennaManad } = require('./prenumeration');
const { sättJobbPåslag } = require('./jobb');
const { hämtaRabattInbjudan } = require('./schemaInbjudan');
const { tilldelaSchema, räknaTilldelbaraPass, frigörFramtidaPass } = require('./schemaTilldelning');
const { PÅSLAG_SCHEMA, PÅSLAG_INBJUDAN_PASS, PÅSLAG_INBJUDAN_SCHEMA } = require('../utils/pris');

// Godkänner `ansökan` på `jobb`. godkändaFöre + ärSchemaAnnons skickas in av anroparen
// (de behövs även i återkalla-grenen hos företaget, så de beräknas en gång där).
// Kastar en Error med .kod = 'SCHEMA_UTAN_PASS' om ett schema inte går att bemanna –
// inget skrivs då. Returnerar { övrigaBerörda, påslag }.
async function godkännAnsökan({ ansökan, jobb, företagId, godkändaFöre, ärSchemaAnnons }) {
  // Ett schema ligger kvar som sökbart tills det tillsätts eller avbryts – aldrig för att
  // ett datum passerat. Har varje pass hunnit ta slut går schemat inte att bemanna:
  // tilldelaSchema skulle ställa in samtliga pass, personen få en tom bekräftelse och
  // företaget ändå förbruka ett pass av gratisgränsen. Avbryt före varje sidoeffekt.
  // Bara vid FÖRSTA godkännandet – ett byte av person ökar inte räknaren.
  if (ärSchemaAnnons && godkändaFöre.length === 0) {
    if ((await räknaTilldelbaraPass(jobb.schema_id)) === 0) {
      const fel = new Error('Schemat har inga pass kvar som kan bemannas. Lägg till nya pass eller avbryt schemat.');
      fel.kod = 'SCHEMA_UTAN_PASS';
      throw fel;
    }
  }

  await uppdateraStatus(ansökan.id, 'godkänd');
  const övrigaBerörda = await avvisaAllaUtomEn(ansökan.jobb_id, ansökan.id);

  // Påslaget som ska gälla: nyfryst vid första godkännandet, annars det som redan ligger på
  // jobbet (byte av person ska inte kunna ändra ett avtalat pris).
  let påslag = jobb?.paslag ?? null;

  if (godkändaFöre.length === 0) {
    // Passet är nu genomfört-att-bli och räknas mot månadens gräns. Påslaget avgörs FÖRE
    // inkrementet: pass 1 och 2 får 20 %, pass 3 och framåt 40 %. Det fryses på jobbet och
    // följer sedan med till tidrapporten och fakturan.
    const företag = await hämtaPrenumeration(företagId);
    påslag = gällandePåslag(företag);

    // Är den godkände inbjuden via en länk och ny på plattformen (rabatt_godkand stämplades
    // vid inlösen)? Då gäller rabatterat påslag för just det här passet/schemat: 15 % för
    // enstaka pass, 7 % för scheman. Ett schema godkänns via sitt annons-jobb (schema_id satt).
    const rabatt = await hämtaRabattInbjudan({
      jobb_id: ansökan.jobb_id,
      schema_id: jobb.schema_id ?? null,
      anvandare_id: ansökan.sokande_id,
    });
    if (rabatt) {
      påslag = jobb.schema_id ? PÅSLAG_INBJUDAN_SCHEMA : PÅSLAG_INBJUDAN_PASS;
    } else if (ärSchemaAnnons) {
      // Scheman faktureras med ett fast schemapåslag (15 %), inte gratis-/pro-räknarens
      // 20/40. Påslaget fryses här på annons-jobbet och följer sedan med till varje
      // materialiserat pass-jobb (tilldelaSchema) – även vid person-byte, som läser
      // tillbaka påslaget härifrån. En rabatterad inbjudan går före och behåller 7 %.
      påslag = PÅSLAG_SCHEMA;
    }

    await sättJobbPåslag(ansökan.jobb_id, påslag);
    await ökaPassDennaManad(företagId);
  }

  if (ärSchemaAnnons) {
    // Byter företaget person på ett redan tillsatt schema måste den förra personens
    // framtida pass frigöras först. Genomförda pass rörs inte.
    if (godkändaFöre.length > 0) await frigörFramtidaPass(jobb.schema_id);
    await tilldelaSchema(jobb.schema_id, ansökan.sokande_id, påslag);
  }

  return { övrigaBerörda, påslag };
}

module.exports = { godkännAnsökan };
