import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './AuthContext';

// Realtid via Supabase Broadcast. Varje användare prenumererar ENBART på sin egen privata
// kanal (`anvandare:<id>`) och tar emot lättviktiga signaler utan känsligt innehåll –
// backend skickar bara en typ-etikett. Signalen används som trigger; själva datan hämtas
// via det JWT-skyddade API:t. Ingen tabellpublikation eller RLS-öppning krävs, och inget
// meddelandeinnehåll exponeras via anon-nyckeln.
const RealtidsContext = createContext({ registrera: () => () => {}, registreraJobblista: () => () => {} });

export function RealtidsProvider({ children }) {
  const { användare } = useAuth();
  // En och samma socket-kanal fördelar signalen till alla registrerade lyssnare
  // (t.ex. både chattbadgen i navigationen och den öppna chattskärmen).
  const lyssnare = useRef(new Set());
  // Separat lyssnaruppsättning för den delade jobblista-kanalen. Hålls isär så att en
  // jobbhändelse bara triggar jobblistans hämtning – inte t.ex. omräkning av olästa.
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
          try { callback(meddelande?.payload); } catch {}
        }
      });
    kanal.subscribe();

    return () => { supabase.removeChannel(kanal); };
  }, [användare?.id]);

  // Delad kanal för den publika jobblistan. Bara privatpersoner har jobblistan, så bara de
  // prenumererar. Signalen innehåller enbart en typ-etikett; färsk data hämtas via API:t.
  useEffect(() => {
    if (!supabase || användare?.typ !== 'privatperson') return undefined;

    const kanal = supabase
      .channel('jobblista')
      .on('broadcast', { event: 'ny' }, (meddelande) => {
        for (const callback of jobblistaLyssnare.current) {
          try { callback(meddelande?.payload); } catch {}
        }
      });
    kanal.subscribe();

    return () => { supabase.removeChannel(kanal); };
  }, [användare?.typ]);

  return (
    <RealtidsContext.Provider value={{ registrera, registreraJobblista }}>
      {children}
    </RealtidsContext.Provider>
  );
}

// Registrerar en callback som körs vid varje realtidssignal för inloggad användare.
export function useRealtidsPing(handler) {
  const { registrera } = useContext(RealtidsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => registrera((payload) => handlerRef.current?.(payload)), [registrera]);
}

// Registrerar en callback som körs vid varje signal på den delade jobblista-kanalen
// (jobb publiceras, ändras, tas bort eller blir tillsatt/ledigt). Endast privatpersoner.
export function useJobblistaPing(handler) {
  const { registreraJobblista } = useContext(RealtidsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => registreraJobblista((payload) => handlerRef.current?.(payload)), [registreraJobblista]);
}
