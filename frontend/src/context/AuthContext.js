import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { api } from '../api/klient';

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
        await AsyncStorage.removeItem('token');
      } finally {
        setLaddar(false);
      }
    }
    kontrolleraToken();
  }, []);

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
  // och sparar den på profilen. Tyst om tillstånd nekas – då anger man staden
  // manuellt i profilen istället.
  async function begärOchSparaStad() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const [plats] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const stad = plats?.city || plats?.subregion || plats?.region;
      if (!stad) return;

      await api.uppdateraStad(stad);
      setAnvändare((prev) => (prev ? { ...prev, stad } : prev));
    } catch {
      // Funkar inte i simulator / utan plats – ignorera tyst
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
