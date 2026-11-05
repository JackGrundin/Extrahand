'use client';

// Admin-tidrapporter: alla tidrapporter oavsett status, med status-filter och möjlighet att
// markera godkända (obetalda) som betalda. Beloppen kommer färdigräknade från backend.
import { useCallback, useEffect, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import { api, felText } from '@/lib/api';

const FILTER = [
  { nyckel: '', etikett: 'Alla' },
  { nyckel: 'väntar', etikett: 'Väntar' },
  { nyckel: 'godkänd', etikett: 'Godkänd' },
  { nyckel: 'bestridd', etikett: 'Bestridd' },
];

const STATUSFÄRG = {
  väntar: 'bg-varning-mjuk text-varning',
  godkänd: 'bg-framgång-mjuk text-framgång',
  bestridd: 'bg-fel-mjuk text-fel',
};

function kr(belopp) {
  return `${Math.round(Number(belopp) || 0).toLocaleString('sv-SE')} kr`;
}

export default function AdminTidrapporter() {
  const [status, setStatus] = useState('');
  const [rapporter, setRapporter] = useState(null);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(null);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminTidrapporter(status);
      setRapporter(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setRapporter([]);
      setFel(felText(f));
    }
  }, [status]);

  useEffect(() => {
    setRapporter(null);
    hämta();
  }, [hämta]);

  async function markeraBetald(id) {
    setSparar(id);
    setFel('');
    try {
      await api.markeraTidrapportBetald(id);
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  return (
    <div>
      <h1 className="rubrik-l text-text">Tidrapporter</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTER.map((f) => (
          <button
            key={f.nyckel || 'alla'}
            type="button"
            onClick={() => setStatus(f.nyckel)}
            className={`rounded-pill px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              status === f.nyckel
                ? 'bg-primär text-white'
                : 'bg-yta text-text-dämpad border border-kant hover:border-kant-stark'
            }`}
          >
            {f.etikett}
          </button>
        ))}
      </div>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!rapporter ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : rapporter.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga tidrapporter att visa.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rapporter.map((r) => (
            <li key={r.id} className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-bold text-text">{r.anvandareNamn || 'Okänd'}</p>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[11px] font-bold capitalize ${
                        STATUSFÄRG[r.status] ?? 'bg-yta-dämpad text-text-dämpad'
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.betald && (
                      <span className="rounded-pill bg-framgång-mjuk px-2 py-0.5 text-[11px] font-bold text-framgång">
                        Betald
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-text-dämpad">
                    {r.anvandareEmail}
                    {r.anvandareTelefon ? ` · ${r.anvandareTelefon}` : ''}
                  </p>
                  <p className="mt-1 text-[14px] text-text">
                    {r.jobbTitel || 'Pass'}
                    {r.ärSchemapass && (
                      <span className="ml-2 rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
                        Schemapass
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-text-dämpad">
                    {r.datum} · {r.foretagNamn || 'Okänt företag'}
                  </p>
                </div>
                {r.status === 'godkänd' && !r.betald && (
                  <Knapp
                    variant="sekundär"
                    storlek="liten"
                    laddar={sparar === r.id}
                    onClick={() => markeraBetald(r.id)}
                  >
                    Markera som betald
                  </Knapp>
                )}
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

              {Number(r.avdrag_belopp) > 0 && (
                <p className="mt-2 text-[13px] text-text-dämpad">
                  Löneavdrag: {kr(r.avdrag_belopp)} · Nettoutbetalning:{' '}
                  {kr((Number(r.totalt_belopp) || 0) - (Number(r.avdrag_belopp) || 0))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
