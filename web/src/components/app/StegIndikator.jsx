'use client';

// Stegindikator för det fyrstegvisa schemaflödet. Visar numrerade steg med etiketter.
// Man kan hoppa BAKÅT till ett avklarat steg genom att klicka (aldrig framåt – varje steg
// validerar innan man går vidare). Klick bakåt rensar en ev. passmarkering via onHopp.
export default function StegIndikator({ steg, aktivt, onHopp }) {
  return (
    <ol className="mb-8 flex items-center gap-2">
      {steg.map((etikett, i) => {
        const nr = i + 1;
        const aktiv = nr === aktivt;
        const avklarad = nr < aktivt;
        return (
          <li key={etikett} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!avklarad}
              onClick={() => avklarad && onHopp?.(nr)}
              className={`flex items-center gap-2 ${avklarad ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  aktiv
                    ? 'bg-primär text-white'
                    : avklarad
                      ? 'bg-primär-mjuk text-primär'
                      : 'bg-yta-dämpad text-text-svag'
                }`}
              >
                {avklarad ? '✓' : nr}
              </span>
              <span
                className={`hidden text-[13px] font-semibold sm:inline ${
                  aktiv ? 'text-text' : 'text-text-dämpad'
                }`}
              >
                {etikett}
              </span>
            </button>
            {nr < steg.length && <span className="h-px flex-1 bg-kant" />}
          </li>
        );
      })}
    </ol>
  );
}
