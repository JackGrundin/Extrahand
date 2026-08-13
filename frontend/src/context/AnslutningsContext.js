import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, harInternetanslutning, lyssnaPåAnslutning } from '../api/klient';

const AnslutningsContext = createContext(null);

// Hur ofta vi själva testar om servern kommit tillbaka medan vi ligger nere. Tätare
// än så är slöseri på ett nät som ändå är borta; glesare gör att bannern ligger kvar
// långt efter att anslutningen kommit tillbaka.
const ÅTERFÖRSÖK_MS = 5000;

// Håller reda på om appen når servern. Statusen kommer från de riktiga API-anropen
// (klient.js rapporterar varje lyckat och misslyckat anrop) i stället för från en
// separat nätverkslyssnare – det är servern vi bryr oss om, och telefonen kan mycket
// väl ha wifi utan att komma vidare därifrån.
//
// Att undvika @react-native-community/netinfo är också ett medvetet val: det är en
// native-modul och hade krävt en ny app-build för att fungera.
export function AnslutningsProvider({ children }) {
  const [uppkopplad, setUppkopplad] = useState(harInternetanslutning());
  const uppkoppladRef = useRef(uppkopplad);
  uppkoppladRef.current = uppkopplad;

  useEffect(() => lyssnaPåAnslutning(setUppkopplad), []);

  // Medan vi är nere pingar vi hälsokontrollen tills servern svarar igen. Utan detta
  // ligger bannern kvar tills användaren råkar göra något som utlöser ett API-anrop.
  useEffect(() => {
    if (uppkopplad) return;
    const intervall = setInterval(async () => {
      if (uppkoppladRef.current) return;
      // Anropet rapporterar själv in resultatet till klient.js, som i sin tur väcker
      // lyssnaren ovan. Felet är väntat medan nätet är nere och ska inte loggas.
      try { await api.hälsokontroll(); } catch {}
    }, ÅTERFÖRSÖK_MS);
    return () => clearInterval(intervall);
  }, [uppkopplad]);

  return (
    <AnslutningsContext.Provider value={{ uppkopplad }}>
      {children}
    </AnslutningsContext.Provider>
  );
}

export const useAnslutning = () => useContext(AnslutningsContext) ?? { uppkopplad: true };
