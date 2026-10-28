'use client';

// Publikt jobbkort för privatpersoners jobbläsning (/jobb). Skilt från företagets
// components/app/JobbKort.jsx som visar ansöknings-/avslutningsbadges. Hela kortet är en
// länk till jobbdetaljen. Fälten kommer i PascalCase från GET /jobb (Titel, Plats, Lon …).
import Link from 'next/link';
import { normaliseraKrav } from '@/utils/behorighet';
import { parsaArbetstider, formatDagDatum, parsaObTillagg } from '@/utils/datumHelper';

export default function JobbListKort({ jobb }) {
  const datum = (parsaArbetstider(jobb.arbetstider) ?? [])
    .map((d) => d?.datum)
    .filter(Boolean);
  const visadeDatum = datum.slice(0, 3);
  const kvarDatum = datum.length - visadeDatum.length;

  const harOb = parsaObTillagg(jobb.ob_tillagg).length > 0;
  const antalKrav = normaliseraKrav(jobb.behorighets_krav).length;

  return (
    <Link
      href={`/jobb/${jobb.id}`}
      className="block rounded-lg border border-kant bg-yta p-5 shadow-mjuk transition-shadow hover:shadow-lyft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-bold text-text">{jobb.Titel}</h2>
          {jobb.foretagNamn && (
            <p className="mt-0.5 truncate text-[14px] font-semibold text-primär">
              {jobb.foretagNamn}
            </p>
          )}
        </div>
        {jobb.Lon != null && (
          <span className="shrink-0 whitespace-nowrap text-[15px] font-bold text-text">
            {jobb.Lon} kr/tim
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-text-dämpad">
        {jobb.Plats && <span>{jobb.Plats}</span>}
        {jobb.Kategori && (
          <>
            <span aria-hidden="true">·</span>
            <span>{jobb.Kategori}</span>
          </>
        )}
        {jobb.antal_dagar ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {jobb.antal_dagar} {jobb.antal_dagar === 1 ? 'dag' : 'dagar'}
            </span>
          </>
        ) : null}
      </div>

      {visadeDatum.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visadeDatum.map((d) => (
            <span
              key={d}
              className="rounded-pill bg-yta-dämpad px-2.5 py-0.5 text-[12px] font-semibold text-text-dämpad"
            >
              {formatDagDatum(d)}
            </span>
          ))}
          {kvarDatum > 0 && (
            <span className="px-1 text-[12px] font-semibold text-text-svag">
              +{kvarDatum} till
            </span>
          )}
        </div>
      )}

      {(harOb || antalKrav > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {harOb && (
            <span className="rounded-pill bg-primär-mjuk px-2.5 py-0.5 text-[12px] font-bold text-primär">
              OB-tillägg
            </span>
          )}
          {antalKrav > 0 && (
            <span className="rounded-pill bg-yta-dämpad px-2.5 py-0.5 text-[12px] font-bold text-text-dämpad">
              {antalKrav} {antalKrav === 1 ? 'krav' : 'krav'}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
