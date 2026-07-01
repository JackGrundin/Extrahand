import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './AuthContext';

// Realtid via Supabase Broadcast. Varje användare prenumererar ENBART på sin egen privata
// kanal (`anvandare:<id>`) och tar emot lättviktiga signaler utan känsligt innehåll –
// backend skickar bara en typ-etikett. Signalen används som trigger; själva datan hämtas
// via det JWT-skyddade API:t. Ingen tabellpublikation eller RLS-öppning krävs, och inget
// meddelandeinnehåll exponeras via anon-nyckeln.
const RealtidsContext = createContext({ registrera: () => () => {} });

export function RealtidsProvider({ children }) {
  const { användare } = useAuth();
  // En och samma socket-kanal fördelar signalen till alla registrerade lyssnare
  // (t.ex. både chattbadgen i navigationen och den öppna chattskärmen).
  const lyssnare = useRef(new Set());

  const registrera = useCallback((callback) => {
    lyssnare.current.add(callback);
    return () => lyssnare.current.delete(callback);
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

  return (
    <RealtidsContext.Provider value={{ registrera }}>
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
