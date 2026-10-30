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
import { api } from '@/lib/api';

// Backend saknar läs-status för chatt, så "oläst" härleds klient-sidigt: en konversation är
// oläst om dess senaste meddelande kom från motparten efter att inboxen senast öppnades.
// Tidpunkten lagras i localStorage; seedas till nu vid första besöket (ingen retroaktiv flagga).
const SEDD_NYCKEL = 'fastgig.chatt.sedd';

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

export default function PrivatSkal({ children }) {
  const { inloggad, användare } = useAuth();
  const [menyÖppen, setMenyÖppen] = useState(false);
  const [olästa, setOlästa] = useState(0);
  const sökväg = usePathname();

  // Stäng mobildrawern vid sidbyte.
  useEffect(() => {
    setMenyÖppen(false);
  }, [sökväg]);

  const ärPrivat = inloggad && användare?.typ === 'privatperson';
  const minId = String(användare?.id ?? '');

  // Räkna olästa konversationer för badgen. Nollställs när inboxen (/chatt) öppnas.
  // Körs vid sidbyte (som företagets AppSkal gör med sina badges). Fel sväljs.
  useEffect(() => {
    if (!ärPrivat) return;
    if (sökväg?.startsWith('/chatt')) sättSedd(Date.now());
    let avbruten = false;
    (async () => {
      try {
        const data = await api.minaAnsökningar();
        if (avbruten) return;
        const sedd = läsSedd();
        const antal = (Array.isArray(data) ? data : []).filter((a) => {
          if (a.schemaPassId != null) return false; // samma filter som /chatt-inboxen
          const sm = a.senasteMeddelande;
          if (!sm?.created_at) return false;
          if (String(sm.avsandare_id) === minId) return false; // mitt eget sista meddelande
          return new Date(sm.created_at).getTime() > sedd;
        }).length;
        setOlästa(antal);
      } catch {
        /* en trasig badge får aldrig sänka vyn */
      }
    })();
    return () => { avbruten = true; };
  }, [ärPrivat, sökväg, minId]);

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
        <PrivatSidomeny olästa={olästa} />
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
            <PrivatSidomeny onNavigera={() => setMenyÖppen(false)} olästa={olästa} />
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
