'use client';

// Kort för ett schema i Mina annonser. Sökande-badgen ligger HÖGST UPP (före titeln) som i
// appen: antalAnsökningar räknar väntande ("så här många kan jag välja bland") och nya
// markeras separat. Visar period, timlön, roller och statuschip (tillsatt / söker person).
// ⋯-menyn (Redigera + Ta bort) speglar passkortets meny och döljs när schemat är tillsatt –
// ett tillsatt schema kan ha genomförda pass och ska avbrytas i detaljvyn i stället.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, felText } from '@/lib/api';
import RollBrickor from '@/components/app/RollBrickor';
import { formatPeriod } from '@/utils/datumHelper';

export default function SchemaKort({ schema, onÄndrad }) {
  const router = useRouter();
  const [meny, setMeny] = useState(false);
  const [tarBort, setTarBort] = useState(false);

  const period = formatPeriod(
    (schema.pass ?? []).map((p) => p.datum).filter(Boolean)
  ) || formatPeriod([schema.startdatum, schema.slutdatum].filter(Boolean));

  const tillsatt = Boolean(schema.personNamn || schema.anvandare_id);

  // Kortet är en Link – menyknappen måste stoppa navigeringen och routa själv.
  function redigera(e) {
    e.preventDefault();
    e.stopPropagation();
    setMeny(false);
    router.push(`/redigera/schema/${schema.id}`);
  }

  async function taBort(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Är du säker? Schemat och alla pass raderas permanent.')) return;
    setTarBort(true);
    try {
      await api.taBortSchema(schema.id);
      onÄndrad?.();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setTarBort(false);
      setMeny(false);
    }
  }

  return (
    <Link
      href={`/annonser/schema/${schema.id}`}
      className="relative block rounded-lg border border-kant bg-yta p-5 shadow-mjuk transition-shadow hover:shadow-lyft"
    >
      {schema.antalAnsökningar > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-pill bg-primär-mjuk px-2.5 py-1 text-[12px] font-bold text-primär">
            {schema.antalAnsökningar} sökande
          </span>
          {schema.nyaAnsökningar > 0 && (
            <span className="rounded-pill bg-primär px-2.5 py-1 text-[12px] font-bold text-white">
              {schema.nyaAnsökningar} {schema.nyaAnsökningar === 1 ? 'ny' : 'nya'}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold text-text">{schema.titel}</h3>
            {schema.privat && (
              <span className="rounded-pill border border-varning-kant bg-varning-mjuk px-2 py-0.5 text-[11px] font-bold text-varning-text">
                Privat
              </span>
            )}
          </div>
          {period && <p className="mt-0.5 text-[14px] text-text-dämpad">{period}</p>}
        </div>
        {/* ⋯-menyn visas bara innan någon godkänts – då finns inga genomförda pass att
            skydda och Redigera/Radera är båda tillåtna. */}
        {!tillsatt && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMeny((v) => !v);
              }}
              aria-label="Fler val"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-text-dämpad hover:bg-yta-dämpad"
            >
              ⋯
            </button>
            {meny && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-sm border border-kant bg-yta shadow-lyft">
                <button
                  type="button"
                  onClick={redigera}
                  className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-text hover:bg-yta-dämpad"
                >
                  Redigera
                </button>
                <button
                  type="button"
                  disabled={tarBort}
                  onClick={taBort}
                  className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-fel hover:bg-fel-mjuk disabled:opacity-60"
                >
                  {tarBort ? 'Tar bort…' : 'Ta bort'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        <RollBrickor kategorier={schema.kategorier} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-bold text-primär">{Math.round(Number(schema.timlon))} kr/tim</span>
        <span className="text-[13px] text-text-dämpad">{schema.antalPass} pass</span>
        <span
          className={`ml-auto rounded-pill px-2.5 py-1 text-[12px] font-bold ${
            tillsatt ? 'bg-framgång-mjuk text-framgång' : 'bg-varning-mjuk text-varning-text'
          }`}
        >
          {tillsatt ? schema.personNamn || 'Tillsatt' : 'Söker person'}
        </span>
      </div>
    </Link>
  );
}
