'use client';

// Månadskalender i flervalsläge för schemaflödets steg 2. Klick på en dag togglar den i
// valdaDatum (ett Set av 'YYYY-MM-DD'). minDatum/maxDatum släcker dagar utanför perioden.
// Flervalet är additivt – kalendern äger aldrig datumlistan, den rapporterar bara toggles
// uppåt via onToggle. Datumsträngar byggs lokalt (ingen Date→ISO) för att undvika att en
// tidszon skjuter datumet en dag.
import { useState } from 'react';

const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MÅNADER = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function datumSträng(år, månad, dag) {
  return `${år}-${pad(månad + 1)}-${pad(dag)}`;
}

// Måndagsbaserat veckodagsindex (0 = måndag ... 6 = söndag).
function veckodagMåndag(år, månad, dag) {
  return (new Date(år, månad, dag).getDay() + 6) % 7;
}

export default function MånadsKalender({ valdaDatum, onToggle, minDatum, maxDatum }) {
  const valda = valdaDatum instanceof Set ? valdaDatum : new Set(valdaDatum);

  // Starta på periodens första månad om den finns, annars innevarande månad.
  const start = minDatum ? new Date(minDatum) : new Date();
  const [vy, setVy] = useState({ år: start.getFullYear(), månad: start.getMonth() });

  const dagarIMånaden = new Date(vy.år, vy.månad + 1, 0).getDate();
  const ledandeTomma = veckodagMåndag(vy.år, vy.månad, 1);

  function byt(delta) {
    const d = new Date(vy.år, vy.månad + delta, 1);
    setVy({ år: d.getFullYear(), månad: d.getMonth() });
  }

  function utanförPeriod(datum) {
    if (minDatum && datum < minDatum) return true;
    if (maxDatum && datum > maxDatum) return true;
    return false;
  }

  return (
    <div className="rounded-lg border border-kant bg-yta p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => byt(-1)}
          aria-label="Föregående månad"
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-kant text-text-dämpad hover:bg-yta-dämpad"
        >
          ‹
        </button>
        <span className="text-[15px] font-bold text-text">
          {MÅNADER[vy.månad]} {vy.år}
        </span>
        <button
          type="button"
          onClick={() => byt(1)}
          aria-label="Nästa månad"
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-kant text-text-dämpad hover:bg-yta-dämpad"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {VECKODAGAR.map((v) => (
          <div key={v} className="py-1 text-center text-[12px] font-semibold text-text-svag">
            {v}
          </div>
        ))}

        {Array.from({ length: ledandeTomma }).map((_, i) => (
          <div key={`tom-${i}`} />
        ))}

        {Array.from({ length: dagarIMånaden }).map((_, i) => {
          const dag = i + 1;
          const datum = datumSträng(vy.år, vy.månad, dag);
          const vald = valda.has(datum);
          const släckt = utanförPeriod(datum);
          return (
            <button
              key={datum}
              type="button"
              disabled={släckt}
              onClick={() => onToggle(datum)}
              className={`flex h-10 items-center justify-center rounded-sm text-[14px] font-semibold transition-colors ${
                släckt
                  ? 'cursor-not-allowed text-text-svag/40'
                  : vald
                    ? 'bg-primär text-white'
                    : 'text-text hover:bg-primär-mjuk'
              }`}
            >
              {dag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
