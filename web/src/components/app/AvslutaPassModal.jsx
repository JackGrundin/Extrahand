'use client';

// Modal för att avsluta ett pass: företaget fyller i jobbade timmar (och ev. OB) och en
// tidrapport skapas. Speglar appens AvslutaPassModal. Klienten skickar BARA
// { ansokan_id, timmar, ob_tillagg } – backend fryser/beräknar alla belopp (timlön,
// påslag, OB-belopp, avdrag, datum), så kostnadsraden nedan är en uppskattning, inte facit.
import { useState } from 'react';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import FältFel from '@/components/ui/FältFel';
import OBTilläggRedigerare from '@/components/app/OBTilläggRedigerare';
import { api, felText } from '@/lib/api';
import { parsaObTillagg, planeradeTimmar, beräknaObBelopp } from '@/utils/datumHelper';
import { beräknaFakturapris, påslagEller40, formateraPris } from '@/utils/konstanter';
import { saniteraObTillagg } from '@/utils/ob';

export default function AvslutaPassModal({ jobb, ansokanId, onStäng, onKlar }) {
  const [timmar, setTimmar] = useState('');
  const [ob, setOb] = useState(() => parsaObTillagg(jobb?.ob_tillagg));
  const [fel, setFel] = useState('');
  const [timFel, setTimFel] = useState('');
  const [sparar, setSparar] = useState(false);

  const timlön = Number(jobb?.Lon) || 0;
  const påslag = påslagEller40(jobb?.paslag);
  const planerade = planeradeTimmar(jobb?.arbetstider);

  // Komma → punkt, precis som appen.
  const timmarTal = parseFloat(String(timmar).replace(',', '.'));

  // Uppskattad fakturakostnad (timlön + OB, var för sig genom fakturaformeln). Backend är facit.
  const obBelopp = beräknaObBelopp(saniteraObTillagg(ob), timlön);
  const uppskattning =
    timmarTal > 0
      ? beräknaFakturapris(timmarTal * timlön, påslag) + beräknaFakturapris(obBelopp, påslag)
      : null;

  async function skicka() {
    if (!(timmarTal > 0)) {
      setTimFel('Ange antal jobbade timmar');
      return;
    }
    setFel('');
    setSparar(true);
    try {
      await api.skapaRapport({
        ansokan_id: ansokanId,
        timmar: timmarTal,
        ob_tillagg: saniteraObTillagg(ob),
      });
      onKlar();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onStäng} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-auto rounded-t-lg bg-yta p-6 shadow-lyft sm:rounded-lg">
        <h2 className="rubrik-m text-text">Avsluta pass</h2>
        {jobb?.Titel && <p className="mt-0.5 text-[14px] text-text-dämpad">{jobb.Titel}</p>}

        {fel && (
          <div className="mt-4">
            <Besked typ="fel">{fel}</Besked>
          </div>
        )}

        {/* Skrivskyddad info */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
          {timlön > 0 && (
            <span className="text-text-dämpad">
              Timlön <span className="font-semibold text-text">{timlön} kr/tim</span>
            </span>
          )}
          {planerade != null && (
            <span className="text-text-dämpad">
              Planerat <span className="font-semibold text-text">{planerade} h</span>
            </span>
          )}
        </div>

        {/* Jobbade timmar */}
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="timmar" className="text-[13px] font-semibold text-text-dämpad">
            Antal jobbade timmar
          </label>
          <div className="flex items-center gap-2">
            <input
              id="timmar"
              type="text"
              inputMode="decimal"
              autoFocus
              value={timmar}
              onChange={(e) => {
                setTimmar(e.target.value);
                setTimFel('');
              }}
              placeholder="t.ex. 8"
              aria-invalid={Boolean(timFel)}
              className={`w-full rounded-sm border px-3.5 py-3 text-[15px] text-text outline-none transition-colors placeholder:text-text-svag ${
                timFel
                  ? 'border-fel border-[1.5px] bg-[#fef2f2]'
                  : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta'
              }`}
            />
            {planerade != null && (
              <button
                type="button"
                onClick={() => {
                  setTimmar(String(planerade));
                  setTimFel('');
                }}
                className="shrink-0 rounded-sm border border-kant px-3 py-3 text-[13px] font-semibold text-primär hover:bg-primär-mjuk"
              >
                Använd planerat
              </button>
            )}
          </div>
          <FältFel>{timFel}</FältFel>
        </div>

        {/* OB */}
        <div className="mt-4">
          <OBTilläggRedigerare värde={ob} onÄndra={setOb} />
        </div>

        {/* Uppskattad kostnad */}
        {uppskattning != null && (
          <p className="mt-4 text-[13px] text-text-dämpad">
            Uppskattad kostnad:{' '}
            <span className="font-semibold text-text">{formateraPris(uppskattning)} kr</span>{' '}
            (exkl. ev. avdrag – slutgiltigt belopp beräknas av systemet)
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Knapp variant="kontur" full onClick={onStäng}>
            Avbryt
          </Knapp>
          <Knapp variant="primär" full laddar={sparar} onClick={skicka}>
            Avsluta pass
          </Knapp>
        </div>
      </div>
    </div>
  );
}
