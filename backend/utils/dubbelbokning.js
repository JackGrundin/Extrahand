// Dubbelbokningslogik: ren jämförelse av om två pass överlappar i tid. Inga databasanrop –
// orkestreringen (hämta befintliga pass, välja kandidater) bor i db/dubbelbokning.js.
//
// Jämförelsen görs på epoch-ms via utils/tid.js, aldrig på råa klocksträngar: då hanteras
// pass över midnatt (22:00–06:00) automatiskt av slutEpochFörPass, och ett pass som börjar
// precis när ett annat slutar (12:00 mot 12:00) räknas INTE som en krock.

const { startEpochFörPass, slutEpochFörPass } = require('./tid');

// Överlappar passen a och b i tid? Halvöppet intervall: slut == nästa start krockar inte.
// Saknas eller är någon tid trasig returneras false (hellre släppa igenom än blockera fel).
function passKrockar(a, b) {
  const aStart = startEpochFörPass(a);
  const aSlut = slutEpochFörPass(a);
  const bStart = startEpochFörPass(b);
  const bSlut = slutEpochFörPass(b);
  if (aStart == null || aSlut == null || bStart == null || bSlut == null) return false;
  return aStart < bSlut && bStart < aSlut;
}

// Första befintliga passet som krockar med NÅGOT av kandidatpassen, annars null.
// Pass normaliseras till { datum, starttid, sluttid, titel } av anroparen.
function hittaFörstaKrock(kandidater, befintliga) {
  for (const b of befintliga) {
    for (const k of kandidater) {
      if (passKrockar(k, b)) return b;
    }
  }
  return null;
}

module.exports = { passKrockar, hittaFörstaKrock };
