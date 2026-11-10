// Enkel in-memory cache med TTL. Används för data som sällan ändras
// (profil/prenumerationsstatus) för att slippa onödiga Supabase-anrop.
// TTL = 60 sekunder – tillräckligt för att avlasta databasen, kort nog att en
// Stripe-webhook eller ett avtalsgodkännande slår igenom inom en minut.

const poster = new Map();

function hämtaFrånCache(nyckel) {
  const post = poster.get(nyckel);
  if (!post) return null;
  if (Date.now() > post.utgårVid) {
    poster.delete(nyckel);
    return null;
  }
  return post.värde;
}

function sparaTillCache(nyckel, värde, ttlSekunder = 60) {
  poster.set(nyckel, { värde, utgårVid: Date.now() + ttlSekunder * 1000 });
}

function ogiltigförklaraCache(nyckel) {
  poster.delete(nyckel);
}

// Rensa utgångna poster var 5:e minut så Map:en inte växer obegränsat.
setInterval(() => {
  const nu = Date.now();
  for (const [nyckel, post] of poster.entries()) {
    if (nu > post.utgårVid) poster.delete(nyckel);
  }
}, 5 * 60 * 1000);

module.exports = { hämtaFrånCache, sparaTillCache, ogiltigförklaraCache };
