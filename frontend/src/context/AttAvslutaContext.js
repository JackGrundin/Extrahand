import { createContext, useCallback, useContext, useState } from 'react';
import { api } from '../api/klient';
import { behöverAvslutas } from '../utils/datumHelper';

// Håller reda på hur många av företagets pass som passerat sluttiden men ännu
// inte avslutats (ingen tidrapport skapad). Används för badgen på Mina jobb-fliken.
const AttAvslutaContext = createContext({
  antalAttAvsluta: 0,
  setAntalAttAvsluta: () => {},
  uppdateraAttAvsluta: async () => {},
});

export function AttAvslutaProvider({ children }) {
  const [antalAttAvsluta, setAntalAttAvsluta] = useState(0);

  // Självständig hämtning som kan seedas vid inloggning, innan Mina jobb-fliken öppnats.
  const uppdateraAttAvsluta = useCallback(async () => {
    try {
      const [jobb, tidigareJobb, rapporter] = await Promise.all([
        api.minaJobb(),
        api.minaTidigareJobb(),
        api.tidrapporterFörFöretag(),
      ]);
      const avslutadeJobbIds = new Set((rapporter ?? []).map(p => p.jobbId).filter(Boolean));
      const aktiva = [...(jobb ?? []), ...(tidigareJobb ?? [])].filter(j => !avslutadeJobbIds.has(j.id));
      setAntalAttAvsluta(aktiva.filter(j => behöverAvslutas(j.arbetstider)).length);
    } catch {
      // Behåll tidigare värde vid fel så badgen inte blinkar bort.
    }
  }, []);

  return (
    <AttAvslutaContext.Provider value={{ antalAttAvsluta, setAntalAttAvsluta, uppdateraAttAvsluta }}>
      {children}
    </AttAvslutaContext.Provider>
  );
}

export const useAttAvsluta = () => useContext(AttAvslutaContext);
