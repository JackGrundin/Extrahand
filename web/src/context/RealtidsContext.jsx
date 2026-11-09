'use client';

// Realtid via Supabase Broadcast – speglar frontend/src/context/RealtidsContext.js.
// Monteras i root-layouten och täcker hela den inloggade produkten (företag + privatperson).
// Den inloggade användaren prenumererar ENBART på sin egen privata kanal (`anvandare:<id>`)
// och tar emot lättviktiga signaler utan känsligt innehåll (backend skickar bara en
// typ-etikett). Signalen används som trigger; själva datan hämtas via det JWT-skyddade API:t.
// Ingen tabellpublikation eller RLS-öppning krävs. (Jobblista-kanalen behövs bara för
// privatpersoners jobblista och utelämnas här.)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const RealtidsContext = createContext({ registrera: () => () => {}, registreraJobblista: () => () => {} });

export function RealtidsProvider({ children }) {
  const { användare } = useAuth();
  const lyssnare = useRef(new Set());
  // Separat lyssnaruppsättning för den delade jobblista-kanalen. Hålls isär så att en
  // jobbhändelse bara triggar jobblistans hämtning – inte t.ex. badge-/toast-lyssnarna.
  const jobblistaLyssnare = useRef(new Set());

  const registrera = useCallback((callback) => {
    lyssnare.current.add(callback);
    return () => lyssnare.current.delete(callback);
  }, []);

  const registreraJobblista = useCallback((callback) => {
    jobblistaLyssnare.current.add(callback);
    return () => jobblistaLyssnare.current.delete(callback);
  }, []);

  useEffect(() => {
    if (!supabase || !användare?.id) return undefined;

    const kanal = supabase
      .channel(`anvandare:${användare.id}`)
      .on('broadcast', { event: 'ny' }, (meddelande) => {
        for (const callback of lyssnare.current) {
          try {
            callback(meddelande?.payload);
          } catch {
            /* en trasig lyssnare får inte stoppa övriga */
          }
        }
      });
    kanal.subscribe();

    return () => {
      supabase.removeChannel(kanal);
    };
  }, [användare?.id]);

  // Delad kanal för den publika jobblistan (jobb publiceras, ändras, tas bort eller blir
  // tillsatt/ledigt). Till skillnad från appen – där bara privatpersoner prenumererar –
  // prenumererar webben oavsett inloggning, eftersom /jobb är en PUBLIK sida som även
  // utloggade besökare ser. Kanalen bär bara en typ-etikett och fungerar med anon-nyckeln,
  // så inget känsligt exponeras.
  useEffect(() => {
    if (!supabase) return undefined;

    const kanal = supabase
      .channel('jobblista')
      .on('broadcast', { event: 'ny' }, (meddelande) => {
        for (const callback of jobblistaLyssnare.current) {
          try {
            callback(meddelande?.payload);
          } catch {
            /* en trasig lyssnare får inte stoppa övriga */
          }
        }
      });
    kanal.subscribe();

    return () => {
      supabase.removeChannel(kanal);
    };
  }, []);

  const värde = useMemo(() => ({ registrera, registreraJobblista }), [registrera, registreraJobblista]);

  return <RealtidsContext.Provider value={värde}>{children}</RealtidsContext.Provider>;
}

// Registrerar en callback som körs vid varje realtidssignal för inloggad användare.
export function useRealtidsPing(handler) {
  const { registrera } = useContext(RealtidsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => registrera((payload) => handlerRef.current?.(payload)), [registrera]);
}

// Registrerar en callback som körs vid varje signal på den delade jobblista-kanalen
// (jobb publiceras, ändras, tas bort eller blir tillsatt/ledigt). Används av den publika
// jobblistan för att hålla sig synkad i realtid.
export function useJobblistaPing(handler) {
  const { registreraJobblista } = useContext(RealtidsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => registreraJobblista((payload) => handlerRef.current?.(payload)), [registreraJobblista]);
}
