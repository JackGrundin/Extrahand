import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.74:3000/api';

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

  // Jobb
  hämtaJobb: () => anrop('GET', '/jobb'),
  hämtaJobb_id: (id) => anrop('GET', `/jobb/${id}`),
  publicera: (kropp) => anrop('POST', '/jobb', kropp),

  // Ansökningar
  sökaJobb: (jobbId, kropp) => anrop('POST', `/ansokningar/${jobbId}`, kropp),
  minaAnsökningar: () => anrop('GET', '/ansokningar/mina'),
  ansökningarFörJobb: (jobbId) => anrop('GET', `/ansokningar/jobb/${jobbId}`),

  // Meddelanden
  hämtaMeddelanden: (ansokningId) => anrop('GET', `/meddelanden/${ansokningId}`),
  skicka: (ansokningId, kropp) => anrop('POST', `/meddelanden/${ansokningId}`, kropp),

  // Profil
  uppdateraProfil: (kropp) => anrop('PUT', '/users/profil', kropp),
  laddaUppProfilBild: (bild) => anrop('POST', '/users/profil-bild', { bild }),
  loggaTimmar: (ansokningId, timmar) => anrop('PUT', `/ansokningar/${ansokningId}/timmar`, { timmar }),

  // Push-notifikationer
  sparaPushToken: (token) => anrop('PUT', '/users/push-token', { token }),
  testaNotifikation: () => anrop('POST', '/users/testa-notifikation'),

  // Betyg
  sättaBetyg: (ansokningId, kropp) => anrop('POST', `/betyg/${ansokningId}`, kropp),
  hämtaBetyg: (anvandareId) => anrop('GET', `/betyg/anvandare/${anvandareId}`),
};
