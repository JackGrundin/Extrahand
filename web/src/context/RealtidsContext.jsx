'use client';

// Realtid via Supabase Broadcast – speglar frontend/src/context/RealtidsContext.js.
// Företaget prenumererar ENBART på sin egen privata kanal (`anvandare:<id>`) och tar emot
// lättviktiga signaler utan känsligt innehåll (backend skickar bara en typ-etikett).
// Signalen används som trigger; själva datan hämtas via det JWT-skyddade API:t. Ingen
// tabellpublikation eller RLS-öppning krävs. (Jobblista-kanalen behövs bara för
// privatpersoner och utelämnas här.)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const RealtidsContext = createContext({ registrera: () => () => {} });

export function RealtidsProvider({ children }) {
  const { användare } = useAuth();
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

  const värde = useMemo(() => ({ registrera }), [registrera]);

  return <RealtidsContext.Provider value={värde}>{children}</RealtidsContext.Provider>;
}

// Registrerar en callback som körs vid varje realtidssignal för inloggad användare.
export function useRealtidsPing(handler) {
  const { registrera } = useContext(RealtidsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => registrera((payload) => handlerRef.current?.(payload)), [registrera]);
}
