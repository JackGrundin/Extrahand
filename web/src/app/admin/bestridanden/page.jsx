'use client';

// Admin-bestridanden (punkt 17): tidrapporter som en privatperson bestridit och som inte
// hanterats inom 24 h – de har eskalerats av cron/godkannBestridande.js. Admin kan antingen
// godkänna företagets ursprungliga rapport, eller skriva in korrekta timmar och skicka en
// korrigerad tidrapport (samma flöde som POST /api/tidrapporter: den dyker upp i chatten och
// privatpersonen godkänner/bestrider den som vanligt).
import { useCallback, useEffect, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import Input from '@/components/ui/Input';
import { api, felText } from '@/lib/api';

function kr(belopp) {
  return `${Math.round(Number(belopp) || 0).toLocaleString('sv-SE')} kr`;
}

function BestridandeKort({ r, timmar, onTimmarÄndrad, fusk, onFuskÄndrad, sparar, onKorrigera, onGodkänn }) {
  const korrId = `korr-${r.id}`;
  const fuskId = `fusk-${r.id}`;
  return (
    <li className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-bold text-text">{r.anvandareNamn || 'Okänd'}</p>
            <span className="rounded-pill bg-fel-mjuk px-2 py-0.5 text-[11px] font-bold text-fel">
              Bestridd
            </span>
            {r.ärSchemapass && (
              <span className="rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
                Schemapass
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] text-text">{r.jobbTitel || 'Pass'}</p>
          <p className="text-[13px] text-text-dämpad">
            {r.datum} · {r.foretagNamn || 'Okänt företag'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-sm bg-yta-dämpad px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-text-svag">Timmar</p>
          <p className="text-[15px] font-bold text-text">{Number(r.timmar) || 0} h</p>
        </div>
        <div className="rounded-sm bg-yta-dämpad px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-text-svag">Timlön</p>
          <p className="text-[15px] font-bold text-text">{kr(r.timlon)}</p>
        </div>
        <div className="rounded-sm bg-yta-dämpad px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-text-svag">Totalt</p>
          <p className="text-[15px] font-bold text-text">{kr(r.totalt_belopp)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-sm bg-fel-mjuk p-3">
        <p className="text-[11px] font-semibold uppercase text-fel">Bestridande</p>
        <p className="mt-0.5 text-[14px] text-text">{r.bestridande_orsak || 'Ingen förklaring angiven'}</p>
        {r.bestridande_starttid && r.bestridande_sluttid && (
          <p className="mt-1 text-[13px] text-text-dämpad">
            Föreslagen tid: {r.bestridande_starttid}–{r.bestridande_sluttid}
          </p>
        )}
      </div>

      <label htmlFor={fuskId} className="mt-4 flex cursor-pointer items-center gap-2 text-[14px] text-text">
        <input
          id={fuskId}
          type="checkbox"
          checked={fusk}
          onChange={(e) => onFuskÄndrad(r.id, e.target.checked)}
          className="h-4 w-4 accent-fel"
        />
        Markera som fusk (skicka varning)
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-28">
          <Input
            etikett="Korrekta timmar"
            id={korrId}
            type="number"
            min="0"
            step="0.25"
            inputMode="decimal"
            value={timmar}
            onChange={(e) => onTimmarÄndrad(r.id, e.target.value)}
            placeholder={`${Number(r.timmar) || 0}`}
          />
        </div>
        <Knapp
          variant="primär"
          storlek="liten"
          laddar={sparar === korrId}
          onClick={() => onKorrigera(r.id)}
        >
          Skicka korrigering
        </Knapp>
        <Knapp
          variant="sekundär"
          storlek="liten"
          laddar={sparar === r.id}
          onClick={() => onGodkänn(r.id)}
        >
          Godkänn ursprunglig
        </Knapp>
      </div>
    </li>
  );
}

export default function AdminBestridanden() {
  const [rapporter, setRapporter] = useState(null);
  const [timmar, setTimmar] = useState({});
  const [fusk, setFusk] = useState({});
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(null);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminBestridanden();
      setRapporter(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setRapporter([]);
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    setRapporter(null);
    hämta();
  }, [hämta]);

  function ändraTimmar(id, värde) {
    setTimmar((t) => ({ ...t, [id]: värde }));
  }

  function ändraFusk(id, värde) {
    setFusk((f) => ({ ...f, [id]: värde }));
  }

  async function skickaKorrigering(id) {
    const antal = Number(timmar[id]);
    if (!antal || antal <= 0) {
      setFel('Ange korrekta timmar (större än 0) innan du skickar en korrigering.');
      return;
    }
    setSparar(`korr-${id}`);
    setFel('');
    try {
      await api.adminKorrigeraBestridande(id, antal, !!fusk[id]);
      setTimmar((t) => {
        const nästa = { ...t };
        delete nästa[id];
        return nästa;
      });
      setFusk((f) => {
        const nästa = { ...f };
        delete nästa[id];
        return nästa;
      });
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  async function godkännUrsprunglig(id) {
    setSparar(id);
    setFel('');
    try {
      await api.adminGodkännBestridande(id, !!fusk[id]);
      setFusk((f) => {
        const nästa = { ...f };
        delete nästa[id];
        return nästa;
      });
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  return (
    <div>
      <h1 className="rubrik-l text-text">Bestridanden</h1>
      <p className="mt-2 text-[14px] text-text-dämpad">
        Bestridanden som inte hanterats inom 24 timmar och eskalerats till FastGig.
      </p>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!rapporter ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : rapporter.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga eskalerade bestridanden just nu.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rapporter.map((r) => (
            <BestridandeKort
              key={r.id}
              r={r}
              timmar={timmar[r.id] ?? ''}
              onTimmarÄndrad={ändraTimmar}
              fusk={!!fusk[r.id]}
              onFuskÄndrad={ändraFusk}
              sparar={sparar}
              onKorrigera={skickaKorrigering}
              onGodkänn={godkännUrsprunglig}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
