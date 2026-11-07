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

// tystAuthFel: hoppa över den globala utloggningen vid 401. Används för publika/optional-
// auth-anrop (t.ex. hämtaInbjudan på inbjudningssidan som ligger utanför den inloggade
// delen) så att ett 401 där aldrig kan rensa en i övrigt giltig session.
async function anrop(metod, sökväg, kropp, { tystAuthFel = false } = {}) {
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
    // Sessionen är död → meddela lyssnare (AuthContext loggar ut). Hoppas över för
    // publika anrop (tystAuthFel) så att de aldrig råkar logga ut en giltig session.
    if (svar.status === 401 && token && !tystAuthFel) {
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
  // Profildokument (CV, intyg, körkort). kropp: { namn, fil (base64/data-URL), mimeType }.
  // Backend strippar ev. data-URL-prefix. Endast privatpersoner får ladda upp.
  laddaUppDokument: (kropp) => anrop('POST', '/users/dokument', kropp),
  raderaDokument: (id) => anrop('DELETE', `/users/dokument/${id}`),
  // En annan användares publika profil (kräver inloggning). För företag bär svaret
  // namn, bransch, stad, hemsida, totalTimmar och aktivaJobb.
  hämtaAnvändareProfil: (id) => anrop('GET', `/users/${id}/profil`),
  // Mottagna betyg för en användare → { snitt, antal, betyg: [...] }.
  hämtaBetyg: (anvandareId) => anrop('GET', `/betyg/anvandare/${anvandareId}`),

  // ── Företagsvyer ──────────────────────────────────────────────────────────
  // Paths speglar frontend/src/api/klient.js. OBS: POST/PUT /jobb tar emot GEMENA
  // fält (titel, lon, plats …) men svaren kommer i PascalCase (Titel, Lon, Plats).

  // Jobb
  // Publik lista av öppna enstaka pass (privatpersoners jobbläsning). Backend filtrerar
  // bort schema-jobb, tillsatta, passerade och raderade företag.
  hämtaAllaJobb: () => anrop('GET', '/jobb'),
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
  schemaInbjudningar: (id) => anrop('GET', `/scheman/${id}/inbjudningar`),
  hämtaInbjudan: (token) => anrop('GET', `/inbjudan/${encodeURIComponent(token)}`, undefined, { tystAuthFel: true }),
  // Inbjudningar (jobb/schema): utan email genereras bara en delbar länk (svar { url }) och
  // annonsen blir privat; med email skickas inbjudan direkt via mejl + ev. push (svar
  // { ok, hadeKonto, url }). Samma endpoint driver båda flikarna i "Bjud in"-modalen.
  genereraJobbInbjudan: (jobbId, email) => anrop('POST', `/inbjudan/jobb/${jobbId}`, email ? { email } : {}),
  genereraSchemaInbjudan: (schemaId, email) => anrop('POST', `/inbjudan/schema/${schemaId}`, email ? { email } : {}),
  kopplaInbjudan: (token) => anrop('POST', `/inbjudan/${encodeURIComponent(token)}/koppla`, {}),
  // Acceptera en inbjudan med ett klick: skapar ansökan + godkänner direkt. Svarar
  // { ansokanId, avtalGodkant }.
  accepteraInbjudan: (token) => anrop('POST', `/inbjudan/${encodeURIComponent(token)}/acceptera`, {}),
  // Förfrågningar-fliken: inkomna inbjudningar + acceptera via inbjudans id.
  hämtaMinaInbjudningar: () => anrop('GET', '/inbjudan/mina'),
  accepteraInbjudanViaId: (id) => anrop('POST', `/inbjudan/mina/${id}/acceptera`, {}),
  avböjInbjudan: (id) => anrop('POST', `/inbjudan/mina/${id}/avboj`, {}),
  minaJobbförfrågningar: () => anrop('GET', '/jobbforfragan/mina-vantande'),
  görJobbPublikt: (jobbId) => anrop('PATCH', `/inbjudan/jobb/${jobbId}/publicera`, {}),
  // Privatpersons-ansökan till ett schema (mot dess annons-jobb). Backend fryser kravlistan.
  sökSchema: (annonsJobbId, kropp) => anrop('POST', `/ansokningar/${annonsJobbId}`, kropp),
  // Privatpersons-ansökan till ett enstaka pass. kropp: { meddelande, intygade_krav }.
  // Samma endpoint som sökSchema; egen namngiven metod för tydlighet.
  sökaJobb: (jobbId, kropp) => anrop('POST', `/ansokningar/${jobbId}`, kropp),
  // Privatpersonens egna ansökningar (används av Mina ansökningar + Mina pass, som
  // filtrerar olika klient-sidigt). Backend kräver typ privatperson.
  minaAnsökningar: () => anrop('GET', '/ansokningar/mina'),
  // Ångra en egen ansökan – funkar bara när status är 'väntande'.
  ångraAnsökan: (id) => anrop('DELETE', `/ansokningar/${id}`),

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
  // Privatperson: godkänn eller bestrida en väntande tidrapport
  godkännRapport: (rapportId) => anrop('PATCH', `/tidrapporter/${rapportId}/status`, { status: 'godkänd' }),
  bestridaRapport: (rapportId, orsak) => anrop('PATCH', `/tidrapporter/${rapportId}/status`, { status: 'bestridd', orsak }),

  // Meddelanden (chatt). Realtidssignalen kommer via Supabase Broadcast; datan hämtas här.
  hämtaMeddelanden: (ansökanId) => anrop('GET', `/meddelanden/${ansökanId}`),
  skicka: (ansökanId, kropp) => anrop('POST', `/meddelanden/${ansökanId}`, kropp),

  // Jobbförfrågningar (passerbjudanden via chatten). Hämtas separat från meddelandena,
  // nycklat på motpartens user-id (inte ansökan). Bara privatpersonen kan svara.
  hämtaJobbförfrågningar: (medAnvandareId) => anrop('GET', `/jobbforfragan/konversation/${medAnvandareId}`),
  accepteraJobbförfrågan: (id) => anrop('PATCH', `/jobbforfragan/${id}/acceptera`, {}),
  avböjJobbförfrågan: (id) => anrop('PATCH', `/jobbforfragan/${id}/avboj`, {}),

  // Prenumeration (Stripe). Checkout/portal returnerar { url } att redirecta till.
  prenumerationStatus: () => anrop('GET', '/prenumeration/status'),
  skapaCheckout: () => anrop('POST', '/prenumeration/checkout', {}),
  öppnaPortal: () => anrop('POST', '/prenumeration/portal', {}),

  // Adress – backend-proxy mot Nominatim (ALDRIG direkt från klienten).
  sökAdress: (q, stad) =>
    anrop('GET', `/adress/sok?q=${encodeURIComponent(q)}&stad=${encodeURIComponent(stad ?? '')}`),

  // ── Admin (bara info@fastgig.se) ────────────────────────────────────────────
  // Listorna hämtas via den samlade /admin-routern; mutationerna återanvänder de
  // befintliga admin-endpointsen (avtal mejlar redan via Resend, betald/fakturerad
  // bor kvar i sina respektive routrar).
  adminStatistik: () => anrop('GET', '/admin/statistik'),
  adminTidrapporter: (status) =>
    anrop('GET', `/admin/tidrapporter${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  adminAvtal: () => anrop('GET', '/admin/avtal'),
  adminFöretag: () => anrop('GET', '/admin/foretag'),
  adminPrivatpersoner: () => anrop('GET', '/admin/privatpersoner'),
  adminFakturering: () => anrop('GET', '/admin/fakturering'),
  adminFaktureringsstatistik: () => anrop('GET', '/admin/faktureringsstatistik'),
  adminFaktureringPerFöretag: () => anrop('GET', '/admin/fakturering-per-foretag'),
  adminRaderade: () => anrop('GET', '/admin/raderade'),
  godkännAvtal: (id) => anrop('PATCH', `/users/admin/${id}/avtal`, {}),
  återkallaAvtal: (id, orsak) => anrop('PATCH', `/users/admin/${id}/avtal-aterkalla`, { orsak }),
  återkallaAvtalRaderad: (id) => anrop('PATCH', `/users/admin/${id}/avtal-aterkalla-raderad`, {}),
  markeraTidrapportBetald: (id) => anrop('PATCH', `/tidrapporter/${id}/betald`, {}),
  markeraFakturerad: (id) => anrop('PATCH', `/fakturering/${id}/fakturerad`, {}),
  blockeraFöretag: (id, blockerad) => anrop('PATCH', `/admin/foretag/${id}/blockera`, { blockerad }),
};

export default api;
