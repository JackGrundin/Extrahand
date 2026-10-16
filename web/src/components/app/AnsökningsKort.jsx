'use client';

// Kort för en ansökan: sökandens namn, datum, meddelande, favorit-stjärna och statusknappar.
// Godkännande avvisar automatiskt övriga (backend). "Ta tillbaka godkännandet" döljs när
// passet startat. saknadeKrav visas som en härledd "Kräver ny bekräftelse"-bricka – den
// försvinner av sig själv när personen bekräftat (inget lagrat statusvärde).
import { useState } from 'react';
import Link from 'next/link';
import Knapp from '@/components/ui/Knapp';
import { ansökanStatusVisning } from '@/utils/konstanter';

export default function AnsökningsKort({ ansökan, jobbStartat, onStatus, onFavorit }) {
  const [arbetar, setArbetar] = useState(false);
  const status = ansökan.status;
  const statusVisning = ansökanStatusVisning(ansökan, { ärFöretag: true });

  async function sätt(nyStatus) {
    setArbetar(true);
    try {
      await onStatus(ansökan.id, nyStatus);
    } finally {
      setArbetar(false);
    }
  }

  const initial = (ansökan.sökandeNamn || '?').charAt(0).toUpperCase();

  return (
    <div className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[15px] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[16px] font-bold text-text">{ansökan.sökandeNamn || 'Sökande'}</p>
            <button
              type="button"
              onClick={() => onFavorit(ansökan.id, !ansökan.favorit)}
              aria-label={ansökan.favorit ? 'Ta bort favorit' : 'Markera som favorit'}
              className={`shrink-0 text-[20px] leading-none ${ansökan.favorit ? 'text-stjärna' : 'text-text-svag hover:text-stjärna'}`}
            >
              {ansökan.favorit ? '★' : '☆'}
            </button>
          </div>
          {ansökan.created_at && (
            <p className="text-[13px] text-text-svag">
              {new Date(ansökan.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {Array.isArray(ansökan.saknadeKrav) && ansökan.saknadeKrav.length > 0 && (
        <p className="mt-3 inline-block rounded-pill bg-varning-mjuk px-2.5 py-1 text-[12px] font-bold text-varning-text">
          Kräver ny bekräftelse
        </p>
      )}

      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text-dämpad">
        {ansökan.meddelande?.trim() || 'Ingen ansökningstext'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status === 'väntande' && (
          <Knapp variant="primär" storlek="liten" laddar={arbetar} onClick={() => sätt('godkänd')}>
            Godkänn
          </Knapp>
        )}
        {status === 'godkänd' && (
          <>
            <span className="rounded-pill bg-framgång-mjuk px-3 py-1 text-[13px] font-bold text-framgång">Godkänd</span>
            {!jobbStartat && (
              <button type="button" disabled={arbetar} onClick={() => sätt('väntande')} className="text-[13px] font-semibold text-text-dämpad hover:text-fel disabled:opacity-60">
                Ta tillbaka godkännandet
              </button>
            )}
          </>
        )}
        {status === 'avvisad' && statusVisning && (
          <span className="rounded-pill px-3 py-1 text-[13px] font-bold" style={{ backgroundColor: statusVisning.bg, color: statusVisning.text }}>
            {statusVisning.etikett}
          </span>
        )}

        {/* Chatt finns så fort någon sökt – företaget kan prata innan beslut. */}
        <Link href={`/meddelanden/${ansökan.id}`} className="ml-auto text-[14px] font-semibold text-primär hover:underline">
          Öppna chatt →
        </Link>
      </div>
    </div>
  );
}
