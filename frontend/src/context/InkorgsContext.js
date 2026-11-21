import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../api/klient';

// Håller antalet åtgärder i inkorgen (härledd lista från GET /api/inkorg). Driver en röd/orange
// badge på Inkorg-fliken. Till skillnad från NyaPassContext behövs ingen klientsidig snapshot:
// en post FÖRSVINNER automatiskt när åtgärden utförts, så count:en är alltid "kvarvarande att
// göra" och nollas av sig själv. Seedas vid inloggning och räknas om på realtidssignaler.
const InkorgsContext = createContext({
  antalInkorg: 0,
  uppdateraInkorg: async () => {},
});

export function InkorgsProvider({ children }) {
  const [antalInkorg, setAntalInkorg] = useState(0);

  const uppdateraInkorg = useCallback(async () => {
    try {
      const svar = await api.hämtaInkorg();
      const poster = Array.isArray(svar?.poster) ? svar.poster : [];
      setAntalInkorg(poster.length);
    } catch {
      // Behåll tidigare värde vid fel så badgen inte blinkar bort.
    }
  }, []);

  const värde = useMemo(
    () => ({ antalInkorg, uppdateraInkorg }),
    [antalInkorg, uppdateraInkorg]
  );

  return (
    <InkorgsContext.Provider value={värde}>
      {children}
    </InkorgsContext.Provider>
  );
}

export const useInkorg = () => useContext(InkorgsContext);
