'use client';

// Stadsfält med autocomplete mot SVENSKA_ORTER. Staden MÅSTE väljas ur listan (fri text
// splittrar stadsmatchningen i backend så att jobbnotiser missar folk). Sök är accent-
// okänslig via normalisera() så "malmo" hittar "Malmö". Speglar appens StadInput.
import { useMemo, useRef, useState } from 'react';
import FältFel from '@/components/ui/FältFel';
import { SVENSKA_ORTER } from '@/utils/svenskaOrter';
import { normalisera } from '@/utils/konstanter';

// Förberäknad normaliserad lista (som appen) så filtreringen inte normaliserar om allt
// vid varje tangenttryck.
const NORMALISERADE = SVENSKA_ORTER.map((ort) => [normalisera(ort), ort]);

export default function StadInput({ etikett = 'Stad', värde, onVälj, fel, placeholder = 't.ex. Stockholm' }) {
  const [öppen, setÖppen] = useState(false);
  const [fokus, setFokus] = useState(false);
  const stängTimer = useRef(null);

  const förslag = useMemo(() => {
    const q = normalisera(värde);
    if (!q) return [];
    // Exakt träff behöver inga förslag – staden är redan vald.
    if (NORMALISERADE.some(([n]) => n === q)) return [];
    return NORMALISERADE.filter(([n]) => n.includes(q)).slice(0, 8).map(([, ort]) => ort);
  }, [värde]);

  const visaFörslag = öppen && fokus && förslag.length > 0;
  const felläge = Boolean(fel);

  function välj(ort) {
    onVälj(ort);
    setÖppen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <div className="relative">
        <input
          value={värde ?? ''}
          onChange={(e) => {
            onVälj(e.target.value);
            setÖppen(true);
          }}
          onFocus={() => {
            setFokus(true);
            setÖppen(true);
          }}
          // Liten fördröjning så ett klick på ett förslag hinner registreras före blur.
          onBlur={() => {
            stängTimer.current = setTimeout(() => setFokus(false), 150);
          }}
          placeholder={placeholder}
          aria-invalid={felläge}
          className={`w-full rounded-sm border px-3.5 py-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-text-svag ${
            felläge
              ? 'border-fel border-[1.5px] bg-[#fef2f2]'
              : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta'
          }`}
        />
        {visaFörslag && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-kant bg-yta shadow-lyft">
            {förslag.map((ort) => (
              <li key={ort}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => välj(ort)}
                  className="block w-full px-3.5 py-2.5 text-left text-[15px] text-text hover:bg-yta-dämpad"
                >
                  {ort}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FältFel>{fel}</FältFel>
    </div>
  );
}
