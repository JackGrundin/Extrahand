'use client';

// Kort för en jobbförfrågan (passerbjudande via chatten) i chatt-tidslinjen. Speglar
// appens JobbforfraganKort: jobbtitel, företagsnamn, datum/tider, timlön och ev. OB.
// Privatpersonen kan Tacka ja/nej när status är 'väntar'; företaget ser bara status.
// Statusvärdena kommer från jobbforfragan-tabellen: 'väntar' | 'accepterad' | 'avslagen'.
import { useState } from 'react';
import { api, felText } from '@/lib/api';

const STATUS = {
  väntar: { klass: 'bg-varning-mjuk text-varning-text', etikett: 'Väntar på svar' },
  accepterad: { klass: 'bg-framgång-mjuk text-framgång', etikett: 'Accepterad' },
  avslagen: { klass: 'bg-fel-mjuk text-fel', etikett: 'Avböjd' },
};

export default function JobbförfråganKort({ förfrågan, företagNamn, ärPrivatperson, onHanterad }) {
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');

  const status = STATUS[förfrågan.status] ?? STATUS.väntar;
  const ob = Array.isArray(förfrågan.ob_tillagg) ? förfrågan.ob_tillagg : [];

  const datum = förfrågan.datum
    ? new Date(`${förfrågan.datum}T12:00:00`).toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '–';

  async function hantera(åtgärd) {
    setSparar(true);
    setFel('');
    try {
      if (åtgärd === 'acceptera') await api.accepteraJobbförfrågan(förfrågan.id);
      else await api.avböjJobbförfrågan(förfrågan.id);
      onHanterad?.();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(false);
    }
  }

  return (
    <div className="rounded-lg border border-kant bg-yta p-4 shadow-mjuk">
      <div className="flex items-center gap-2">
        <span className="text-[16px]" aria-hidden>💼</span>
        <h3 className="flex-1 text-[15px] font-bold text-text">Passförfrågan</h3>
        <span className={`rounded-pill px-2.5 py-1 text-[12px] font-bold ${status.klass}`}>
          {status.etikett}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-[14px]">
        {förfrågan.titel && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">Pass</dt>
            <dd className="font-semibold text-text">{förfrågan.titel}</dd>
          </div>
        )}
        {företagNamn && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">Företag</dt>
            <dd className="font-semibold text-text">{företagNamn}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-text-dämpad">Datum</dt>
          <dd className="font-semibold text-text">{datum}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-dämpad">Tid</dt>
          <dd className="font-semibold text-text">{förfrågan.starttid}–{förfrågan.sluttid}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-dämpad">Timlön</dt>
          <dd className="font-semibold text-text">{Number(förfrågan.timlon).toLocaleString('sv-SE')} kr/tim</dd>
        </div>
      </dl>

      {ob.length > 0 && (
        <div className="mt-3 rounded-sm border border-varning-kant bg-varning-mjuk p-2.5">
          <p className="text-[12px] font-bold text-varning-text">OB-tillägg</p>
          {ob.map((o, i) => (
            <p key={i} className="text-[13px] text-varning-text">
              {o.start}–{o.slut}: {o.typ === 'procent' ? `${o.värde}%` : `${o.värde} kr/h`}
            </p>
          ))}
        </div>
      )}

      {fel && <p className="mt-2 text-[13px] text-fel">{fel}</p>}

      {ärPrivatperson && förfrågan.status === 'väntar' ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={sparar}
            onClick={() => hantera('avboj')}
            className="flex-1 rounded-sm border border-fel py-2.5 text-[14px] font-bold text-fel hover:bg-fel-mjuk disabled:opacity-50"
          >
            Tacka nej
          </button>
          <button
            type="button"
            disabled={sparar}
            onClick={() => hantera('acceptera')}
            className="flex-1 rounded-sm bg-framgång py-2.5 text-[14px] font-bold text-white hover:brightness-105 disabled:opacity-50"
          >
            Tacka ja
          </button>
        </div>
      ) : (
        !ärPrivatperson &&
        förfrågan.status === 'väntar' && (
          <p className="mt-3 text-center text-[13px] italic text-text-svag">
            Väntar på att personen svarar…
          </p>
        )
      )}
    </div>
  );
}
