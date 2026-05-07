import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  async function loggaIn(email, lösenord) {
    const svar = await api.loggaIn({ email, lösenord });
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
  }

  async function registrera(namn, email, lösenord, typ) {
    const svar = await api.registrera({ namn, email, lösenord, typ });
    await AsyncStorage.setItem('token', svar.token);
    setAnvändare(svar.användare);
  }

  async function loggaUt() {
    await AsyncStorage.removeItem('token');
    setAnvändare(null);
  }

  return (
    <AuthContext.Provider value={{ användare, laddar, loggaIn, registrera, loggaUt }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
