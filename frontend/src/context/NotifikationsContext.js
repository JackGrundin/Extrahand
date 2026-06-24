import { createContext, useCallback, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// v2: konversationer grupperas numera per motpart (användar-id) istället för per
// ansökan. Nyckelrymden för "senast sedd" ändrades därmed – bumpa nyckeln så att
// gammal data (ansökans-id) inte krockar med motpartens id och döljer badgen.
const STORAGE_KEY = 'fastgig_chat_last_seen_v2';

const NotifikationsContext = createContext({
  totalOlästa: 0,
  olästaIds: new Set(),
  uppdateraOlästa: async () => {},
  markeraLäst: async () => {},
});

export function NotifikationsProvider({ children }) {
  const [olästaIds, setOlästaIds] = useState(new Set());

  // Räknaren härleds alltid från mängden olästa – då kan den aldrig hamna i
  // otakt med prickarna i chattlistan.
  const totalOlästa = olästaIds.size;

  const uppdateraOlästa = useCallback(async (konversationer, användareId) => {
    if (!användareId || !konversationer?.length) {
      setOlästaIds(new Set());
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const senastSedd = raw ? JSON.parse(raw) : {};

      const olästa = konversationer.filter(k => {
        const sm = k.senasteMeddelande;
        if (!sm) return false;
        // Egna meddelanden räknas inte som olästa (jämför som sträng för säkerhets skull)
        if (String(sm.avsandare_id) === String(användareId)) return false;
        const sedd = senastSedd[String(k.id)];
        if (!sedd) return true;
        return new Date(sm.created_at) > new Date(sedd);
      });

      setOlästaIds(new Set(olästa.map(k => String(k.id))));
    } catch {
      setOlästaIds(new Set());
    }
  }, []);

  const markeraLäst = useCallback(async (konversationId) => {
    const nyckel = String(konversationId);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const senastSedd = raw ? JSON.parse(raw) : {};
      senastSedd[nyckel] = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(senastSedd));
    } catch {}
    // Ta bort ur mängden olästa – räknaren följer automatiskt med
    setOlästaIds(prev => {
      if (!prev.has(nyckel)) return prev;
      const nästa = new Set(prev);
      nästa.delete(nyckel);
      return nästa;
    });
  }, []);

  return (
    <NotifikationsContext.Provider value={{ totalOlästa, olästaIds, uppdateraOlästa, markeraLäst }}>
      {children}
    </NotifikationsContext.Provider>
  );
}

export const useNotifikationer = () => useContext(NotifikationsContext);
