import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { api, lyssnaPåAuthFel } from '../api/klient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [användare, setAnvändare] = useState(null);
  const [laddar, setLaddar] = useState(true);

  useEffect(() => {
    async function kontrolleraToken() {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const profil = await api.hämtaProfil();
          setAnvändare(profil);
          // Be om plats när privatpersoner öppnar appen igen
          if (profil?.typ === 'privatperson') begärOchSparaStad();
        }
      } catch {
        // Ta INTE bort token här. Ett tillfälligt nätverks- eller serverfel vid uppstart
        // (telefonen precis vaknat, en 500-blip) förr raderade en fullt giltig token och
        // loggade ut användaren i onödan. Är token däremot ogiltig/utgången svarar backend
        // 401, och då sköter auth-fel-lyssnaren nedan utloggningen centralt.
      } finally {
        setLaddar(false);
      }
    }
    kontrolleraToken();
  }, []);

  // Central återhämtning: när ett autentiserat anrop avvisas med 401 (token saknas,
  // ogiltig eller utgången) loggar vi ut. loggaUt nollar token och sätter användare till
  // null, vilket får rot-navigatorn att byta till inloggningsskärmen – i stället för att
  // användaren fastnar på en trasig skärm med tysta console-fel.
  useEffect(() => lyssnaPåAuthFel(() => { loggaUt(); }), []);

  async function registreraPushToken() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await api.sparaPushToken(token);
    } catch {
      // Fungerar inte i simulator – ignorera
    }
  }

  // Frågar om platstillstånd, hittar användarens stad via GPS + reverse geocoding
  // och sparar den på profilen. Om tillstånd nekas anger man staden manuellt i
  // profilen istället. Loggar varje steg så att man kan felsöka om dialogen
  // uteblir (oftast: appen behöver byggas om efter att expo-location lades till).
  async function begärOchSparaStad() {
    try {
      console.log('[plats] begär platstillstånd...');
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      console.log('[plats] tillståndsstatus:', status, 'canAskAgain:', canAskAgain);
      if (status !== 'granted') return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const [plats] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const stad = plats?.city || plats?.subregion || plats?.region;
      console.log('[plats] härledd stad:', stad);
      if (!stad) return;

      await api.uppdateraStad(stad);
      setAnvändare((prev) => (prev ? { ...prev, stad } : prev));
    } catch (fel) {
      // Vanligast: expo-location saknas i bygget (appen behöver byggas om), eller
      // körs i en simulator utan plats. Logga så felet inte döljs.
      console.warn('[plats] kunde inte hämta plats:', fel?.message ?? fel);
    }
  }

  async function loggaIn(email, lösenord) {
    const svar = await api.loggaIn({ email, lösenord });
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
    registreraPushToken();
    if (svar.användare?.typ === 'privatperson') begärOchSparaStad();
  }

  async function registrera(namn, email, lösenord, typ, företagsInfo = {}) {
    const svar = await api.registrera({ namn, email, lösenord, typ, ...företagsInfo });
    // Inväntar e-postverifiering – logga inte in ännu
    if (svar.väntarVerifiering) return svar;
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
    registreraPushToken();
    if (svar.användare?.typ === 'privatperson') begärOchSparaStad();
    return svar;
  }

  async function loggaUt() {
    await AsyncStorage.removeItem('token');
    setAnvändare(null);
  }

  return (
    <AuthContext.Provider value={{ användare, laddar, loggaIn, registrera, loggaUt, sättAnvändare: setAnvändare }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
