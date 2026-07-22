import { createContext, useCallback, useContext, useState } from 'react';
import { api } from '../api/klient';
import { behöverAvslutas } from '../utils/datumHelper';

// Håller reda på hur många av företagets pass som behöver uppmärksamhet på Mina jobb:
// dels pass som passerat sluttiden men ännu inte avslutats (ingen tidrapport skapad),
// dels nya olästa ansökningar. Summan visas som badge på Mina jobb-fliken.
const AttAvslutaContext = createContext({
  antalAttAvsluta: 0,
  antalNyaAnsökningar: 0,
  setAntalAttAvsluta: () => {},
  uppdateraAttAvsluta: async () => {},
});

export function AttAvslutaProvider({ children }) {
  const [antalAttAvsluta, setAntalAttAvsluta] = useState(0);
  const [antalNyaAnsökningar, setAntalNyaAnsökningar] = useState(0);

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
      setAntalAttAvsluta(aktiva.filter(j => behöverAvslutas(j.arbetstider) && j.harGodkänd).length);
      // Nya ansökningar räknas per jobb av backend (nyaAnsökningar) – summera för badgen.
      setAntalNyaAnsökningar((jobb ?? []).reduce((sum, j) => sum + (j.nyaAnsökningar || 0), 0));
    } catch {
      // Behåll tidigare värde vid fel så badgen inte blinkar bort.
    }
  }, []);

  return (
    <AttAvslutaContext.Provider value={{ antalAttAvsluta, antalNyaAnsökningar, setAntalAttAvsluta, uppdateraAttAvsluta }}>
      {children}
    </AttAvslutaContext.Provider>
  );
}

export const useAttAvsluta = () => useContext(AttAvslutaContext);
