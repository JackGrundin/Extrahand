import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.102:3000/api';

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

  const data = await svar.json();

  if (!svar.ok) {
    throw new Error(data.fel || 'Något gick fel');
  }

  return data;
}

export const api = {
  // Auth
  registrera: (kropp) => anrop('POST', '/auth/registrera', kropp),
  loggaIn: (kropp) => anrop('POST', '/auth/logga-in', kropp),

  // Användare
  hämtaProfil: () => anrop('GET', '/users/profil'),
  hämtaAnvändareProfil: (id) => anrop('GET', `/users/${id}/profil`),

  // Jobb
  hämtaJobb: () => anrop('GET', '/jobb'),
  hämtaJobb_id: (id) => anrop('GET', `/jobb/${id}`),
  publicera: (kropp) => anrop('POST', '/jobb', kropp),
  minaJobb: () => anrop('GET', '/jobb/mina'),
  uppdateraJobb: (id, kropp) => anrop('PUT', `/jobb/${id}`, kropp),
  taBortJobb: (id) => anrop('DELETE', `/jobb/${id}`),

  // Ansökningar
  sökaJobb: (jobbId, kropp) => anrop('POST', `/ansokningar/${jobbId}`, kropp),
  minaAnsökningar: () => anrop('GET', '/ansokningar/mina'),
  ångraAnsökan: (id) => anrop('DELETE', `/ansokningar/${id}`),
  ansökningarFörJobb: (jobbId) => anrop('GET', `/ansokningar/jobb/${jobbId}`),
  företagsKonversationer: () => anrop('GET', '/ansokningar/foretag'),

  // Meddelanden
  hämtaMeddelanden: (ansokningId) => anrop('GET', `/meddelanden/${ansokningId}`),
  skicka: (ansokningId, kropp) => anrop('POST', `/meddelanden/${ansokningId}`, kropp),

  // Profil
  uppdateraProfil: (kropp) => anrop('PUT', '/users/profil', kropp),
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
  taBortTidrapport: (id) => anrop('DELETE', `/tidrapporter/${id}`),
  hämtaAllaPrivatpersoner: () => anrop('GET', '/users/admin/privatpersoner'),
  godkännAvtal: (id) => anrop('PATCH', `/users/admin/${id}/avtal`),

  // Betyg
  sättaBetyg: (ansokningId, kropp) => anrop('POST', `/betyg/${ansokningId}`, kropp),
  hämtaBetyg: (anvandareId) => anrop('GET', `/betyg/anvandare/${anvandareId}`),
};
