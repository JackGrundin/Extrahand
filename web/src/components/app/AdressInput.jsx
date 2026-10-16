'use client';

// Adressfält med sökförslag från /api/adress/sok (Nominatim via backend-proxy – ALDRIG
// direkt från klienten). Fri text är tillåten: en nybyggd adress eller "Norra grinden vid
// lastkajen" måste gå att skriva. Staden fylls ALDRIG i automatiskt när man väljer ett
// förslag – Nominatims ortnamn följer inte SVENSKA_ORTER. 400 ms debounce enligt
// Nominatims villkor. Speglar appens AdressInput.
import { useEffect, useRef, useState } from 'react';
import FältFel from '@/components/ui/FältFel';
import { api } from '@/lib/api';

export default function AdressInput({
  etikett = 'Adress till arbetsplatsen',
  värde,
  onÄndra,
  stad,
  fel,
  placeholder = 't.ex. Storgatan 1',
}) {
  const [förslag, setFörslag] = useState([]);
  const [öppen, setÖppen] = useState(false);
  const [fokus, setFokus] = useState(false);
  // Sätts när ett förslag just valts, så att det efterföljande onÄndra inte startar en
  // ny sökning (vilket skulle öppna listan igen direkt efter valet).
  const precisValt = useRef(false);
  const blurTimer = useRef(null);

  useEffect(() => {
    if (precisValt.current) {
      precisValt.current = false;
      return;
    }
    const q = (värde ?? '').trim();
    if (q.length < 3) {
      setFörslag([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const träffar = await api.sökAdress(q, stad);
        setFörslag(Array.isArray(träffar) ? träffar : []);
      } catch {
        // Nätverksfel ska inte synas: fältet fungerar som vanlig fri text utan förslag.
        setFörslag([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [värde, stad]);

  const felläge = Boolean(fel);
  const visa = öppen && fokus && förslag.length > 0;

  function välj(f) {
    precisValt.current = true;
    onÄndra(f.etikett);
    setFörslag([]);
    setÖppen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <div className="relative">
        <input
          value={värde ?? ''}
          onChange={(e) => {
            onÄndra(e.target.value);
            setÖppen(true);
          }}
          onFocus={() => {
            setFokus(true);
            setÖppen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFokus(false), 150);
          }}
          placeholder={placeholder}
          aria-invalid={felläge}
          className={`w-full rounded-sm border px-3.5 py-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-text-svag ${
            felläge
              ? 'border-fel border-[1.5px] bg-[#fef2f2]'
              : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta'
          }`}
        />
        {visa && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-kant bg-yta shadow-lyft">
            {förslag.map((f, i) => (
              <li key={`${f.etikett}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => välj(f)}
                  className="block w-full px-3.5 py-2.5 text-left text-[15px] text-text hover:bg-yta-dämpad"
                >
                  {f.etikett}
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
