'use client';

// Meddelande-inkorg: alla konversationer företaget har med sökande. Bygger på
// företagsKonversationer() (GET /ansokningar/foretag). Materialiserade schemapass
// (schemaPassId != null) filtreras bort – de är inget folk sökt själva. Realtidsping
// hämtar om listan så nya meddelanden/ansökningar dyker upp utan omladdning.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Besked from '@/components/ui/Besked';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api } from '@/lib/api';
import { STATUSFÄRGER_ANSÖKAN } from '@/utils/konstanter';

function tidKort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const idag = new Date();
  const sammaDag = d.toDateString() === idag.toDateString();
  return sammaDag
    ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export default function MeddelandeInkorg() {
  const [konversationer, setKonversationer] = useState([]);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const data = await api.företagsKonversationer();
      setKonversationer(Array.isArray(data) ? data : []);
    } catch (f) {
      setFel(f?.message || 'Kunde inte hämta meddelanden');
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  useRealtidsPing(() => hämta());

  const lista = useMemo(() => {
    return (konversationer ?? [])
      .filter((k) => !k.schemaPassId)
      .sort((a, b) => {
        const ta = a.senasteMeddelande?.created_at || a.created_at || '';
        const tb = b.senasteMeddelande?.created_at || b.created_at || '';
        return tb.localeCompare(ta);
      });
  }, [konversationer]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="rubrik-l text-text">Meddelanden</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">Dina konversationer med sökande.</p>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {laddar ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga konversationer än. Så fort någon söker ett pass kan ni chatta här.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {lista.map((k) => {
            const färg = STATUSFÄRGER_ANSÖKAN[k.status] ?? STATUSFÄRGER_ANSÖKAN.väntande;
            const initial = (k.sökandeNamn || '?').charAt(0).toUpperCase();
            return (
              <li key={k.id}>
                <Link
                  href={`/meddelanden/${k.id}`}
                  className="flex items-center gap-3 rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[15px] font-bold text-white">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-bold text-text">{k.sökandeNamn || 'Sökande'}</p>
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
                    className="ml-1 hidden shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-bold capitalize sm:inline"
                    style={{ backgroundColor: färg.bg, color: färg.text }}
                  >
                    {k.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
