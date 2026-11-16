import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/klient';

// Håller reda på hur många av privatpersonens pass som nyligen blivit GODKÄNDA utan att hen
// sett det än. Driver en orange prick på Mina pass-fliken och på själva passkortet, som
// släcks när skärmen öppnats – samma princip som den orangea tidrapport-pricken i chattlistan.
//
// Klientsidig snapshot (ingen DB-migration): nyckeln lagrar id:n på de godkända pass som
// redan setts. Ett godkänt pass vars id inte finns i listan är "nytt". Samma mönster och
// nyckelnamn som webbens fastgig.pass.sedda i PrivatSkal.jsx.
const SEDDA_NYCKEL = 'fastgig.pass.sedda';

// Godkända ansökningar som motsvarar ett kort under Mina pass: schemats samlade kort och
// enstaka pass (schemaPassId == null). Per-pass-ansökningarna i ett schema (schemaPassId satt)
// är interna och ska inte ge egna prickar.
function godkändaPassIds(ansökningar) {
  return (ansökningar ?? [])
    .filter(a => a.status === 'godkänd' && a.schemaPassId == null)
    .map(a => String(a.id));
}

async function läsSedda() {
  try {
    const rått = await AsyncStorage.getItem(SEDDA_NYCKEL);
    if (rått == null) return null; // null = aldrig seedad → seedas av anroparen
    const lista = JSON.parse(rått);
    return Array.isArray(lista) ? lista.map(String) : [];
  } catch {
    return [];
  }
}

async function skrivSedda(ids) {
  try { await AsyncStorage.setItem(SEDDA_NYCKEL, JSON.stringify(ids)); } catch {}
}

const NyaPassContext = createContext({
  antalNyaPass: 0,
  nyaPassIds: [],
  uppdateraNyaPass: async () => {},
  markeraPassSedda: async () => {},
});

export function NyaPassProvider({ children }) {
  const [antalNyaPass, setAntalNyaPass] = useState(0);
  const [nyaPassIds, setNyaPassIds] = useState([]);

  // Räknar om antalet nya godkända pass. Kan seedas vid inloggning, innan Mina pass öppnats.
  const uppdateraNyaPass = useCallback(async () => {
    try {
      const godkända = godkändaPassIds(await api.minaAnsökningar());
      const sedda = await läsSedda();
      if (sedda == null) {
        // Första gången: seeda utan att tända prickar (ingen retroaktiv prick på gamla pass).
        await skrivSedda(godkända);
        setNyaPassIds([]);
        setAntalNyaPass(0);
        return;
      }
      const seddaSet = new Set(sedda);
      const nya = godkända.filter(id => !seddaSet.has(id));
      setNyaPassIds(nya);
      setAntalNyaPass(nya.length);
    } catch {
      // Behåll tidigare värde vid fel så badgen inte blinkar bort.
    }
  }, []);

  // Markerar alla nuvarande godkända pass som sedda (släcker flikbadgen). Anroparen kan skicka
  // in de aktuella id:na för att slippa ett extra API-anrop (Mina pass har dem redan).
  const markeraPassSedda = useCallback(async (godkändaIds) => {
    let ids = godkändaIds;
    if (!ids) {
      try { ids = godkändaPassIds(await api.minaAnsökningar()); } catch { ids = null; }
    }
    if (ids) await skrivSedda(ids);
    setNyaPassIds([]);
    setAntalNyaPass(0);
  }, []);

  const värde = useMemo(
    () => ({ antalNyaPass, nyaPassIds, uppdateraNyaPass, markeraPassSedda }),
    [antalNyaPass, nyaPassIds, uppdateraNyaPass, markeraPassSedda]
  );

  return (
    <NyaPassContext.Provider value={värde}>
      {children}
    </NyaPassContext.Provider>
  );
}

export const useNyaPass = () => useContext(NyaPassContext);
