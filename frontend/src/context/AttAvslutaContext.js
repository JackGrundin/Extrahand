import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
      const [jobb, tidigareJobb, rapporter, scheman] = await Promise.all([
        api.minaJobb(),
        api.minaTidigareJobb(),
        api.tidrapporterFörFöretag(),
        api.minaScheman(),
      ]);
      const avslutadeJobbIds = new Set((rapporter ?? []).map(p => p.jobbId).filter(Boolean));
      const aktiva = [...(jobb ?? []), ...(tidigareJobb ?? [])].filter(j => !avslutadeJobbIds.has(j.id));
      setAntalAttAvsluta(aktiva.filter(j => behöverAvslutas(j.arbetstider) && j.harGodkänd).length);
      // Nya ansökningar räknas per jobb och per schema av backend (nyaAnsökningar) – summera
      // för badgen. Ingen dubbelräkning: schemats annons-jobb filtreras bort ur minaJobb()
      // med .is('schema_id', null), så det kan bara komma in via scheman-listan.
      setAntalNyaAnsökningar(
        (jobb ?? []).reduce((sum, j) => sum + (j.nyaAnsökningar || 0), 0) +
        (scheman ?? []).reduce((sum, s) => sum + (s.nyaAnsökningar || 0), 0)
      );
    } catch {
      // Behåll tidigare värde vid fel så badgen inte blinkar bort.
    }
  }, []);

  // Nytt värde bara när räknarna ändras. setAntalAttAvsluta (useState) och
  // uppdateraAttAvsluta (useCallback) är stabila, så badge-consumers i navigatorn slipper
  // rendera om vid varje providerrender.
  const värde = useMemo(
    () => ({ antalAttAvsluta, antalNyaAnsökningar, setAntalAttAvsluta, uppdateraAttAvsluta }),
    [antalAttAvsluta, antalNyaAnsökningar, uppdateraAttAvsluta]
  );

  return (
    <AttAvslutaContext.Provider value={värde}>
      {children}
    </AttAvslutaContext.Provider>
  );
}

export const useAttAvsluta = () => useContext(AttAvslutaContext);
