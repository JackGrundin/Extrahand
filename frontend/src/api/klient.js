import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.fastgig.se/api';

async function anrop(metod, sökväg, kropp) {
  const token = await AsyncStorage.getItem('token');

  const svar = await fetch(`${API_URL}${sökväg}`, {
    method: metod,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(kropp ? { body: JSON.stringify(kropp) } : {}),
  });

  // Läs som text först så vi inte kraschar på icke-JSON-svar (t.ex. 404/502 HTML)
  const rå = await svar.text();
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

  // Användare
  hämtaProfil: () => anrop('GET', '/users/profil'),
  hämtaAnvändareProfil: (id) => anrop('GET', `/users/${id}/profil`),

  // Jobb
  hämtaJobb: () => anrop('GET', '/jobb'),
  hämtaJobbId: (id) => anrop('GET', `/jobb/${id}`),
  publicera: (kropp) => anrop('POST', '/jobb', kropp),
  minaJobb: () => anrop('GET', '/jobb/mina'),
  minaTidigareJobb: () => anrop('GET', '/jobb/mina/tidigare'),
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
  allaRapporter: (fromDate, toDate) => anrop('GET', `/tidrapporter/alla${fromDate || toDate ? `?${fromDate ? 'fromDate=' + fromDate : ''}${fromDate && toDate ? '&' : ''}${toDate ? 'toDate=' + toDate : ''}` : ''}`),
  tidrapporterFörFöretag: () => anrop('GET', '/tidrapporter/foretag'),
  markeraTidrapportBetald: (id) => anrop('PATCH', `/tidrapporter/${id}/betald`, {}),
  hämtaAllaPrivatpersoner: () => anrop('GET', '/users/admin/privatpersoner'),
  hämtaAllaFöretag: () => anrop('GET', '/users/admin/foretag'),
  godkännAvtal: (id) => anrop('PATCH', `/users/admin/${id}/avtal`),

  // Fakturering
  hämtaFaktureringsunderlag: () => anrop('GET', '/fakturering'),
  markeraFakturerad: (id) => anrop('PATCH', `/fakturering/${id}/fakturerad`, {}),

  // Betyg
  sättaBetyg: (ansokningId, kropp) => anrop('POST', `/betyg/${ansokningId}`, kropp),
  hämtaBetyg: (anvandareId) => anrop('GET', `/betyg/anvandare/${anvandareId}`),

  // Jobbförfrågningar (erbjud pass via chatten)
  skapaJobbforfragan: (kropp) => anrop('POST', '/jobbforfragan', kropp),
  hämtaJobbforfragningar: (medAnvandareId) => anrop('GET', `/jobbforfragan/konversation/${medAnvandareId}`),
  väntandeJobbforfragningar: () => anrop('GET', '/jobbforfragan/mina-vantande'),
  accepteraJobbforfragan: (id) => anrop('PATCH', `/jobbforfragan/${id}/acceptera`, {}),
  avbojJobbforfragan: (id) => anrop('PATCH', `/jobbforfragan/${id}/avboj`, {}),
};
