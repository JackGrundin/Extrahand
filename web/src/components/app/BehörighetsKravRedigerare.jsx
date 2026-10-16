'use client';

// Repeterbar editor för behörighetskrav (fri text). Max MAX_ANTAL_KRAV rader, max
// MAX_LÄNGD_KRAV tecken per krav – speglar backend/utils/behorighet.js. Kraven skickas som
// en array av strängar; normaliseringen (trim/dedupe) sker i backend via normaliseraKrav,
// men vi håller UI:t inom gränserna så servern aldrig behöver avvisa.
import { MAX_ANTAL_KRAV, MAX_LÄNGD_KRAV } from '@/utils/behorighet';

export default function BehörighetsKravRedigerare({ värde = [], onÄndra }) {
  const lista = Array.isArray(värde) ? värde : [];

  function uppdatera(i, v) {
    onÄndra(lista.map((k, idx) => (idx === i ? v.slice(0, MAX_LÄNGD_KRAV) : k)));
  }

  function läggTill() {
    if (lista.length >= MAX_ANTAL_KRAV) return;
    onÄndra([...lista, '']);
  }

  function taBort(i) {
    onÄndra(lista.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-semibold text-text-dämpad">Behörighetskrav (valfritt)</label>
      <p className="text-[13px] text-text-svag">
        T.ex. &quot;Körkort B&quot; eller &quot;Truckkort A+B&quot;. Den sökande måste intyga varje krav.
      </p>

      {lista.map((krav, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={krav}
            maxLength={MAX_LÄNGD_KRAV}
            onChange={(e) => uppdatera(i, e.target.value)}
            placeholder="t.ex. Körkort B"
            className="w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär focus:bg-yta"
          />
          <button
            type="button"
            onClick={() => taBort(i)}
            aria-label="Ta bort krav"
            className="shrink-0 rounded-sm border border-kant px-3 py-3 text-[14px] font-semibold text-fel hover:bg-fel-mjuk"
          >
            ✕
          </button>
        </div>
      ))}

      {lista.length < MAX_ANTAL_KRAV && (
        <button
          type="button"
          onClick={läggTill}
          className="self-start rounded-sm border border-dashed border-kant-stark px-4 py-2 text-[14px] font-semibold text-primär hover:bg-primär-mjuk"
        >
          + Lägg till krav
        </button>
      )}
    </div>
  );
}
