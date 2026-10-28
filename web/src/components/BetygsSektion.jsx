'use client';

// Betygsvy för webben – speglar frontend/src/components/BetygsSektion.js.
// Datan kommer från api.hämtaBetyg(id): { snitt, antal, betyg: [{ stjarnor, kommentar,
// created_at, företagNamn }] }. företagNamn är den som SATTE betyget (etiketten är
// därför generisk). Stjärnor ritas med unicode (★/☆) färgade med stjärna-token, i linje
// med webbens konvention att rita egna symboler i stället för ett ikonbibliotek.
import { useState } from 'react';

const MAX_SYNLIGA = 3;

function antalText(antal) {
  return `${antal} ${antal === 1 ? 'recension' : 'recensioner'}`;
}

// Fem stjärnor, fyllda upp till `värde`.
export function Stjärnor({ värde = 0, storlek = 'text-[15px]' }) {
  return (
    <span
      className={`inline-flex text-stjärna ${storlek}`}
      aria-label={`Betyg ${värde} av 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true">
          {n <= värde ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

// Kompakt sammanfattning: ★ snitt (N recensioner). "Inga betyg ännu" när inga finns.
export function BetygsSammanfattning({ betyg }) {
  if (!betyg || betyg.antal === 0) {
    return <p className="text-[14px] text-text-svag">Inga betyg ännu</p>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-stjärna text-[16px]" aria-hidden="true">
        ★
      </span>
      <span className="text-[16px] font-bold text-text">{betyg.snitt.toFixed(1)}</span>
      <span className="text-[14px] text-text-dämpad">({antalText(betyg.antal)})</span>
    </div>
  );
}

function Recension({ b }) {
  return (
    <div className="rounded-md border border-kant bg-yta-dämpad p-3">
      <div className="flex items-center justify-between">
        <Stjärnor värde={b.stjarnor} />
        <span className="text-[12px] text-text-svag">
          {new Date(b.created_at).toLocaleDateString('sv-SE')}
        </span>
      </div>
      {b.företagNamn && (
        <p className="mt-1.5 text-[13px] font-semibold text-text-dämpad">{b.företagNamn}</p>
      )}
      {b.kommentar && (
        <p className="mt-1 text-[14px] leading-relaxed text-text">{b.kommentar}</p>
      )}
    </div>
  );
}

// Hela sektionen: rubrik + sammanfattning + lista. Visar tre senaste och fäller ut
// resten inline via "Visa alla". Returnerar bara rubrik + "Inga betyg ännu" när tomt.
export default function BetygsSektion({ betyg, rubrik = 'Recensioner' }) {
  const [visaAlla, setVisaAlla] = useState(false);

  if (!betyg || betyg.antal === 0) {
    return (
      <section>
        <h2 className="överlinje mb-2">{rubrik}</h2>
        <p className="text-[14px] text-text-svag">Inga betyg ännu</p>
      </section>
    );
  }

  const lista = betyg.betyg ?? [];
  const synliga = visaAlla ? lista : lista.slice(0, MAX_SYNLIGA);
  const harFler = lista.length > MAX_SYNLIGA;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="överlinje">{rubrik}</h2>
        <BetygsSammanfattning betyg={betyg} />
      </div>

      <div className="flex flex-col gap-2.5">
        {synliga.map((b, i) => (
          <Recension key={i} b={b} />
        ))}
      </div>

      {harFler && !visaAlla && (
        <button
          type="button"
          onClick={() => setVisaAlla(true)}
          className="mt-3 text-[14px] font-semibold text-primär hover:underline"
        >
          Visa alla {betyg.antal} recensioner
        </button>
      )}
    </section>
  );
}
