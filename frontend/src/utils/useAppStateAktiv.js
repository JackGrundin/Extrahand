import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Kör callbacken när appen kommer tillbaka i förgrunden.
//
// Behövs för flöden som lämnar appen helt: Stripe Checkout och kundportalen öppnas i den
// externa webbläsaren, och då tappar skärmen aldrig navigationsfokus – appen läggs bara i
// bakgrunden. useFocusEffect triggar därför INTE vid återkomst, och skärmen skulle visa
// gammal data (t.ex. det gamla priset trots att företaget just betalat för Pro).
//
// Håller handlern i en ref, precis som useRealtidsPing, så att en ny callback vid varje
// render inte river och sätter upp lyssnaren på nytt.
export function useAppStateAktiv(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const lyssnare = AppState.addEventListener('change', (status) => {
      if (status === 'active') handlerRef.current?.();
    });
    return () => lyssnare.remove();
  }, []);
}
