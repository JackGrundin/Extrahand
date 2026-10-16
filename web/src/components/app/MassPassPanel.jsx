'use client';

// Massredigering i schemaflödets steg 3. Panelen håller sitt EGET utkast med TOMMA fält –
// aldrig förifyllda från ett markerat pass – eftersom tillämpaPåMarkerade bara skriver
// ifyllda fält. "Sätt bara rollen" får alltså inte nolla passens redan ifyllda tider. Ett
// tomt ob_tillagg betyder "rör inte OB", därav den separata länken för att ta bort OB.
import { useState } from 'react';
import TidVäljare from '@/components/app/TidVäljare';
import OBTilläggRedigerare from '@/components/app/OBTilläggRedigerare';

const TOMT = { starttid: '', sluttid: '', kategori: '', ob_tillagg: [], rast_minuter: '' };

export default function MassPassPanel({ antalMarkerade, onTillämpa, onAvmarkera }) {
  const [utkast, setUtkast] = useState(TOMT);

  function sätt(fält, värde) {
    setUtkast((u) => ({ ...u, [fält]: värde }));
  }

  function tillämpa() {
    onTillämpa(
      {
        starttid: utkast.starttid,
        sluttid: utkast.sluttid,
        kategori: utkast.kategori,
        ob_tillagg: utkast.ob_tillagg,
        // null = rör inte rasten; ett ifyllt värde (även 0) skrivs.
        rast_minuter: utkast.rast_minuter === '' ? null : Number(utkast.rast_minuter),
      },
      { rensaOb: false }
    );
    setUtkast(TOMT);
  }

  return (
    <div className="rounded-lg border border-primär-kant bg-primär-mjuk p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-bold text-primär">{antalMarkerade} pass markerade</p>
        <button type="button" onClick={onAvmarkera} className="text-[13px] font-semibold text-primär hover:underline">
          Avmarkera alla
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TidVäljare etikett="Starttid" värde={utkast.starttid} onÄndra={(v) => sätt('starttid', v)} />
        <TidVäljare etikett="Sluttid" värde={utkast.sluttid} onÄndra={(v) => sätt('sluttid', v)} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-text-dämpad">Roll</label>
          <input
            value={utkast.kategori}
            onChange={(e) => sätt('kategori', e.target.value)}
            placeholder="t.ex. Liftvärd"
            className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-text-dämpad">Rast (min)</label>
          <input
            type="number"
            min="0"
            value={utkast.rast_minuter}
            onChange={(e) => sätt('rast_minuter', e.target.value)}
            placeholder="0"
            className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
          />
        </div>
      </div>

      <div className="mt-3">
        <OBTilläggRedigerare värde={utkast.ob_tillagg} onÄndra={(v) => sätt('ob_tillagg', v)} kompakt />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={tillämpa}
          className="rounded-sm bg-primär px-4 py-2.5 text-[14px] font-bold text-white hover:brightness-105"
        >
          Tillämpa på markerade
        </button>
        <button
          type="button"
          onClick={() => onTillämpa({}, { rensaOb: true })}
          className="text-[13px] font-semibold text-fel hover:underline"
        >
          Ta bort OB på markerade pass
        </button>
      </div>
    </div>
  );
}
