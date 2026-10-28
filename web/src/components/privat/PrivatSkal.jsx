'use client';

// Webbapp-skal för privatpersoner: fast vänstersidomeny på desktop, hopfällbar drawer på mobil
// – precis som företagets AppSkal. Används av alla privatsidor. Eftersom /jobb och /jobb/[id]
// är PUBLIKA faller skalet tillbaka på landnings-Toppnav när besökaren INTE är en inloggad
// privatperson, så utloggade/företag ser den vanliga marknadsföringsnaven.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Toppnav from '@/components/Toppnav';
import PrivatSidomeny from '@/components/privat/PrivatSidomeny';
import { useAuth } from '@/context/AuthContext';

export default function PrivatSkal({ children }) {
  const { inloggad, användare } = useAuth();
  const [menyÖppen, setMenyÖppen] = useState(false);
  const sökväg = usePathname();

  // Stäng mobildrawern vid sidbyte.
  useEffect(() => {
    setMenyÖppen(false);
  }, [sökväg]);

  const ärPrivat = inloggad && användare?.typ === 'privatperson';

  // Publikt läge (utloggad eller företag på /jobb): behåll landningsnaven.
  if (!ärPrivat) {
    return (
      <>
        <Toppnav />
        <main className="min-h-[calc(100vh-61px)] bg-bakgrund">
          <div className="px-4 py-8 sm:px-5 sm:py-12">{children}</div>
        </main>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-bakgrund">
      {/* Fast sidomeny – desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-kant bg-yta md:block">
        <PrivatSidomeny />
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
            <PrivatSidomeny onNavigera={() => setMenyÖppen(false)} />
          </div>
        </div>
      )}

      {/* Innehåll */}
      <main className="md:pl-64">
        <div className="px-4 py-8 sm:px-5 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
