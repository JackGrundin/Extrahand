'use client';

// Kategoriväljare: ett fält som öppnar en modal med sökbar lista ur KATEGORIER.
// Sök är accent-okänslig via normalisera(). Kategorin är obligatorisk för jobb.
import { useMemo, useState } from 'react';
import FältFel from '@/components/ui/FältFel';
import { KATEGORIER, normalisera } from '@/utils/konstanter';

export default function KategoriVäljare({ etikett = 'Kategori', värde, onVälj, fel }) {
  const [öppen, setÖppen] = useState(false);
  const [sök, setSök] = useState('');

  const träffar = useMemo(() => {
    const q = normalisera(sök);
    if (!q) return KATEGORIER;
    return KATEGORIER.filter((k) => normalisera(k).includes(q));
  }, [sök]);

  const felläge = Boolean(fel);

  return (
    <div className="flex flex-col gap-1.5">
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <button
        type="button"
        onClick={() => setÖppen(true)}
        aria-invalid={felläge}
        className={`w-full rounded-sm border px-3.5 py-3.5 text-left text-[15px] outline-none transition-colors ${
          felläge ? 'border-fel border-[1.5px] bg-[#fef2f2]' : 'border-kant bg-yta-dämpad hover:border-kant-stark'
        } ${värde ? 'text-text' : 'text-text-svag'}`}
      >
        {värde || 'Välj en kategori'}
      </button>
      <FältFel>{fel}</FältFel>

      {öppen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setÖppen(false)} aria-hidden="true" />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-lg bg-yta shadow-lyft sm:rounded-lg">
            <div className="border-b border-kant p-4">
              <input
                autoFocus
                value={sök}
                onChange={(e) => setSök(e.target.value)}
                placeholder="Sök kategori…"
                className="w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär focus:bg-yta"
              />
            </div>
            <ul className="flex-1 overflow-auto p-2">
              {träffar.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => {
                      onVälj(k);
                      setSök('');
                      setÖppen(false);
                    }}
                    className={`block w-full rounded-sm px-3 py-2.5 text-left text-[15px] hover:bg-yta-dämpad ${
                      k === värde ? 'font-semibold text-primär' : 'text-text'
                    }`}
                  >
                    {k}
                  </button>
                </li>
              ))}
              {träffar.length === 0 && (
                <li className="px-3 py-6 text-center text-[14px] text-text-dämpad">Inga kategorier matchar</li>
              )}
            </ul>
            <div className="border-t border-kant p-3">
              <button
                type="button"
                onClick={() => setÖppen(false)}
                className="w-full rounded-sm px-3 py-2.5 text-[15px] font-semibold text-text-dämpad hover:bg-yta-dämpad"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
