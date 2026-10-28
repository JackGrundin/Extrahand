'use client';

// Privatpersonens chatt-inkorg: en konversation per ansökan (samma modell som webbens
// företags-chatt). Bygger på api.minaAnsökningar() – auto-skapade pass-ansökningar
// (schemaPassId) filtreras bort. Ligger UTANFÖR (app)-gruppen med egen auth-gate; realtid
// kommer från RealtidsProvider i chatt/layout.jsx.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';
import { ansökanStatusVisning } from '@/utils/konstanter';

// Samma dag → klockslag, annars datum. Speglar företagsinkorgens tidKort.
function tidKort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const idag = new Date();
  const sammaDag = d.toDateString() === idag.toDateString();
  return sammaDag
    ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export default function ChattInkorg() {
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');

  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent('/chatt')}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/oversikt');
    }
  }, [authLaddar, inloggad, användare, router]);

  const hämta = useCallback(async () => {
    try {
      const data = await api.minaAnsökningar();
      setAnsökningar(Array.isArray(data) ? data : []);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    if (!authLaddar && inloggad && användare?.typ !== 'företag') hämta();
  }, [authLaddar, inloggad, användare, hämta]);

  useRealtidsPing(() => hämta());

  const lista = useMemo(
    () =>
      (ansökningar ?? [])
        .filter((a) => a.schemaPassId == null)
        .sort((a, b) => {
          const ta = a.senasteMeddelande?.created_at || a.created_at || '';
          const tb = b.senasteMeddelande?.created_at || b.created_at || '';
          return tb.localeCompare(ta);
        }),
    [ansökningar]
  );

  if (authLaddar || !inloggad || användare?.typ === 'företag' || laddar) {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-2xl">
          <h1 className="rubrik-l text-text">Meddelanden</h1>
          <p className="mt-1 text-[15px] text-text-dämpad">Dina konversationer med företag.</p>

          {fel && <Besked typ="fel">{fel}</Besked>}

          {lista.length === 0 ? (
            <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
              <p className="text-[15px] font-semibold text-text">Inga konversationer än</p>
              <p className="mt-1 text-[14px] text-text-dämpad">
                Sök ett pass så kan ni chatta här.
              </p>
              <Link
                href="/jobb"
                className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline"
              >
                Hitta jobb
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-2">
              {lista.map((k) => {
                const status = ansökanStatusVisning(k) ?? {
                  etikett: k.status,
                  bg: '#f3f4f6',
                  text: '#6b7280',
                };
                const initial = (k.foretagNamn || '?').charAt(0).toUpperCase();
                return (
                  <li key={k.id}>
                    <Link
                      href={`/chatt/${k.id}`}
                      className="flex items-center gap-3 rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[15px] font-bold text-white">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[15px] font-bold text-text">
                            {k.foretagNamn || 'Företag'}
                          </p>
                          <span className="shrink-0 text-[12px] text-text-svag">
                            {tidKort(k.senasteMeddelande?.created_at)}
                          </span>
                        </div>
                        <p className="truncate text-[13px] text-text-dämpad">{k.jobbTitel}</p>
                        <p className="truncate text-[13px] text-text-svag">
                          {k.senasteMeddelande?.innehall || 'Ingen konversation än'}
                        </p>
                      </div>
                      <span
                        className="ml-1 hidden shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-bold sm:inline"
                        style={{ backgroundColor: status.bg, color: status.text }}
                      >
                        {status.etikett}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </PrivatSkal>
  );
}
