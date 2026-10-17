'use client';

// Kort för ett schema i Mina annonser. Sökande-badgen ligger HÖGST UPP (före titeln) som i
// appen: antalAnsökningar räknar väntande ("så här många kan jag välja bland") och nya
// markeras separat. Visar period, timlön, roller och statuschip (tillsatt / söker person).
import Link from 'next/link';
import RollBrickor from '@/components/app/RollBrickor';
import { formatPeriod } from '@/utils/datumHelper';

export default function SchemaKort({ schema }) {
  const period = formatPeriod(
    (schema.pass ?? []).map((p) => p.datum).filter(Boolean)
  ) || formatPeriod([schema.startdatum, schema.slutdatum].filter(Boolean));

  const tillsatt = Boolean(schema.personNamn || schema.anvandare_id);

  return (
    <Link
      href={`/annonser/schema/${schema.id}`}
      className="block rounded-lg border border-kant bg-yta p-5 shadow-mjuk transition-shadow hover:shadow-lyft"
    >
      {schema.antalAnsökningar > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-pill bg-primär-mjuk px-2.5 py-1 text-[12px] font-bold text-primär">
            {schema.antalAnsökningar} sökande
          </span>
          {schema.nyaAnsökningar > 0 && (
            <span className="rounded-pill bg-primär px-2.5 py-1 text-[12px] font-bold text-white">
              {schema.nyaAnsökningar} nya
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-bold text-text">{schema.titel}</h3>
        {schema.privat && (
          <span className="rounded-pill border border-varning-kant bg-varning-mjuk px-2 py-0.5 text-[11px] font-bold text-varning-text">
            Privat
          </span>
        )}
      </div>
      {period && <p className="mt-0.5 text-[14px] text-text-dämpad">{period}</p>}

      <div className="mt-3">
        <RollBrickor kategorier={schema.kategorier} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-bold text-primär">{schema.timlon} kr/tim</span>
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
