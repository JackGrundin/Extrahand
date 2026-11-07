'use client';

// Mina annonser: tre flikar som speglar appens MinaJobbScreen – Pass (aktiva enstaka jobb,
// med pass som behöver avslutas pinnade överst), Scheman och Historik (tidrapporter).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Besked from '@/components/ui/Besked';
import JobbKort from '@/components/app/JobbKort';
import SchemaKort from '@/components/app/SchemaKort';
import { api } from '@/lib/api';
import { behöverAvslutas } from '@/utils/datumHelper';
import { STATUSFÄRGER_TIDRAPPORT, formateraPris } from '@/utils/konstanter';

const FLIKAR = [
  { nyckel: 'pass', etikett: 'Pass' },
  { nyckel: 'scheman', etikett: 'Scheman' },
  { nyckel: 'historik', etikett: 'Historik' },
];

function TomRad({ text, länkText, href }) {
  return (
    <div className="rounded-lg border border-dashed border-kant p-8 text-center">
      <p className="text-[14px] text-text-dämpad">{text}</p>
      {länkText && href && (
        <Link href={href} className="mt-3 inline-block text-[14px] font-semibold text-primär hover:underline">
          {länkText}
        </Link>
      )}
    </div>
  );
}

export default function MinaAnnonser() {
  const [flik, setFlik] = useState('pass');
  const [data, setData] = useState(null);
  const [fel, setFel] = useState('');
  const [klart, setKlart] = useState('');
  const [laddar, setLaddar] = useState(true);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const [jobb, tidigare, scheman, rapporter] = await Promise.all([
        api.minaJobb(),
        api.minaTidigareJobb(),
        api.minaScheman(),
        api.tidrapporterFörFöretag(),
      ]);
      setData({ jobb, tidigare, scheman, rapporter });
    } catch (f) {
      setFel(f?.message || 'Kunde inte hämta annonserna');
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  // Jobb som redan har en tidrapport – styr både pinningen nedan och om passkortet ska
  // visa "Avsluta pass".
  const avslutadeJobbIds = useMemo(
    () => new Set((data?.rapporter ?? []).map((r) => r.jobbId).filter(Boolean)),
    [data]
  );

  // Pass-fliken: aktiva jobb plus tidigare jobb som behöver avslutas (ej redan rapporterade),
  // med de som behöver avslutas pinnade överst – precis som appen.
  const passlista = useMemo(() => {
    if (!data) return [];
    const attAvsluta = (data.tidigare ?? []).filter(
      (j) => !avslutadeJobbIds.has(j.id) && j.harGodkänd && behöverAvslutas(j.arbetstider)
    );
    const aktiva = (data.jobb ?? []).filter((j) => !attAvsluta.some((a) => a.id === j.id));
    return [...attAvsluta, ...aktiva];
  }, [data, avslutadeJobbIds]);

  const schemalista = useMemo(
    () => (data?.scheman ?? []).filter((s) => s.status !== 'avbrutet'),
    [data]
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="rubrik-l text-text">Mina annonser</h1>
        <div className="flex gap-2">
          <Link
            href="/publicera/jobb"
            className="rounded-sm bg-gradient-primär px-4 py-2 text-[14px] font-bold text-white shadow-mjuk hover:shadow-lyft"
          >
            Nytt pass
          </Link>
          <Link
            href="/publicera/schema"
            className="rounded-sm border border-kant bg-yta px-4 py-2 text-[14px] font-bold text-text hover:border-kant-stark"
          >
            Nytt schema
          </Link>
        </div>
      </div>

      {/* Flikar – segmented control */}
      <div className="mb-6 flex rounded-lg border border-kant bg-yta-dämpad p-1">
        {FLIKAR.map((f) => (
          <button
            key={f.nyckel}
            type="button"
            onClick={() => setFlik(f.nyckel)}
            className={`flex-1 rounded-md px-4 py-2 text-[15px] font-semibold transition-all ${
              flik === f.nyckel
                ? 'bg-yta text-text shadow-mjuk'
                : 'text-text-dämpad hover:text-text'
            }`}
          >
            {f.etikett}
          </button>
        ))}
      </div>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {laddar ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : (
        <>
          {flik === 'pass' && (
            <>
              {klart && <Besked typ="framgång">{klart}</Besked>}
              {passlista.length === 0 ? (
                <TomRad text="Du har inga aktiva jobb." länkText="Publicera ett pass →" href="/publicera/jobb" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {passlista.map((j) => (
                    <JobbKort
                      key={j.id}
                      jobb={j}
                      redanAvslutad={avslutadeJobbIds.has(j.id)}
                      onÄndrad={hämta}
                      onAvslutat={(titel) =>
                        setKlart(`Passet "${titel}" avslutades – tidrapporten skickades till arbetstagaren för godkännande.`)
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {flik === 'scheman' &&
            (schemalista.length === 0 ? (
              <TomRad text="Inga scheman än. Publicera ett schema för längre uppdrag." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {schemalista.map((s) => (
                  <SchemaKort key={s.id} schema={s} />
                ))}
              </div>
            ))}

          {flik === 'historik' &&
            ((data?.rapporter ?? []).length === 0 ? (
              <TomRad text="Ingen historik än. Avslutade pass dyker upp här." />
            ) : (
              <ul className="space-y-2">
                {data.rapporter.map((r) => {
                  const färg = STATUSFÄRGER_TIDRAPPORT[r.status] ?? STATUSFÄRGER_TIDRAPPORT.väntar;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-kant bg-yta p-4 shadow-mjuk"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-text">{r.jobbTitel || 'Pass'}</p>
                        <p className="truncate text-[13px] text-text-dämpad">
                          {r.privatpersonNamn} · {r.datum} · {r.timmar} h
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="inline-block rounded-pill px-2.5 py-0.5 text-[12px] font-bold"
                          style={{ backgroundColor: färg.bg, color: färg.text }}
                        >
                          {färg.etikett}
                        </span>
                        <p className="mt-1 text-[14px] font-bold text-text">
                          {formateraPris(Number(r.totalt_belopp) || 0)} kr
                        </p>
                        {Number(r.avdrag_belopp) > 0 && (
                          <p className="text-[12px] text-fel">−{formateraPris(Number(r.avdrag_belopp))} kr</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}
        </>
      )}
    </div>
  );
}
