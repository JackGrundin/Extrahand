'use client';

// Dashboard-skal för företagsvyerna: fast sidomeny på desktop, hopfällbar drawer på mobil.
// Hämtar en lätt sammanställning (nya ansökningar) för sidomenyns badge. Sidorna hämtar
// sin egen data – den här hämtningen är bara till för badgen och blockerar aldrig vyn.
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidomeny from '@/components/app/Sidomeny';
import { api } from '@/lib/api';

export default function AppSkal({ children }) {
  const [menyÖppen, setMenyÖppen] = useState(false);
  const [badges, setBadges] = useState({ annonser: 0 });
  const sökväg = usePathname();

  // Nya ansökningar på både jobb och scheman. Fel sväljs: en trasig badge får aldrig
  // sänka hela vyn.
  const laddaBadges = useCallback(async () => {
    try {
      const [jobb, scheman] = await Promise.all([api.minaJobb(), api.minaScheman()]);
      const summa = (arr) =>
        (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.nyaAnsökningar) || 0), 0);
      setBadges({ annonser: summa(jobb) + summa(scheman) });
    } catch {
      /* ignoreras med flit */
    }
  }, []);

  // Ladda vid montering och varje gång man byter sida (så badgen nollas efter att man
  // tittat på ansökningarna).
  useEffect(() => {
    laddaBadges();
  }, [laddaBadges, sökväg]);

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
    </div>
  );
}
