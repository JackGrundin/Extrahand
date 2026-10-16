'use client';

// Repeterbar editor för OB-tillägg. Varje rad: starttid, sluttid, typ (procent av timlön
// eller fast kr/tim) och värde. Payload-formen är { start, slut, typ, värde } – samma som
// backend validerar via valideraObTillagg (start/slut HH:MM, typ procent|fast, värde > 0).
// OB är frivilligt, så en tom lista är helt giltig.
import TidVäljare from '@/components/app/TidVäljare';

export default function OBTilläggRedigerare({ värde = [], onÄndra, kompakt = false }) {
  const lista = Array.isArray(värde) ? värde : [];

  function uppdatera(i, fält, v) {
    onÄndra(lista.map((ob, idx) => (idx === i ? { ...ob, [fält]: v } : ob)));
  }

  function läggTill() {
    onÄndra([...lista, { start: '', slut: '', typ: 'procent', värde: '' }]);
  }

  function taBort(i) {
    onÄndra(lista.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      {!kompakt && <label className="text-[13px] font-semibold text-text-dämpad">OB-tillägg (valfritt)</label>}

      {lista.map((ob, i) => (
        <div key={i} className="rounded-sm border border-kant bg-yta-dämpad p-3">
          <div className="grid grid-cols-2 gap-2">
            <TidVäljare etikett="Från" värde={ob.start} onÄndra={(v) => uppdatera(i, 'start', v)} />
            <TidVäljare etikett="Till" värde={ob.slut} onÄndra={(v) => uppdatera(i, 'slut', v)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-text-dämpad">Typ</label>
              <select
                value={ob.typ ?? 'procent'}
                onChange={(e) => uppdatera(i, 'typ', e.target.value)}
                className="w-full rounded-sm border border-kant bg-yta px-3 py-3 text-[15px] text-text outline-none focus:border-primär"
              >
                <option value="procent">Procent av timlön</option>
                <option value="fast">Fast kr/tim</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-text-dämpad">
                {ob.typ === 'fast' ? 'Kr/tim' : 'Procent'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={ob.värde ?? ''}
                onChange={(e) => uppdatera(i, 'värde', e.target.value)}
                placeholder={ob.typ === 'fast' ? 't.ex. 25' : 't.ex. 50'}
                className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => taBort(i)}
            className="mt-2 text-[13px] font-semibold text-fel hover:underline"
          >
            Ta bort tillägg
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={läggTill}
        className="self-start rounded-sm border border-dashed border-kant-stark px-4 py-2 text-[14px] font-semibold text-primär hover:bg-primär-mjuk"
      >
        + Lägg till OB-tillägg
      </button>
    </div>
  );
}
