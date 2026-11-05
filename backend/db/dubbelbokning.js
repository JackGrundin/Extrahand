// Databasorkestrering för dubbelbokningsskyddet: hämtar en persons redan bokade pass och
// kandidatpassen för det jobb hen söker/godkänns på, och letar efter en krock. Den rena
// tidsjämförelsen bor i utils/dubbelbokning.js.
//
// En person kan vara bokad via enstaka pass-jobb OCH via schemats materialiserade pass-jobb –
// båda är Jobb-rader med en ansökan, och båda bär sina tider i Jobb.arbetstider. Därför räcker
// det att räkna upp personens ansökningar och läsa arbetstider per jobb; ingen särväg för
// scheman behövs på den BEFINTLIGA sidan. På KANDIDAT-sidan läser vi däremot schema_pass
// direkt, så att ett schema jämförs pass-för-pass som uppgiften kräver.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { hämtaIBitar } = require('./ansokningar');
const { hämtaPassFörSchema } = require('./scheman');
const { parsaArbetstider, idagStockholm } = require('../utils/tid');
const { hittaFörstaKrock } = require('../utils/dubbelbokning');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Kandidatpassen för det jobb som söks/godkänns, normaliserade till { datum, starttid, sluttid }.
// Schema-annons (schema_id satt, schema_pass_id null): läs schemats pass, hoppa över inställda
// och passerade (ett passerat pass materialiseras ändå aldrig vid godkännande). Annars: läs
// jobbets egna arbetstider, där nyckeln är start/slut.
async function kandidatPassFörJobb(jobb) {
  if (jobb.schema_id && !jobb.schema_pass_id) {
    const idag = idagStockholm();
    const pass = await hämtaPassFörSchema(jobb.schema_id);
    return pass
      .filter(p => p.status !== 'installt' && p.datum >= idag)
      .map(p => ({ datum: p.datum, starttid: p.starttid, sluttid: p.sluttid }));
  }
  return parsaArbetstider(jobb.arbetstider).map(a => ({
    datum: a.datum,
    starttid: a.start,
    sluttid: a.slut,
  }));
}

// Personens redan bokade pass, filtrerade på de ansökningsstatusar anroparen bryr sig om
// ('godkänd' vid blockering, +'väntande' vid ansökningsvarning). Jobbet som söks/godkänns
// exkluderas så att ett schemabyte inte krockar med sig självt. Returnerar flat lista av
// { datum, starttid, sluttid, titel }.
async function hämtaBokadePassFörSökande(sokande_id, statusar, exkluderaJobbId) {
  const { data, error } = await supabase
    .from('ansokningar')
    .select('jobb_id')
    .eq('sokande_id', sokande_id)
    .in('status', statusar);
  if (error) throw error;

  const jobbIds = [...new Set((data || [])
    .map(r => r.jobb_id)
    .filter(id => id != null && String(id) !== String(exkluderaJobbId)))];
  if (!jobbIds.length) return [];

  const jobb = await hämtaIBitar(jobbIds, bit =>
    supabase.from('Jobb').select('id, Titel, arbetstider').in('id', bit));

  const pass = [];
  for (const j of jobb) {
    for (const a of parsaArbetstider(j.arbetstider)) {
      pass.push({ datum: a.datum, starttid: a.start, sluttid: a.slut, titel: j.Titel });
    }
  }
  return pass;
}

// Hittar en krock mellan kandidatpassen (jobbet som söks/godkänns) och personens redan
// bokade pass. Returnerar det krockande BEFINTLIGA passet ({ titel, datum }) eller null.
async function hittaKrockFörSökande({ sokande_id, jobb, statusar, exkluderaJobbId }) {
  const [kandidater, befintliga] = await Promise.all([
    kandidatPassFörJobb(jobb),
    hämtaBokadePassFörSökande(sokande_id, statusar, exkluderaJobbId),
  ]);
  if (!kandidater.length || !befintliga.length) return null;
  return hittaFörstaKrock(kandidater, befintliga);
}

module.exports = { kandidatPassFörJobb, hämtaBokadePassFörSökande, hittaKrockFörSökande };
