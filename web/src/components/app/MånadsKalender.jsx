'use client';

// Månadskalender med TVÅ lägen:
//   Flerval (schemaflödets steg 2): valdaDatum = Set, onToggle togglar, minDatum/maxDatum
//     släcker dagar utanför perioden. Kalendern äger aldrig datumlistan.
//   Läsvy (schemaöversikt): passPerDatum + valtDatum + onVäljDag. Varje dag visar
//     rollprickar (max 3 + "+N") med tre tillstånd: ring = någon saknar person, nedtonad
//     fylld = allt genomfört, fylld = bemannad & planerad.
// Datumsträngar byggs lokalt (ingen Date→ISO) så en tidszon inte skjuter datumet en dag.
// Månaden kan styras utifrån (år/månad + onBytMånad) för att t.ex. hämta data per månad;
// annars hålls den internt.
import { useState } from 'react';
import { rollerFörDag } from '@/utils/schemaPass';

const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MÅNADER = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];
const MAX_PRICKAR = 3;

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

// En rollprick: ring (saknar person), nedtonad fylld (allt genomfört) eller fylld.
function Prick({ roll }) {
  if (roll.saknarPerson) {
    return <span className="h-[6px] w-[6px] rounded-full border-[1.5px]" style={{ borderColor: roll.färg }} />;
  }
  return (
    <span
      className="h-[6px] w-[6px] rounded-full"
      style={{ backgroundColor: roll.färg, opacity: roll.alltGenomfört ? 0.4 : 1 }}
    />
  );
}

export default function MånadsKalender({
  valdaDatum,
  onToggle,
  minDatum,
  maxDatum,
  passPerDatum,
  valtDatum,
  onVäljDag,
  år,
  månad,
  onBytMånad,
}) {
  const läsläge = Boolean(passPerDatum);
  const valda = valdaDatum instanceof Set ? valdaDatum : new Set(valdaDatum);

  // Månaden kan vara styrd utifrån (onBytMånad) eller hållas internt.
  const styrd = typeof onBytMånad === 'function' && år != null && månad != null;
  const start = minDatum ? new Date(minDatum) : new Date();
  const [internVy, setInternVy] = useState({ år: start.getFullYear(), månad: start.getMonth() });
  const vy = styrd ? { år, månad } : internVy;

  const dagarIMånaden = new Date(vy.år, vy.månad + 1, 0).getDate();
  const ledandeTomma = veckodagMåndag(vy.år, vy.månad, 1);

  function byt(delta) {
    const d = new Date(vy.år, vy.månad + delta, 1);
    if (styrd) onBytMånad(d.getFullYear(), d.getMonth());
    else setInternVy({ år: d.getFullYear(), månad: d.getMonth() });
  }

  function utanförPeriod(datum) {
    if (minDatum && datum < minDatum) return true;
    if (maxDatum && datum > maxDatum) return true;
    return false;
  }

  function hanteraKlick(datum) {
    if (läsläge) onVäljDag?.(datum);
    else onToggle?.(datum);
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
          const släckt = !läsläge && utanförPeriod(datum);

          if (läsläge) {
            const roller = rollerFörDag(passPerDatum[datum] ?? []);
            const vald = datum === valtDatum;
            return (
              <button
                key={datum}
                type="button"
                onClick={() => hanteraKlick(datum)}
                className={`flex h-12 flex-col items-center justify-center gap-1 rounded-sm text-[14px] font-semibold transition-colors ${
                  vald ? 'bg-primär-mjuk text-primär ring-1 ring-primär' : 'text-text hover:bg-yta-dämpad'
                }`}
              >
                <span>{dag}</span>
                <span className="flex h-[6px] items-center gap-[3px]">
                  {roller.slice(0, MAX_PRICKAR).map((roll) => (
                    <Prick key={roll.namn ?? '—'} roll={roll} />
                  ))}
                  {roller.length > MAX_PRICKAR && (
                    <span className="text-[9px] font-bold text-text-svag">+{roller.length - MAX_PRICKAR}</span>
                  )}
                </span>
              </button>
            );
          }

          const vald = valda.has(datum);
          return (
            <button
              key={datum}
              type="button"
              disabled={släckt}
              onClick={() => hanteraKlick(datum)}
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
