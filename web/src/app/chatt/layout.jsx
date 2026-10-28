'use client';

// Realtidsskal för privatpersonens chatt. RealtidsProvider monteras annars bara i (app)-gruppen
// (företag), så /chatt-rutterna – som ligger utanför (app) – wrappas här för att få Supabase
// Broadcast-signalerna (kanal anvandare:<id>, event 'ny'). Providern guardar på inloggad
// användare, så den är ofarlig innan auth hunnit resolva.
import { RealtidsProvider } from '@/context/RealtidsContext';

export default function ChattLayout({ children }) {
  return <RealtidsProvider>{children}</RealtidsProvider>;
}
