const express = require('express');
const { kräverInloggning } = require('../middleware/auth');

const router = express.Router();

// Adressförslag via Nominatim (OpenStreetMap). Ingen API-nyckel och ingen fakturering.
//
// Anropet går genom backend och inte direkt från appen av två skäl: Nominatims villkor
// kräver en identifierande User-Agent, som en mobilklient inte kan garantera, och en
// framtida övergång till en betald tjänst (Google Places) ska bara röra den här filen –
// ingen skärm ska behöva ändras.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Nominatims användarvillkor kräver att anroparen identifierar sig. Anrop utan detta
// blockeras.
const USER_AGENT = 'FastGig/1.0 (info@fastgig.se)';

// Kortare söksträngar än så ger mest brus och bränner anrop i onödan.
const MIN_TECKEN = 3;
const TIMEOUT_MS = 4000;
const MAX_TRÄFFAR = 8;

// Enkel minnescache. Nominatim tillåter ungefär en förfrågan per sekund, och samma gata
// söks om och om igen medan man skriver. Räcker gott på den här volymen – processen startas
// om vid varje deploy, vilket också är cachens utrymningsstrategi.
const CACHE_MAX = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function cacheNyckel(q, stad) {
  // Normalisera skiftläge och upprepade mellanslag så att "Storgatan 1" och
  // "storgatan  1" delar post.
  const städa = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${städa(q)}|${städa(stad)}`;
}

function hämtaUrCache(nyckel) {
  const post = cache.get(nyckel);
  if (!post) return null;
  if (Date.now() - post.tid > CACHE_TTL_MS) {
    cache.delete(nyckel);
    return null;
  }
  return post.träffar;
}

function sparaICache(nyckel, träffar) {
  // Enklast möjliga utrymning: äldsta insatta först. Map bevarar insättningsordning.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(nyckel, { tid: Date.now(), träffar });
}

// Plockar ut det appen behöver ur Nominatims svar. Poster utan gatunamn faller bort –
// utan det skulle etiketten kunna börja med "undefined", och en träff utan gata är
// meningslös som arbetsplatsadress.
function tillFörslag(rader) {
  const förslag = [];
  for (const r of Array.isArray(rader) ? rader : []) {
    const a = r?.address ?? {};
    const gatunamn = a.road ?? a.pedestrian ?? a.footway ?? null;
    if (!gatunamn) continue;

    const gata = a.house_number ? `${gatunamn} ${a.house_number}` : gatunamn;
    const ort = a.city ?? a.town ?? a.village ?? a.municipality ?? null;

    förslag.push({
      // Etiketten innehåller orten med flit: det är den som gör tydligt vilken stad
      // adressen hör till i förslagslistan.
      etikett: [gata, a.postcode, ort].filter(Boolean).join(', '),
      gata,
      stad: ort,
    });
  }
  return förslag;
}

// GET /api/adress/sok?q=...&stad=... — adressförslag för formulären.
//
// Kräver inloggning: en öppen proxy vore ett gratis geokodnings-API för vem som helst,
// och det är vår User-Agent som skulle spärras när någon missbrukar den.
router.get('/sok', kräverInloggning, async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const stad = String(req.query.stad ?? '').trim();

  if (q.length < MIN_TECKEN) return res.json([]);

  const nyckel = cacheNyckel(q, stad);
  const cachat = hämtaUrCache(nyckel);
  if (cachat) return res.json(cachat);

  // Staden läggs till i frågan så att "Storgatan" i Åre inte ger träffar i Malmö.
  const sökterm = stad ? `${q}, ${stad}` : q;
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: sökterm,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'se',
    limit: String(MAX_TRÄFFAR),
  })}`;

  const avbryt = new AbortController();
  const timer = setTimeout(() => avbryt.abort(), TIMEOUT_MS);

  try {
    const svar = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sv' },
      signal: avbryt.signal,
    });
    if (!svar.ok) throw new Error(`Nominatim svarade ${svar.status}`);

    const förslag = tillFörslag(await svar.json());
    sparaICache(nyckel, förslag);
    res.json(förslag);
  } catch (fel) {
    // Tom lista, inte 500. Adressfältet ska falla tillbaka till vanlig fri text när
    // tjänsten är seg eller nere – aldrig blockera en publicering.
    console.error('Adressökning misslyckades:', fel.message);
    res.json([]);
  } finally {
    clearTimeout(timer);
  }
});

module.exports = router;
