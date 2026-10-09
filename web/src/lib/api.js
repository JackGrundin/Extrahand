// API-klient för webben – speglar frontend/src/api/klient.js i mobilappen.
// Samma backend (api.fastgig.se), samma endpoints, samma felnormalisering. Enda
// skillnaden mot appen: token ligger i localStorage i stället för AsyncStorage.

// Adressen till backend. Läses ur NEXT_PUBLIC_API_URL med produktionsadressen som
// fallback (samma mönster som appen). NEXT_PUBLIC-variabler inlineas vid byggtid, så
// process.env.NEXT_PUBLIC_API_URL måste stå ordagrant här. /api-suffixet ingår –
// alla sökvägar nedan är relativa (t.ex. /auth/logga-in).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fastgig.se/api';

export const INGEN_ANSLUTNING = 'INGEN_ANSLUTNING';
export const INGEN_ANSLUTNING_TEXT =
  'Ingen internetanslutning – kontrollera din anslutning och försök igen';

// Efter så här lång tid utan svar ger vi upp (samma gräns som appen).
const TIMEOUT_MS = 20000;

const TOKEN_NYCKEL = 'token';

// localStorage finns bara i webbläsaren, inte under server-rendering.
export function hämtaToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_NYCKEL);
}

export function sparaToken(token) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_NYCKEL, token);
}

export function rensaToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_NYCKEL);
}

// Prenumeranter som vill veta när en autentiserad request avvisats med 401 – alltså
// när sessionen är död. AuthContext hakar på här och loggar ut (samma mönster som appen).
const authFelLyssnare = new Set();

export function lyssnaPåAuthFel(lyssnare) {
  authFelLyssnare.add(lyssnare);
  return () => authFelLyssnare.delete(lyssnare);
}

// Returnerar en garanterat användarvänlig svensk text för ett fångat fel – backendens
// fel-fält är alltid ren svenska, och nätverksfel bär vår egen text. Allt annat
// genericeras så att inget rått undantag når användaren.
export function felText(fel) {
  if (
    fel &&
    (fel.kod === INGEN_ANSLUTNING || fel.status != null) &&
    typeof fel.message === 'string'
  ) {
    return fel.message;
  }
  return 'Något gick fel. Försök igen.';
}

function nätverksfel() {
  const err = new Error(INGEN_ANSLUTNING_TEXT);
  err.kod = INGEN_ANSLUTNING;
  return err;
}

async function anrop(metod, sökväg, kropp) {
  const token = hämtaToken();

  // AbortController ger timeout utan att lämna anropet hängande i bakgrunden.
  const kontroller = new AbortController();
  const timeout = setTimeout(() => kontroller.abort(), TIMEOUT_MS);

  let svar;
  try {
    svar = await fetch(`${API_URL}${sökväg}`, {
      method: metod,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: kropp ? JSON.stringify(kropp) : undefined,
      signal: kontroller.signal,
    });
  } catch {
    // fetch kastar BARA vid nätverksfel eller avbrott, aldrig på HTTP-statuskoder.
    clearTimeout(timeout);
    throw nätverksfel();
  } finally {
    clearTimeout(timeout);
  }

  let data = null;
  try {
    data = await svar.json();
  } catch {
    // Vissa svar saknar kropp (t.ex. 204) – det är ok.
  }

  if (!svar.ok) {
    // Sessionen är död → meddela lyssnare (AuthContext loggar ut).
    if (svar.status === 401 && token) {
      for (const lyssnare of authFelLyssnare) lyssnare();
    }
    const err = new Error(data?.fel || 'Något gick fel. Försök igen.');
    err.status = svar.status;
    if (data?.kod) err.kod = data.kod;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  loggaIn: (kropp) => anrop('POST', '/auth/logga-in', kropp),
  registrera: (kropp) => anrop('POST', '/auth/registrera', kropp),
  skickaVerifieringsmail: (kropp) =>
    anrop('POST', '/auth/skicka-verifieringsmail', kropp),
  verifieraKod: (kropp) => anrop('POST', '/auth/verifiera-kod', kropp),
  glömtLösenord: (kropp) => anrop('POST', '/auth/glomt-losenord', kropp),

  // Profil (för sessionsåterställning)
  hämtaProfil: () => anrop('GET', '/users/profil'),
};

export default api;
