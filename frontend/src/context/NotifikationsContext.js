import { createContext, useCallback, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fastgig_chat_last_seen';

const NotifikationsContext = createContext({
  totalOlästa: 0,
  olästaIds: new Set(),
  uppdateraOlästa: async () => {},
  markeraLäst: async () => {},
});

export function NotifikationsProvider({ children }) {
  const [totalOlästa, setTotalOlästa] = useState(0);
  const [olästaIds, setOlästaIds] = useState(new Set());

  const uppdateraOlästa = useCallback(async (konversationer, användareId) => {
    if (!användareId || !konversationer?.length) {
      setTotalOlästa(0);
      setOlästaIds(new Set());
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const senastSedd = raw ? JSON.parse(raw) : {};

      const olästa = konversationer.filter(k => {
        const sm = k.senasteMeddelande;
        if (!sm) return false;
        if (sm.avsandare_id === användareId) return false;
        const sedd = senastSedd[k.id];
        if (!sedd) return true;
        return new Date(sm.created_at) > new Date(sedd);
      });

      setTotalOlästa(olästa.length);
      setOlästaIds(new Set(olästa.map(k => k.id)));
    } catch {
      setTotalOlästa(0);
      setOlästaIds(new Set());
    }
  }, []);

  const markeraLäst = useCallback(async (ansokningId) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const senastSedd = raw ? JSON.parse(raw) : {};
      senastSedd[ansokningId] = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(senastSedd));
      setTotalOlästa(prev => Math.max(0, prev - 1));
      setOlästaIds(prev => {
        const nästa = new Set(prev);
        nästa.delete(ansokningId);
        return nästa;
      });
    } catch {}
  }, []);

  return (
    <NotifikationsContext.Provider value={{ totalOlästa, olästaIds, uppdateraOlästa, markeraLäst }}>
      {children}
    </NotifikationsContext.Provider>
  );
}

export const useNotifikationer = () => useContext(NotifikationsContext);
