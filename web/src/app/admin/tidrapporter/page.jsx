'use client';

// Admin-tidrapporter: alla tidrapporter oavsett status, med status-filter och möjlighet att
// markera godkända (obetalda) som betalda. Beloppen kommer färdigräknade från backend.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import { api, felText } from '@/lib/api';
import { TIDSFILTER, STANDARD_TIDSFILTER, TIDSFILTER_NYCKEL, tidsfilterFrån } from '@/utils/tidsfilter';

// Etikett för utbetalningsinställningen.
const UTBETALNING_ETIKETT = { direkt: 'Direkt', '25': '25:e varje månad' };

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

// Visar ett YYYY-MM-DD i svensk form. T12:00 undviker att tidszonen flyttar datumet en dag.
function formatDatum(iso) {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('sv-SE');
}

// Visar en full ISO-tidsstämpel (t.ex. fakturerad_at) som svenskt datum.
function formatTidsstämpel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE');
}

// Grön "Fakturerad {datum}"-markör. Fakturerad (fakturerat till företaget) är oberoende
// av betald (utbetalt till personen), så den visas vid sidan av betald-statusen.
function FaktureradBadge({ r }) {
  if (!r.fakturerad) return null;
  return (
    <span className="rounded-pill bg-framgång-mjuk px-2 py-0.5 text-[11px] font-bold text-framgång">
      Fakturerad{r.fakturerad_at ? ` ${formatTidsstämpel(r.fakturerad_at)}` : ''}
    </span>
  );
}

