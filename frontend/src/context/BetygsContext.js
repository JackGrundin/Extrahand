import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/klient';
import { useAuth } from './AuthContext';
import { useRealtidsPing } from './RealtidsContext';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import BetygModal from '../components/BetygModal';

const NYCKEL = 'fastgig.betyg.hoppadeOver';

const BetygsContext = createContext({ kollaBetyg: () => {} });

export function useBetyg() {
  return useContext(BetygsContext);
}

// Betygsprompten. Monteras EN gång i App.js och lever utanför navigatorn, så popupen kan
// komma upp var man än befinner sig i appen – inte bara i chatten där tidrapporten ligger.
//
// Underlaget kommer från GET /api/betyg/vantande, som redan grupperar ett schema till ETT
// uppdrag. Här görs ingen egen gruppering.
export function BetygsProvider({ children }) {
  const { användare } = useAuth();
  const ärFöretag = användare?.typ === 'företag';

  const [kö, setKö] = useState([]);
  const [visas, setVisas] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [hoppadeÖver, setHoppadeÖver] = useState(null); // null = inte inläst ännu

  // Utan ref skulle hämtningen läsa en inaktuell skip-lista via closuren.
  const hoppadeRef = useRef(new Set());
  hoppadeRef.current = hoppadeÖver ?? new Set();

  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const rå = await AsyncStorage.getItem(NYCKEL);
        const lista = rå ? JSON.parse(rå) : [];
        if (!avbruten) setHoppadeÖver(new Set(Array.isArray(lista) ? lista.map(String) : []));
      } catch {
        if (!avbruten) setHoppadeÖver(new Set());
      }
    })();
    return () => { avbruten = true; };
  }, []);

  const kollaBetyg = useCallback(async () => {
    // Skip-listan måste vara inläst först, annars blinkar en redan överhoppad post förbi.
    if (!användare || hoppadeÖver == null) return;
    try {
      const väntande = await api.väntandeBetyg();
      const kvar = (väntande || []).filter(p => !hoppadeRef.current.has(String(p.ansokanId)));
      setKö(kvar);
      setVisas(kvar.length > 0);
    } catch {
      // Tyst: prompten är en påminnelse, inte något användaren bad om. Ett nätverksfel här
      // ska inte ge en felruta mitt i något annat.
    }
  }, [användare, hoppadeÖver]);

  useEffect(() => {
    if (!användare) { setKö([]); setVisas(false); return; }
    kollaBetyg();
  }, [användare, kollaBetyg]);

  useAppStateAktiv(() => { kollaBetyg(); });

  // 'tidrapport' = motparten godkände just rapporten, 'betyg' = någon betygsatte oss (kan
  // betyda att uppdraget är avslutat i den andra änden). Övriga pingar är ovidkommande.
  useRealtidsPing((payload) => {
    if (payload?.typ === 'tidrapport' || payload?.typ === 'betyg') kollaBetyg();
  });

  const aktuell = kö[0] ?? null;

  // Räknas ut utanför setKö-uppdateraren: en state-uppdaterare får inte ha sidoeffekter,
  // React kan köra den två gånger.
  function tillNästa() {
    const kvar = kö.slice(1);
    setKö(kvar);
    setVisas(kvar.length > 0);
  }

  async function skicka({ stjarnor, kommentar }) {
    if (!aktuell) return;
    setSparar(true);
    try {
      await api.sättaBetyg(aktuell.ansokanId, { stjarnor, kommentar });
      tillNästa();
    } catch (fel) {
      // 409 = redan betygsatt, t.ex. från en annan inloggad session. Det är inget fel för
      // användaren, uppdraget är klart – gå vidare i stället för att visa en felruta.
      if (/redan betygsatt/i.test(fel?.message ?? '')) tillNästa();
      else setVisas(false);
    } finally {
      setSparar(false);
    }
  }

  async function hoppaÖver() {
    if (!aktuell) return;
    const id = String(aktuell.ansokanId);
    const ny = new Set(hoppadeRef.current);
    ny.add(id);
    setHoppadeÖver(ny);
    // Bara lokalt: det här är en UI-preferens, inte något servern behöver veta. Stjärnikonen
    // i chattens header finns kvar för den som ändrar sig.
    AsyncStorage.setItem(NYCKEL, JSON.stringify([...ny])).catch(() => {});
    setKö(prev => prev.filter(p => String(p.ansokanId) !== id));
    setVisas(false);
  }

  return (
    <BetygsContext.Provider value={{ kollaBetyg }}>
      {children}
      <BetygModal
        visible={visas && !!aktuell}
        post={aktuell}
        ärFöretag={ärFöretag}
        laddar={sparar}
        onSkicka={skicka}
        onHoppaÖver={hoppaÖver}
      />
    </BetygsContext.Provider>
  );
}
