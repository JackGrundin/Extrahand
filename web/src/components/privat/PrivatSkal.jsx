'use client';

// Webbapp-skal för privatpersoner: fast vänstersidomeny på desktop, hopfällbar drawer på mobil
// – precis som företagets AppSkal. Används av alla privatsidor. Eftersom /jobb och /jobb/[id]
// är PUBLIKA faller skalet tillbaka på landnings-Toppnav när besökaren INTE är en inloggad
// privatperson, så utloggade/företag ser den vanliga marknadsföringsnaven.
//
// Live-badgar + toasts drivs av realtidssignaler (Supabase Broadcast). RealtidsProvider
// monteras i root-layouten och täcker hela produkten, så skalet behöver bara konsumera
// useRealtidsPing – alla privatsidor (inte bara /chatt) får därmed signalerna.
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Toppnav from '@/components/Toppnav';
import PrivatSidomeny from '@/components/privat/PrivatSidomeny';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { useToaster } from '@/components/ui/Toast';
import { api } from '@/lib/api';

// Backend saknar läs-status för chatt, så "oläst" härleds klient-sidigt: en konversation är
// oläst om dess senaste meddelande kom från motparten efter att inboxen senast öppnades.
// Tidpunkten lagras i localStorage; seedas till nu vid första besöket (ingen retroaktiv flagga).
const SEDD_NYCKEL = 'fastgig.chatt.sedd';

// Snapshot av ansökningarnas status (per ansökans-id) vid senaste besöket på Mina ansökningar.
// En prick tänds när en status ändrats sedan dess (t.ex. väntande → godkänd/avvisad). Seedas
// vid första besöket så att redan kända statusar inte ger retroaktiva prickar.
const ANSÖKAN_NYCKEL = 'fastgig.ansokningar.sedda';

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

function läsAnsökanSnapshot() {
  if (typeof window === 'undefined') return null;
  const rått = window.localStorage.getItem(ANSÖKAN_NYCKEL);
  if (rått == null) return null; // null = aldrig sett → seedas av anroparen
  try { return JSON.parse(rått) || {}; } catch { return {}; }
}

function sättAnsökanSnapshot(karta) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ANSÖKAN_NYCKEL, JSON.stringify(karta)); } catch {}
}

export default function PrivatSkal({ children }) {
  const { inloggad, användare } = useAuth();
  const [menyÖppen, setMenyÖppen] = useState(false);
  const [olästa, setOlästa] = useState(0);
  const [ansökanStatus, setAnsökanStatus] = useState(0);
  const sökväg = usePathname();
  const { visa, toaster } = useToaster();

  const ärPrivat = inloggad && användare?.typ === 'privatperson';
  const minId = String(användare?.id ?? '');

  // Stäng mobildrawern vid sidbyte.
  useEffect(() => {
    setMenyÖppen(false);
  }, [sökväg]);

  // Räkna olästa konversationer OCH ansökningar med ändrad status. Delad hämtning: båda
  // härleds ur samma /ansokningar/mina. Fel sväljs – en trasig badge får aldrig sänka vyn.
  const laddaBadges = useCallback(
    async ({ nollställOlästa = false, nollställStatus = false } = {}) => {
      if (nollställOlästa) sättSedd(Date.now());
      try {
        const data = await api.minaAnsökningar();
        const lista = Array.isArray(data) ? data : [];

        // Olästa meddelanden (samma filter som /chatt-inboxen).
        const sedd = läsSedd();
        const olästaAntal = lista.filter((a) => {
          if (a.schemaPassId != null) return false;
          const sm = a.senasteMeddelande;
          if (!sm?.created_at) return false;
          if (String(sm.avsandare_id) === minId) return false; // mitt eget sista meddelande
          return new Date(sm.created_at).getTime() > sedd;
        }).length;
        setOlästa(olästaAntal);

        // Statusändringar sedan senaste besök på Mina ansökningar.
        const nuKarta = {};
        for (const a of lista) {
          if (a.schemaPassId != null) continue; // samma filter som Mina ansökningar-vyn
          if (a?.id != null) nuKarta[String(a.id)] = a.status;
        }
        const tidigare = läsAnsökanSnapshot();
        if (tidigare == null || nollställStatus) {
          // Första besöket eller användaren tittar nu → seeda utan att tända prickar.
          sättAnsökanSnapshot(nuKarta);
          setAnsökanStatus(0);
        } else {
          const ändrade = Object.keys(nuKarta).filter(
            (id) => tidigare[id] !== undefined && tidigare[id] !== nuKarta[id],
          ).length;
          setAnsökanStatus(ändrade);
        }
      } catch {
        /* en trasig badge får aldrig sänka vyn */
      }
    },
    [minId],
  );

  // Ladda vid montering och vid sidbyte. Öppnar man inboxen nollas oläst-stämpeln; öppnar man
  // Mina ansökningar uppdateras status-snapshotten (pricken släcks). Hoppas över i publikt läge.
  useEffect(() => {
    if (!ärPrivat) return;
    laddaBadges({
      nollställOlästa: sökväg?.startsWith('/chatt'),
      nollställStatus: sökväg?.startsWith('/mina-ansokningar'),
    });
  }, [ärPrivat, laddaBadges, sökväg]);

  // Realtid: nytt meddelande → oläst-badge + toast; statusändring på ansökan → status-badge +
  // toast; inkommen jobbförfrågan → toast till inboxen.
  useRealtidsPing((p) => {
    if (!ärPrivat) return;
    if (p?.typ === 'meddelande') {
      laddaBadges();
      visa({ titel: 'Nytt meddelande', text: 'Du har fått ett nytt meddelande.', href: '/chatt' });
    }
    if (p?.typ === 'pass-status') {
      laddaBadges();
      visa({
        titel: 'Din ansökan har besvarats',
        text: 'Statusen på en av dina ansökningar har ändrats.',
        href: '/mina-ansokningar',
        typ: 'framgång',
      });
    }
    if (p?.typ === 'jobbforfragan') {
      visa({ titel: 'Ny jobbförfrågan', text: 'Ett företag har skickat en förfrågan.', href: '/chatt' });
    }
  });

  // Publikt läge (utloggad eller företag på /jobb): behåll landningsnaven, ingen sidomeny/realtid.
  // Ligger efter alla hooks så att hook-ordningen är konstant (regler för hooks).
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
        <PrivatSidomeny olästa={olästa} ansökanStatus={ansökanStatus} />
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
            <PrivatSidomeny
              onNavigera={() => setMenyÖppen(false)}
              olästa={olästa}
              ansökanStatus={ansökanStatus}
            />
          </div>
        </div>
      )}

      {/* Innehåll */}
      <main className="md:pl-64">
        <div className="px-4 py-8 sm:px-5 sm:py-10">{children}</div>
      </main>

      {/* Realtids-toasts */}
      {toaster}
    </div>
  );
}
