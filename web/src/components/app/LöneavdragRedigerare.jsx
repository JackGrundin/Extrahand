'use client';

// Repeterbar editor för löneavdrag på ett schema. Varje rad: namn, belopp, typ
// (per_dag = beloppet dras per pass, totalt = beloppet fördelas jämnt över alla pass).
// Avdraget påverkar ALDRIG fakturan – bara vad personen får ut. Översikten räknas av
// anroparen via beräknaAvdragTotalt (multiplicera aldrig tillbaka per-pass-beloppet).
export default function LöneavdragRedigerare({ värde = [], onÄndra }) {
  const lista = Array.isArray(värde) ? värde : [];

  function uppdatera(i, fält, v) {
    onÄndra(lista.map((a, idx) => (idx === i ? { ...a, [fält]: v } : a)));
  }

  function läggTill() {
    onÄndra([...lista, { namn: '', belopp: '', typ: 'per_dag' }]);
  }

  function taBort(i) {
    onÄndra(lista.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-[13px] font-semibold text-text-dämpad">Löneavdrag (valfritt)</label>
        <p className="mt-1 text-[13px] text-text-svag">
          T.ex. boende eller mat. Dras från personens utbetalning – påverkar inte vad ni faktureras.
        </p>
      </div>

      {lista.map((a, i) => (
        <div key={i} className="rounded-sm border border-kant bg-yta-dämpad p-3">
          <input
            value={a.namn ?? ''}
            onChange={(e) => uppdatera(i, 'namn', e.target.value)}
            placeholder="Namn, t.ex. Boende"
            className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={a.belopp ?? ''}
              onChange={(e) => uppdatera(i, 'belopp', e.target.value)}
              placeholder="Belopp (kr)"
              className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
            />
            <select
              value={a.typ ?? 'per_dag'}
              onChange={(e) => uppdatera(i, 'typ', e.target.value)}
              className="w-full rounded-sm border border-kant bg-yta px-3 py-3 text-[15px] text-text outline-none focus:border-primär"
            >
              <option value="per_dag">Per pass</option>
              <option value="totalt">Totalt (fördelas)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => taBort(i)}
            className="mt-2 text-[13px] font-semibold text-fel hover:underline"
          >
            Ta bort avdrag
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={läggTill}
        className="self-start rounded-sm border border-dashed border-kant-stark px-4 py-2 text-[14px] font-semibold text-primär hover:bg-primär-mjuk"
      >
        + Lägg till avdrag
      </button>
    </div>
  );
}
