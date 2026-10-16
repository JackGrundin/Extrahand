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
  uppdateraProfil: (kropp) => anrop('PUT', '/users/profil', kropp),
  uppdateraStad: (stad) => anrop('PUT', '/users/stad', { stad }),
  // Profilbild POSTas som base64 (data:image/...) – backend proxar till Supabase Storage
  // och svarar { url }.
  laddaUppProfilBild: (bild) => anrop('POST', '/users/profil-bild', { bild }),

  // ── Företagsvyer ──────────────────────────────────────────────────────────
  // Paths speglar frontend/src/api/klient.js. OBS: POST/PUT /jobb tar emot GEMENA
  // fält (titel, lon, plats …) men svaren kommer i PascalCase (Titel, Lon, Plats).

  // Jobb
  minaJobb: () => anrop('GET', '/jobb/mina'),
  minaTidigareJobb: () => anrop('GET', '/jobb/mina/tidigare'),
  hämtaJobb: (id) => anrop('GET', `/jobb/${id}`),
  publicera: (kropp) => anrop('POST', '/jobb', kropp),
  uppdateraJobb: (id, kropp) => anrop('PUT', `/jobb/${id}`, kropp),
  taBortJobb: (id) => anrop('DELETE', `/jobb/${id}`),
  markeraAnsökningarSedda: (jobbId) =>
    anrop('POST', `/jobb/${jobbId}/markera-ansokningar-sedda`, {}),

  // Scheman
  minaScheman: () => anrop('GET', '/scheman/mina'),
  skapaSchema: (kropp) => anrop('POST', '/scheman', kropp),
  hämtaSchema: (id) => anrop('GET', `/scheman/${id}`),
  markeraSchemaAnsökningarSedda: (schemaId) =>
    anrop('POST', `/scheman/${schemaId}/markera-ansokningar-sedda`, {}),
  // Kalendervy: union av schemapass och godkända enstaka pass (inkl. obemannade).
  schemaKalender: (från, till) =>
    anrop('GET', `/scheman/kalender?from=${encodeURIComponent(från)}&till=${encodeURIComponent(till)}`),

  // Ansökningar
  ansökningarFörJobb: (jobbId) => anrop('GET', `/ansokningar/jobb/${jobbId}`),
  uppdateraStatus: (ansökningId, status) =>
    anrop('PATCH', `/ansokningar/${ansökningId}/status`, { status }),
  växlaFavoritAnsökan: (ansökningId, favorit) =>
    anrop('PATCH', `/ansokningar/${ansökningId}/favorit`, { favorit }),
  företagsKonversationer: () => anrop('GET', '/ansokningar/foretag'),

  // Tidrapporter (historik-fliken + avsluta pass)
  tidrapporterFörFöretag: () => anrop('GET', '/tidrapporter/foretag'),
  // Avsluta ett pass: skicka BARA ansokan_id + timmar (+ valfri ob_tillagg) – backend
  // beräknar alla belopp (timlön, påslag, OB, avdrag, datum).
  skapaRapport: (kropp) => anrop('POST', '/tidrapporter', kropp),
  hämtaTidrapport: (ansökanId) => anrop('GET', `/tidrapporter/ansokan/${ansökanId}`),

  // Meddelanden (chatt). Realtidssignalen kommer via Supabase Broadcast; datan hämtas här.
  hämtaMeddelanden: (ansökanId) => anrop('GET', `/meddelanden/${ansökanId}`),
  skicka: (ansökanId, kropp) => anrop('POST', `/meddelanden/${ansökanId}`, kropp),

  // Prenumeration (Stripe). Checkout/portal returnerar { url } att redirecta till.
  prenumerationStatus: () => anrop('GET', '/prenumeration/status'),
  skapaCheckout: () => anrop('POST', '/prenumeration/checkout', {}),
  öppnaPortal: () => anrop('POST', '/prenumeration/portal', {}),

  // Adress – backend-proxy mot Nominatim (ALDRIG direkt från klienten).
  sökAdress: (q, stad) =>
    anrop('GET', `/adress/sok?q=${encodeURIComponent(q)}&stad=${encodeURIComponent(stad ?? '')}`),
};

export default api;