// Enskilt tidrapportskort (direkt-utbetalning, väntande, bestridd eller redan betald).
function RapportKort({ r, sparar, onBetald, onFakturerad }) {
  const installning = r.utbetalning_installning || 'direkt';
  return (
    <li className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-bold text-text">{r.anvandareNamn || 'Okänd'}</p>
            <span
              className={`rounded-pill px-2 py-0.5 text-[11px] font-bold capitalize ${
                STATUSFÄRG[r.status] ?? 'bg-yta-dämpad text-text-dämpad'
              }`}
            >
              {r.status}
            </span>
            <span className="rounded-pill bg-yta-dämpad px-2 py-0.5 text-[11px] font-bold text-text-dämpad">
              {UTBETALNING_ETIKETT[installning] ?? installning}
            </span>
            {r.betald && (
              <span className="rounded-pill bg-framgång-mjuk px-2 py-0.5 text-[11px] font-bold text-framgång">
                Betald
              </span>
            )}
            <FaktureradBadge r={r} />
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
          {r.status === 'godkänd' && r.lonedatum && (
            <p className="mt-1 text-[13px] font-semibold text-framgång">
              Betalas ut {formatDatum(r.lonedatum)}
            </p>
          )}
        </div>
        {r.status === 'godkänd' && (!r.betald || !r.fakturerad) && (
          <div className="flex flex-col items-end gap-2">
            {!r.betald && (
              <Knapp
                variant="sekundär"
                storlek="liten"
                laddar={sparar === r.id}
                onClick={() => onBetald(r.id)}
              >
                Markera som betald
              </Knapp>
            )}
            {!r.fakturerad && (
              <Knapp
                variant="sekundär"
                storlek="liten"
                laddar={sparar === `fakt-${r.id}`}
                onClick={() => onFakturerad(r.id)}
              >
                Markera fakturerad
              </Knapp>
            )}
          </div>
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
  );
}

export default function AdminTidrapporter() {
  const [status, setStatus] = useState('');
  const [tid, setTid] = useState(STANDARD_TIDSFILTER);
  const [rapporter, setRapporter] = useState(null);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(null);

  // Återställ sparat tidsfilter (delat med faktureringsvyn). I en effekt → körs bara i
  // webbläsaren, ingen hydrerings-krock.
  useEffect(() => {
    const sparat = window.localStorage.getItem(TIDSFILTER_NYCKEL);
    if (sparat && TIDSFILTER.some(t => t.nyckel === sparat)) setTid(sparat);
  }, []);

  function väljTid(nyckel) {
    setTid(nyckel);
    window.localStorage.setItem(TIDSFILTER_NYCKEL, nyckel);
  }

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminTidrapporter(status, tidsfilterFrån(tid));
      setRapporter(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setRapporter([]);
      setFel(felText(f));
    }
  }, [status, tid]);

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

  // Markerar en rapport som fakturerad (fakturerat till företaget). Fakturerad är oberoende
  // av betald, så varje rapport bockas av för sig – även raderna inuti en samlad utbetalning.
  // Spar-nyckeln prefixas med 'fakt-' så laddningen inte landar på betald-knappen samma rad.
  async function markeraFakturerad(id) {
    setSparar(`fakt-${id}`);
    setFel('');
    try {
      await api.markeraFakturerad(id);
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  // Markerar en hel samlad utbetalning (en '25:e'-persons månad) som betald. Loopar den
  // enskilda endpointen – samma mönster som fakturering använder för "Markera alla".
  async function markeraGruppBetald(nyckel, ids) {
    setSparar(nyckel);
    setFel('');
    try {
      for (const id of ids) {
        await api.markeraTidrapportBetald(id);
      }
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  // Godkända, obetalda pass för en '25:e'-person slås ihop till en utbetalning per person
  // och lönedatum (den 25:e). Övriga rader (direkt, väntar, bestridd, redan betalda) visas
  // som enskilda kort. Första förekomst styr ordningen, så datum-sorteringen från backend
  // bevaras.
  const poster = useMemo(() => {
    if (!rapporter) return [];
    const grupper = new Map();
    const resultat = [];
    for (const r of rapporter) {
      const samlad = r.status === 'godkänd' && !r.betald && r.utbetalning_installning === '25';
      if (samlad) {
        const nyckel = `${r.anvandare_id}|${r.lonedatum}`;
        let g = grupper.get(nyckel);
        if (!g) {
          g = { typ: 'grupp', nyckel, person: r, lonedatum: r.lonedatum, rader: [], summa: 0 };
          grupper.set(nyckel, g);
          resultat.push(g);
        }
        g.rader.push(r);
        g.summa += (Number(r.totalt_belopp) || 0) - (Number(r.avdrag_belopp) || 0);
      } else {
        resultat.push({ typ: 'rad', nyckel: `rad-${r.id}`, rapport: r });
      }
    }
    return resultat;
  }, [rapporter]);

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

      <div className="mt-3 flex flex-wrap gap-2">
        {TIDSFILTER.map((t) => (
          <button
            key={t.nyckel}
            type="button"
            onClick={() => väljTid(t.nyckel)}
            className={`rounded-pill px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              tid === t.nyckel
                ? 'bg-primär text-white'
                : 'bg-yta text-text-dämpad border border-kant hover:border-kant-stark'
            }`}
          >
            {t.etikett}
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
          {poster.map((post) =>
            post.typ === 'grupp' ? (
              <li key={post.nyckel} className="rounded-lg border-2 border-primär bg-yta p-5 shadow-mjuk">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-bold text-text">{post.person.anvandareNamn || 'Okänd'}</p>
                      <span className="rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
                        25:e varje månad
                      </span>
                    </div>
                    <p className="text-[13px] text-text-dämpad">
                      {post.person.anvandareEmail}
                      {post.person.anvandareTelefon ? ` · ${post.person.anvandareTelefon}` : ''}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-text">
                      Samlad utbetalning · {post.rader.length} pass · betalas ut {formatDatum(post.lonedatum)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase text-text-svag">Summa</p>
                    <p className="text-[20px] font-bold text-primär">{kr(post.summa)}</p>
                    <Knapp
                      variant="sekundär"
                      storlek="liten"
                      laddar={sparar === post.nyckel}
                      onClick={() => markeraGruppBetald(post.nyckel, post.rader.map((r) => r.id))}
                      className="mt-2"
                    >
                      Markera hela utbetalningen som betald
                    </Knapp>
                  </div>
                </div>

                <ul className="mt-4 divide-y divide-kant border-t border-kant">
                  {post.rader.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-[14px] text-text">
                          {r.jobbTitel || 'Pass'}
                          {r.ärSchemapass && (
                            <span className="ml-2 rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
                              Schemapass
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-text-dämpad">
                          {r.datum} · {Number(r.timmar) || 0} h · {r.foretagNamn || 'Okänt företag'}
                          {Number(r.avdrag_belopp) > 0 ? ` · löneavdrag ${kr(r.avdrag_belopp)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.fakturerad ? (
                          <FaktureradBadge r={r} />
                        ) : (
                          <Knapp
                            variant="sekundär"
                            storlek="liten"
                            laddar={sparar === `fakt-${r.id}`}
                            onClick={() => markeraFakturerad(r.id)}
                          >
                            Markera fakturerad
                          </Knapp>
                        )}
                        <span className="text-[14px] font-semibold text-text">
                          {kr((Number(r.totalt_belopp) || 0) - (Number(r.avdrag_belopp) || 0))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <RapportKort
                key={post.nyckel}
                r={post.rapport}
                sparar={sparar}
                onBetald={markeraBetald}
                onFakturerad={markeraFakturerad}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}
