'use client';
// Inbäddad popup-kalender för datumval. Ersätter det tidigare text-/native-hybridfältet
// med ett eget månadsrutnät (nav mellan månader + snabbval Idag/Imorgon/Om en vecka).
//
// Prop-API:t är medvetet oförändrat (värde/onÄndra/fel/min/max/etikett/className) så alla
// befintliga anropsställen fungerar som förut. Värdet in och ut är alltid ISO 'YYYY-MM-DD',
// byggt ur LOKALA år/månad/dag via datumTillIso – toISOString() hade konverterat till UTC
// och gett fel dag för datum valda runt midnatt. min/max är ISO-strängar som jämförs
// lexikografiskt (fungerar eftersom formatet är fast och nollutfyllt).
import { useEffect, useRef, useState } from 'react';
import FältFel from '@/components/ui/FältFel';
import { datumTillIso } from '@/utils/datumHelper';

const SV_MÅNADER = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];
const SV_VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function DatumVäljare({ etikett, värde, onÄndra, fel, min, max, className = '' }) {
  const [öppen, setÖppen] = useState(false);
  // 'dagar' = månadsrutnät, 'år' = årsrutnät (snabbhopp för t.ex. födelsedatum, så man
  // slipper klicka sig bakåt månad för månad över årtionden).
  const [läge, setLäge] = useState('dagar');
  const wrapRef = useRef(null);

  const idag = datumTillIso(new Date());
  // Kalendern öppnas på det valda datumets månad, annars min-datumets, annars dagens.
  const [vy, setVy] = useState(() => {
    const bas = new Date((värde || min || idag) + 'T12:00:00');
    return { år: bas.getFullYear(), månad: bas.getMonth() };
  });

  // Hoppa vyn till ett nytt yttre värde (t.ex. när föräldern sätter datumet) medan stängd.
  useEffect(() => {
    if (öppen || !värde) return;
    const d = new Date(värde + 'T12:00:00');
    setVy({ år: d.getFullYear(), månad: d.getMonth() });
  }, [värde, öppen]);

  // Stäng vid klick utanför. Nollställ även läget så popupen alltid öppnas på månadsvyn.
  useEffect(() => {
    if (!öppen) { setLäge('dagar'); return; }
    const hanterare = (e) => { if (!wrapRef.current?.contains(e.target)) setÖppen(false); };
    document.addEventListener('mousedown', hanterare);
    return () => document.removeEventListener('mousedown', hanterare);
  }, [öppen]);

  function inomGräns(iso) {
    return (!min || iso >= min) && (!max || iso <= max);
  }

  function välj(iso) {
    if (!inomGräns(iso)) return;
    onÄndra(iso);
    setÖppen(false);
  }

  function byteMånad(steg) {
    setVy((v) => {
      let månad = v.månad + steg;
      let år = v.år;
      if (månad < 0) { månad = 11; år -= 1; }
      if (månad > 11) { månad = 0; år += 1; }
      return { år, månad };
    });
  }

  function väljRelativt(dagarFram) {
    const d = new Date();
    d.setDate(d.getDate() + dagarFram);
    välj(datumTillIso(d));
  }

  // Årsrutnät: 12 år per sida, med vald/aktuell vy centrerad.
  const ÅR_PER_SIDA = 12;
  const årStart = vy.år - (((vy.år % ÅR_PER_SIDA) + ÅR_PER_SIDA) % ÅR_PER_SIDA);
  const årEfterSpärr = (år) => (min && år < Number(min.slice(0, 4))) || (max && år > Number(max.slice(0, 4)));

  // Månadsrutnät, måndag först.
  const förstaVeckodag = (new Date(vy.år, vy.månad, 1).getDay() + 6) % 7;
  const dagarIMånad = new Date(vy.år, vy.månad + 1, 0).getDate();
  const rutor = [];
  for (let i = 0; i < förstaVeckodag; i++) rutor.push(null);
  for (let d = 1; d <= dagarIMånad; d++) rutor.push(d);

  const visatDatum = värde
    ? new Date(värde + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Välj datum';

  const snabbval = [
    ['Idag', 0],
    ['Imorgon', 1],
    ['Om en vecka', 7],
  ];

  return (
    <div ref={wrapRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}

      <button
        type="button"
        onClick={() => setÖppen((o) => !o)}
        aria-invalid={Boolean(fel)}
        className={`flex w-full items-center gap-2 rounded-sm border py-3 pl-3.5 pr-3 text-left text-[15px] outline-none transition-colors ${
          fel
            ? 'border-[1.5px] border-fel bg-[#fef2f2]'
            : öppen
              ? 'border-[1.5px] border-primär bg-yta'
              : 'border-kant bg-yta-dämpad hover:border-kant-stark'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-dämpad" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={`flex-1 ${värde ? 'text-text' : 'text-text-svag'}`}>{visatDatum}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-text-svag transition-transform ${öppen ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {öppen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-md border border-kant bg-yta p-4 shadow-lyft">
          {/* Navigering: byter månad i dagläget, bläddrar 12 år i årsläget. */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (läge === 'år' ? setVy((v) => ({ ...v, år: v.år - ÅR_PER_SIDA })) : byteMånad(-1))}
              aria-label={läge === 'år' ? 'Tidigare år' : 'Föregående månad'}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-kant text-text-dämpad transition-colors hover:border-kant-stark hover:text-text"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setLäge((l) => (l === 'år' ? 'dagar' : 'år'))}
              className="rounded-sm px-2 py-1 text-[15px] font-bold text-text transition-colors hover:bg-primär-mjuk hover:text-primär"
              aria-label="Växla mellan månads- och årsval"
            >
              {läge === 'år' ? `${årStart}–${årStart + ÅR_PER_SIDA - 1}` : `${SV_MÅNADER[vy.månad]} ${vy.år}`}
            </button>
            <button
              type="button"
              onClick={() => (läge === 'år' ? setVy((v) => ({ ...v, år: v.år + ÅR_PER_SIDA })) : byteMånad(1))}
              aria-label={läge === 'år' ? 'Senare år' : 'Nästa månad'}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-kant text-text-dämpad transition-colors hover:border-kant-stark hover:text-text"
            >
              ›
            </button>
          </div>

          {läge === 'år' ? (
            /* Årsrutnät – snabbhopp över årtionden (t.ex. födelsedatum). */
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: ÅR_PER_SIDA }, (_, i) => årStart + i).map((år) => {
                const spärrad = årEfterSpärr(år);
                const valtÅr = värde && Number(värde.slice(0, 4)) === år;
                return (
                  <button
                    key={år}
                    type="button"
                    disabled={spärrad}
                    onClick={() => { setVy((v) => ({ ...v, år })); setLäge('dagar'); }}
                    className={`rounded-sm py-2 text-[14px] transition-colors ${
                      valtÅr
                        ? 'bg-primär font-bold text-white'
                        : spärrad
                          ? 'cursor-not-allowed text-text-svag/50'
                          : `font-medium text-text hover:bg-primär-mjuk ${år === vy.år ? 'ring-1 ring-inset ring-primär' : ''}`
                    }`}
                  >
                    {år}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Veckodagar */}
              <div className="mb-1 grid grid-cols-7">
                {SV_VECKODAGAR.map((d) => (
                  <span key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-text-dämpad">{d}</span>
                ))}
              </div>

              {/* Dagar */}
              <div className="grid grid-cols-7 gap-0.5">
                {rutor.map((d, i) => {
                  if (!d) return <span key={`tom-${i}`} />;
                  const iso = datumTillIso(new Date(vy.år, vy.månad, d));
                  const spärrad = !inomGräns(iso);
                  const vald = värde === iso;
                  const ärIdag = iso === idag;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={spärrad}
                      onClick={() => välj(iso)}
                      className={`flex aspect-square items-center justify-center rounded-sm text-[13.5px] transition-colors ${
                        vald
                          ? 'bg-primär font-bold text-white'
                          : spärrad
                            ? 'cursor-not-allowed text-text-svag/50'
                            : `text-text hover:bg-primär-mjuk ${ärIdag ? 'font-bold ring-1 ring-inset ring-primär' : 'font-medium'}`
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* Snabbval – bara relevanta datum nära idag; döljs om de spärras av min/max. */}
              <div className="mt-3 flex gap-1.5 border-t border-kant pt-3">
                {snabbval.map(([snabbEtikett, dagar]) => {
                  const d = new Date();
                  d.setDate(d.getDate() + dagar);
                  if (!inomGräns(datumTillIso(d))) return null;
                  return (
                    <button
                      key={snabbEtikett}
                      type="button"
                      onClick={() => väljRelativt(dagar)}
                      className="rounded-pill border border-kant bg-yta-dämpad px-3 py-1 text-[12px] font-medium text-text-dämpad transition-colors hover:border-primär hover:bg-primär-mjuk hover:text-primär"
                    >
                      {snabbEtikett}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <FältFel>{fel}</FältFel>
    </div>
  );
}
