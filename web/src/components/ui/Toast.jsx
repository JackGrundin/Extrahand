'use client';

// Toast-notiser nere i hörnet – webbens motsvarighet till appens push-notiser. Visas när en
// realtidssignal (Supabase Broadcast) berättar att något nytt hänt (nytt meddelande, besvarad
// ansökan osv.). En toast auto-stängs efter en stund, går att stänga manuellt och navigerar
// till rätt vy vid klick. useToaster() kapslar in all state så både företags- och
// privatskalet kan återanvända samma logik utan att duplicera den.
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const AUTO_STÄNG_MS = 5000; // Hur länge en toast ligger kvar innan den försvinner av sig själv.
const MAX_ANTAL = 3; // Fler än så staplar vi aldrig – de äldsta trillar av.

// Färgad vänsterkant per typ. 'framgång' för positiva händelser (besvarad ansökan),
// 'primär' som neutral standard (nytt meddelande m.m.).
const KANTFÄRG = {
  primär: 'border-l-primär',
  framgång: 'border-l-framgång',
};

export function useToaster() {
  const [toaster, setToaster] = useState([]);
  const router = useRouter();
  const räknare = useRef(0); // Monoton räknare → unikt id även om två toasts kommer samma ms.

  const stäng = useCallback((id) => {
    setToaster((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Lägg till en toast. { titel, text, href, typ }. href styr vart klicket navigerar.
  const visa = useCallback(
    ({ titel, text, href, typ = 'primär' }) => {
      const id = ++räknare.current;
      setToaster((prev) => [...prev, { id, titel, text, href, typ }].slice(-MAX_ANTAL));
      setTimeout(() => stäng(id), AUTO_STÄNG_MS);
    },
    [stäng],
  );

  function klicka(t) {
    if (t.href) router.push(t.href);
    stäng(t.id);
  }

  // Själva överlägget. Renderas av skalet (AppSkal/PrivatSkal) så det ligger över allt innehåll.
  const överlägg =
    toaster.length === 0 ? null : (
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toaster.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => klicka(t)}
            className={`anim-fade-up flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-sm border border-l-4 border-kant bg-yta px-4 py-3 shadow-lyft ${
              KANTFÄRG[t.typ] ?? KANTFÄRG.primär
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-text">{t.titel}</p>
              {t.text && <p className="mt-0.5 truncate text-[13px] text-text-dämpad">{t.text}</p>}
            </div>
            <button
              type="button"
              aria-label="Stäng"
              onClick={(e) => {
                e.stopPropagation(); // Bara stänga, inte navigera.
                stäng(t.id);
              }}
              className="-mr-1 -mt-1 shrink-0 rounded-sm px-1.5 text-[18px] leading-none text-text-svag hover:text-text"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );

  return { visa, toaster: överlägg };
}
