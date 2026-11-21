'use client';

// Inkorgen (åtgärdslista) på webben – delad av både företag och privatperson. Innehållet
// är en HÄRLEDD lista från GET /api/inkorg; poster försvinner automatiskt när åtgärden är
// utförd. Rutten (/inkorg) väljer skal efter användartyp och renderar denna komponent.
// Varje rad länkar till rätt vy; målrutten skiljer sig per användartyp (se länkFör).
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';

// Inline-SVG-ikoner (Lucide-stil, currentColor) – projektet drar egna SVG:er i stället för
// ett ikonbibliotek. Färgen sätts via text-* på föräldern.
function Ikon({ typ }) {
  const gemensamt = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  switch (typ) {
    case 'tidrapport':
      return (
        <svg {...gemensamt}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'ansokningar':
      return (
        <svg {...gemensamt}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'betyg':
      return (
        <svg {...gemensamt}>
          <path d="M12 2l3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.9 3.5 1.6-6.8L1.4 9.1l7-.6z" />
        </svg>
      );
    case 'avtal':
      return (
        <svg {...gemensamt}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case 'bestridande':
      return (
        <svg {...gemensamt}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    default:
      return (
        <svg {...gemensamt}>
          <path d="M4 4h16v16H4z" />
        </svg>
      );
  }
}

// Bygger målrutten för en post. Rutterna skiljer sig per användartyp: företag chattar på
// /meddelanden, privatpersoner på /chatt.
function länkFör(post, ärFöretag) {
  switch (post.typ) {
    case 'tidrapport':
    case 'bestridande':
    case 'betyg':
      if (!post.ansokanId) return null;
      return ärFöretag ? `/meddelanden/${post.ansokanId}` : `/chatt/${post.ansokanId}`;
    case 'ansokningar':
      if (post.schemaId) return `/annonser/schema/${post.schemaId}`;
      return post.jobbId ? `/annonser/jobb/${post.jobbId}/ansokningar` : null;
    case 'avtal':
      return '/min-profil';
    default:
      return null;
  }
}

export default function InkorgsSida() {
  const { användare } = useAuth();
  const [poster, setPoster] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const router = useRouter();
  const ärFöretag = användare?.typ === 'företag';

  const hämta = useCallback(async () => {
    try {
      const svar = await api.hämtaInkorg();
      setPoster(Array.isArray(svar?.poster) ? svar.poster : []);
      setFel('');
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  // Realtid: räkna om listan direkt när något skapats/lösts (ansökan, tidrapport, betyg, avtal).
  useRealtidsPing(() => {
    hämta();
  });

  function öppna(post) {
    const väg = länkFör(post, ärFöretag);
    if (väg) router.push(väg);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="rubrik-l text-text">Inkorg</h1>

      {fel && <div className="mt-4"><Besked typ="fel">{fel}</Besked></div>}

      {laddar ? (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : poster.length === 0 ? (
        <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
          <p className="text-[15px] font-semibold text-text">Inget att göra just nu 🎉</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {poster.map((post, i) => (
            <button
              key={`${post.typ}-${post.ansokanId ?? post.jobbId ?? post.schemaId ?? i}`}
              type="button"
              onClick={() => öppna(post)}
              className="flex w-full items-center gap-3 rounded-lg border border-kant bg-yta p-4 text-left shadow-mjuk transition-colors hover:bg-yta-dämpad"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primär-mjuk text-primär">
                <Ikon typ={post.typ} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-text">{post.titel}</span>
                <span className="block truncate text-[13px] text-text-svag">{post.undertext}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-svag" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
