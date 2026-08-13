// Delade regler för lösenord. Ligger i en egen fil eftersom både API-endpointen
// (routes/auth.js) och den webbsida där lösenordet faktiskt skrivs in
// (routes/aterstallningSida.js) måste använda samma gräns – annars kan sidan
// släppa igenom ett lösenord som servern sedan avvisar.
const MIN_LÖSENORD_LÄNGD = 8;

// Returnerar ett felmeddelande, eller null när lösenordet duger.
function valideraLösenord(lösenord) {
  if (typeof lösenord !== 'string' || !lösenord) {
    return 'Lösenord krävs';
  }
  if (lösenord.length < MIN_LÖSENORD_LÄNGD) {
    return `Lösenordet måste vara minst ${MIN_LÖSENORD_LÄNGD} tecken`;
  }
  return null;
}

module.exports = { MIN_LÖSENORD_LÄNGD, valideraLösenord };
