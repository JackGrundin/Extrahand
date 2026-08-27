import AsyncStorage from '@react-native-async-storage/async-storage';

// Lokal utveckling: peka mot din dators LAN-IP så att Expo Go på telefonen når backend
const API_URL = 'https://api.fastgig.se/api';
// Produktion: const API_URL = 'https://api.fastgig.se/api';

// Meddelandet som visas när telefonen inte når servern. Samlat på ett ställe så att
// alla skärmar säger samma sak – de flesta visar bara fel.message i en Alert.
export const INGEN_ANSLUTNING_TEXT =
  'Ingen internetanslutning – kontrollera din anslutning och försök igen';

// Felkod som skärmar kan känna igen om de vill särbehandla nätverksfel (t.ex. visa
// en "Försök igen"-knapp i stället för ett rött felmeddelande).
export const INGEN_ANSLUTNING = 'INGEN_ANSLUTNING';

// Efter så här lång tid utan svar ger vi upp. Utan gräns hänger fetch kvar i minuter
// på ett dåligt mobilnät, och användaren ser bara en snurra som aldrig tar slut.
const TIMEOUT_MS = 20000;

// Prenumeranter som vill veta när anslutningen tappas eller kommer tillbaka.
// AnslutningsContext hakar på här och visar bannern; klienten känner inte till
// React och kan användas likadant utanför komponentträdet.
const anslutningsLyssnare = new Set();
let harAnslutning = true;

function rapporteraAnslutning(uppkopplad) {
  if (uppkopplad === harAnslutning) return;
  harAnslutning = uppkopplad;
  for (const lyssnare of anslutningsLyssnare) lyssnare(uppkopplad);
}

export function lyssnaPåAnslutning(lyssnare) {
  anslutningsLyssnare.add(lyssnare);
  return () => anslutningsLyssnare.delete(lyssnare);
}

export function harInternetanslutning() {
  return harAnslutning;
}

function nätverksfel(meddelande) {
  const err = new Error(meddelande);
  err.kod = INGEN_ANSLUTNING;
  return err;
}

