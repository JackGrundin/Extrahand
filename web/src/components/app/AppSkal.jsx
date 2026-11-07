'use client';

// Dashboard-skal för företagsvyerna: fast sidomeny på desktop, hopfällbar drawer på mobil.
// Hämtar en lätt sammanställning (nya ansökningar) för sidomenyns badge. Sidorna hämtar
// sin egen data – den här hämtningen är bara till för badgen och blockerar aldrig vyn.
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidomeny from '@/components/app/Sidomeny';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { useToaster } from '@/components/ui/Toast';
import { api } from '@/lib/api';

// Backend saknar läs-status för chatt, så "oläst" härleds klient-sidigt (precis som i
// PrivatSkal): en konversation är oläst om dess senaste meddelande kom från motparten efter
// att inboxen senast öppnades. Tidpunkten lagras i localStorage och seedas till nu vid första
// besöket (ingen retroaktiv badge).
const SEDD_NYCKEL = 'fastgig.foretag.chatt.sedd';

function läsSedd() {
  if (typeof window === 'undefined') return Date.now();
  const rått = window.localStorage.getItem(SEDD_NYCKEL);
  if (rått == null) {
    const nu = Date.now();
    try { window.localStorage.setItem(SEDD_NYCKEL, String(nu)); } catch {}
    return nu;
  }
  return Number(rått) || 0;
}

function sättSedd(ts) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(SEDD_NYCKEL, String(ts)); } catch {}
}

export default function AppSkal({ children }) {
  const { användare } = useAuth();
  const [menyÖppen, setMenyÖppen] = useState(false);
  const [badges, setBadges] = useState({ annonser: 0, meddelanden: 0 });
  const sökväg = usePathname();
  const { visa, toaster } = useToaster();
  const minId = String(användare?.id ?? '');

  // Nya ansökningar på både jobb och scheman. Fel sväljs: en trasig badge får aldrig
  // sänka hela vyn.
  const laddaBadges = useCallback(async () => {
    try {
      const [jobb, scheman] = await Promise.all([api.minaJobb(), api.minaScheman()]);
      const summa = (arr) =>
        (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.nyaAnsökningar) || 0), 0);
      setBadges((prev) => ({ ...prev, annonser: summa(jobb) + summa(scheman) }));
    } catch {
      /* ignoreras med flit */
    }
  }, []);

  // Olästa konversationer för Meddelanden-badgen. Samma härledning som privatpersonens inbox.
  const laddaOlästa = useCallback(async () => {
    try {
      const data = await api.företagsKonversationer();
      const sedd = läsSedd();
      const antal = (Array.isArray(data) ? data : []).filter((k) => {
        const sm = k.senasteMeddelande;
        if (!sm?.created_at) return false;
        if (String(sm.avsandare_id) === minId) return false; // mitt eget sista meddelande
        return new Date(sm.created_at).getTime() > sedd;
      }).length;
      setBadges((prev) => ({ ...prev, meddelanden: antal }));
    } catch {
      /* ignoreras med flit */
    }
  }, [minId]);

  // Ladda vid montering och varje gång man byter sida (så badgen nollas efter att man
  // tittat på ansökningar/meddelanden). Nollställ oläst-stämpeln när inboxen öppnas.
  useEffect(() => {
    if (sökväg?.startsWith('/meddelanden')) sättSedd(Date.now());
    laddaBadges();
    laddaOlästa();
  }, [laddaBadges, laddaOlästa, sökväg]);

  // Realtid: en ny ansökan uppdaterar annons-badgen, ett nytt meddelande uppdaterar
  // oläst-badgen och visar en toast.
  useRealtidsPing((p) => {
    if (p?.typ === 'ansokan') laddaBadges();
    if (p?.typ === 'meddelande') {
      laddaOlästa();
      visa({ titel: 'Nytt meddelande', text: 'Du har fått ett nytt meddelande.', href: '/meddelanden' });
    }
  });

  // Stäng mobildrawern vid sidbyte.
  useEffect(() => {
    setMenyÖppen(false);
  }, [sökväg]);

  return (
    <div className="min-h-screen bg-bakgrund">
      {/* Fast sidomeny – desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-kant bg-yta md:block">
        <Sidomeny badges={badges} />
      </aside>

      {/* Mobil topprad */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-kant bg-yta/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-bold text-text">FastGig</span>
        <button
          type="button"
          onClick={() => setMenyÖppen(true)}
          aria-label="Öppna meny"
          className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-sm border border-kant"
        >
          <span className="h-[2px] w-4 bg-text" />
          <span className="h-[2px] w-4 bg-text" />
          <span className="h-[2px] w-4 bg-text" />
        </button>
      </header>

      {/* Mobil drawer */}
      {menyÖppen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMenyÖppen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-yta shadow-lyft">
            <Sidomeny badges={badges} onNavigera={() => setMenyÖppen(false)} />
          </div>
        </div>
      )}

      {/* Innehåll */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</div>
      </main>

      {/* Realtids-toasts */}
      {toaster}
    </div>
  );
}
