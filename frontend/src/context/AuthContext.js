import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
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

  async function loggaIn(email, lösenord) {
    const svar = await api.loggaIn({ email, lösenord });
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
    registreraPushToken();
  }

  async function registrera(namn, email, lösenord, typ, företagsInfo = {}) {
    const svar = await api.registrera({ namn, email, lösenord, typ, ...företagsInfo });
    // Inväntar e-postverifiering – logga inte in ännu
    if (svar.väntarVerifiering) return svar;
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
    registreraPushToken();
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