async function anrop(metod, sökväg, kropp) {
  const token = await AsyncStorage.getItem('token');

  // AbortController i stället för Promise.race: annars fortsätter det övergivna
  // anropet i bakgrunden och håller kvar sockeln.
  const kontroller = new AbortController();
  const timeout = setTimeout(() => kontroller.abort(), TIMEOUT_MS);

  let svar;
  try {
    svar = await fetch(`${API_URL}${sökväg}`, {
      method: metod,
      signal: kontroller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(kropp ? { body: JSON.stringify(kropp) } : {}),
    });
  } catch (fel) {
    // fetch kastar bara vid nätverksfel eller avbrott – aldrig på HTTP-statuskoder.
    // Bägge fallen betyder samma sak för användaren: appen når inte servern.
    rapporteraAnslutning(false);
    throw nätverksfel(
      fel.name === 'AbortError'
        ? 'Servern svarar inte just nu – kontrollera din anslutning och försök igen'
        : INGEN_ANSLUTNING_TEXT
    );
  } finally {
    clearTimeout(timeout);
  }

  // Vi fick ett svar, alltså finns det en anslutning – även om svaret är ett fel.
  rapporteraAnslutning(true);

  // Läs som text först så vi inte kraschar på icke-JSON-svar (t.ex. 404/502 HTML)
  let rå;
  try {
    rå = await svar.text();
  } catch {
    // Kopplingen bröts mitt i svaret.
    rapporteraAnslutning(false);
    throw nätverksfel(INGEN_ANSLUTNING_TEXT);
  }

  let data = null;
  if (rå) {
    try {
      data = JSON.parse(rå);
    } catch {
      throw new Error(`Servern svarade oväntat (${svar.status})`);
    }
  }

  if (!svar.ok) {
    const err = new Error((data && data.fel) || `Något gick fel (${svar.status})`);
    if (data && data.kod) err.kod = data.kod;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  registrera: (kropp) => anrop('POST', '/auth/registrera', kropp),
  loggaIn: (kropp) => anrop('POST', '/auth/logga-in', kropp),
  skickaVerifieringsmail: (email) => anrop('POST', '/auth/skicka-verifieringsmail', { email }),
  verifieraKod: (email, kod) => anrop('POST', '/auth/verifiera-kod', { email, kod }),
  // Svarar alltid ok, även för okända adresser – servern avslöjar inte vilka som har
  // konto. Själva lösenordet byts sedan på webbsidan som länken i mejlet öppnar.
  glömtLösenord: (email) => anrop('POST', '/auth/glomt-losenord', { email }),

  // Lättaste möjliga anrop – används av AnslutningsContext för att märka när servern
  // kommer tillbaka efter ett avbrott.
  hälsokontroll: () => anrop('GET', '/health'),

  // Användare
  hämtaProfil: () => anrop('GET', '/users/profil'),
  hämtaAnvändareProfil: (id) => anrop('GET', `/users/${id}/profil`),
  // Markerar kontot som inaktivt och raderar all personuppgift (krav från App Store).
  taBortKonto: () => anrop('DELETE', '/users/konto'),

  // Jobb
  hämtaJobb: () => anrop('GET', '/jobb'),
  hämtaJobbId: (id) => anrop('GET', `/jobb/${id}`),
  publicera: (kropp) => anrop('POST', '/jobb', kropp),
  minaJobb: () => anrop('GET', '/jobb/mina'),
  minaTidigareJobb: () => anrop('GET', '/jobb/mina/tidigare'),
  markeraAnsökningarSedda: (jobbId) => anrop('POST', `/jobb/${jobbId}/markera-ansokningar-sedda`, {}),
  uppdateraJobb: (id, kropp) => anrop('PUT', `/jobb/${id}`, kropp),
  taBortJobb: (id) => anrop('DELETE', `/jobb/${id}`),

  // Ansökningar
  sökaJobb: (jobbId, kropp) => anrop('POST', `/ansokningar/${jobbId}`, kropp),
  minaAnsökningar: () => anrop('GET', '/ansokningar/mina'),
  ångraAnsökan: (id) => anrop('DELETE', `/ansokningar/${id}`),
  ansökningarFörJobb: (jobbId) => anrop('GET', `/ansokningar/jobb/${jobbId}`),
  företagsKonversationer: () => anrop('GET', '/ansokningar/foretag'),
  hämtaAnsökanDetaljer: (id) => anrop('GET', `/ansokningar/${id}/detaljer`),
  hämtaKonversationer: () => anrop('GET', '/ansokningar/konversationer'),
  hämtaKonversation: (medAnvandareId) => anrop('GET', `/ansokningar/konversation/${medAnvandareId}`),

  // Meddelanden
  hämtaMeddelanden: (ansokningId) => anrop('GET', `/meddelanden/${ansokningId}`),
  skicka: (ansokningId, kropp) => anrop('POST', `/meddelanden/${ansokningId}`, kropp),

  // Profil
  uppdateraProfil: (kropp) => anrop('PUT', '/users/profil', kropp),
  uppdateraStad: (stad) => anrop('PUT', '/users/stad', { stad }),
  laddaUppProfilBild: (bild) => anrop('POST', '/users/profil-bild', { bild }),
  uppdateraStatus: (ansokningId, status) => anrop('PATCH', `/ansokningar/${ansokningId}/status`, { status }),

  // Push-notifikationer
  sparaPushToken: (token) => anrop('PUT', '/users/push-token', { token }),
  testaNotifikation: () => anrop('POST', '/users/testa-notifikation'),

  // Tidrapporter
  skapaRapport: (kropp) => anrop('POST', '/tidrapporter', kropp),
  hämtaTidrapport: (ansokningId) => anrop('GET', `/tidrapporter/ansokan/${ansokningId}`),
  uppdateraTidrapportStatus: (id, status) => anrop('PATCH', `/tidrapporter/${id}/status`, { status }),
  bestridTidrapport: (id, orsak) => anrop('PATCH', `/tidrapporter/${id}/status`, { status: 'bestridd', orsak }),
  allaRapporter: (fromDate, toDate) => anrop('GET', `/tidrapporter/alla${fromDate || toDate ? `?${fromDate ? 'fromDate=' + fromDate : ''}${fromDate && toDate ? '&' : ''}${toDate ? 'toDate=' + toDate : ''}` : ''}`),
  tidrapporterFörFöretag: () => anrop('GET', '/tidrapporter/foretag'),
  markeraTidrapportBetald: (id) => anrop('PATCH', `/tidrapporter/${id}/betald`, {}),
  hämtaAllaPrivatpersoner: () => anrop('GET', '/users/admin/privatpersoner'),
  hämtaAllaFöretag: () => anrop('GET', '/users/admin/foretag'),
  godkännAvtal: (id) => anrop('PATCH', `/users/admin/${id}/avtal`),

  // Fakturering
  hämtaFaktureringsunderlag: () => anrop('GET', '/fakturering'),
  markeraFakturerad: (id) => anrop('PATCH', `/fakturering/${id}/fakturerad`, {}),

  // Prenumeration (Stripe). Checkout och kundportalen öppnas i webbläsaren.
  prenumerationStatus: () => anrop('GET', '/prenumeration/status'),
  skapaCheckout: () => anrop('POST', '/prenumeration/checkout', {}),
  öppnaPortal: () => anrop('POST', '/prenumeration/portal', {}),

  // Betyg
  sättaBetyg: (ansokningId, kropp) => anrop('POST', `/betyg/${ansokningId}`, kropp),
  hämtaBetyg: (anvandareId) => anrop('GET', `/betyg/anvandare/${anvandareId}`),
  // Avslutade uppdrag som ännu inte betygsatts – underlaget för betygspopupen.
  väntandeBetyg: () => anrop('GET', '/betyg/vantande'),

  // Scheman (längre uppdrag: sommarjobb, säsongsarbete). Ett schema söks som helhet via
  // sitt annons-jobb, så ansökan går genom sökaJobb ovan med schemats annons_jobb_id.
  skapaSchema: (kropp) => anrop('POST', '/scheman', kropp),
  hämtaScheman: () => anrop('GET', '/scheman'),
  hämtaSchema: (id) => anrop('GET', `/scheman/${id}`),
  // Adressförslag via backend-proxyn (Nominatim). Tom lista vid fel eller nedtid.
  sökAdress: (q, stad) =>
    anrop('GET', `/adress/sok?q=${encodeURIComponent(q)}&stad=${encodeURIComponent(stad ?? '')}`),

  minaScheman: () => anrop('GET', '/scheman/mina'),
  markeraSchemaAnsökningarSedda: (schemaId) => anrop('POST', `/scheman/${schemaId}/markera-ansokningar-sedda`, {}),
  minaSchemaPass: () => anrop('GET', '/scheman/mina-pass'),
  uppdateraSchema: (id, kropp) => anrop('PUT', `/scheman/${id}`, kropp),
  läggTillSchemaPass: (id, pass) => anrop('POST', `/scheman/${id}/pass`, { pass }),
  taBortSchemaPass: (id, passId) => anrop('DELETE', `/scheman/${id}/pass/${passId}`),
  ersättPersonISchema: (id, nyAnvandareId) => anrop('PATCH', `/scheman/${id}/ersatt`, { ny_anvandare_id: nyAnvandareId }),
  hoppaAvSchema: (id) => anrop('POST', `/scheman/${id}/hoppa-av`, {}),
  avbrytSchema: (id) => anrop('POST', `/scheman/${id}/avbryt`, {}),
  schemaKalender: (från, till) => anrop('GET', `/scheman/kalender?from=${från}&till=${till}`),
  // Företagets egna tidigare passkategorier – förslag för fri text i pass-modalen.
  schemaKategorier: () => anrop('GET', '/scheman/kategorier'),
  hämtaSchemaAvdrag: (id) => anrop('GET', `/scheman/${id}/avdrag`),
  skapaSchemaAvdrag: (id, kropp) => anrop('POST', `/scheman/${id}/avdrag`, kropp),
  taBortSchemaAvdrag: (id, avdragId) => anrop('DELETE', `/scheman/${id}/avdrag/${avdragId}`),

  // Korrigerar en automatiskt skapad tidrapport som ännu väntar på svar (övertid/rast).
  // Efter ett bestridande skickas i stället en ny rapport via skapaRapport.
  korrigeraTidrapport: (id, kropp) => anrop('PATCH', `/tidrapporter/${id}/korrigera`, kropp),

  // Jobbförfrågningar (erbjud pass via chatten)
  skapaJobbforfragan: (kropp) => anrop('POST', '/jobbforfragan', kropp),
  hämtaJobbforfragningar: (medAnvandareId) => anrop('GET', `/jobbforfragan/konversation/${medAnvandareId}`),
  väntandeJobbforfragningar: () => anrop('GET', '/jobbforfragan/mina-vantande'),
  accepteraJobbforfragan: (id) => anrop('PATCH', `/jobbforfragan/${id}/acceptera`, {}),
  avbojJobbforfragan: (id) => anrop('PATCH', `/jobbforfragan/${id}/avboj`, {}),
};
