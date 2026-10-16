'use client';

// Företagets dashboard. Hämtar jobb, scheman, tidrapporter, konversationer och
// prenumerationsstatus parallellt och visar en överblick: summeringskort, kommande pass
// och senaste ansökningar. "Pass att avsluta" räknas exakt som appens AttAvslutaContext:
// jobb (aktiva + tidigare) utan tidrapport där sista sluttiden passerat och någon godkänts.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Besked from '@/components/ui/Besked';
import RollBrickor from '@/components/app/RollBrickor';
import { api } from '@/lib/api';
import { behöverAvslutas, förstaArbetsdatum, formatDagDatum, formatPeriod, parsaArbetstider } from '@/utils/datumHelper';
import { STATUSFÄRGER_ANSÖKAN } from '@/utils/konstanter';

function Summeringskort({ etikett, värde, under, href }) {
  const innehåll = (
    <div className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk transition-shadow hover:shadow-lyft">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-text-svag">{etikett}</p>
      <p className="mt-2 text-[32px] font-bold leading-none text-text">{värde}</p>
      {under && <p className="mt-2 text-[13px] text-text-dämpad">{under}</p>}
    </div>
  );
  return href ? <Link href={href}>{innehåll}</Link> : innehåll;
}

function ÖversiktInnehåll() {
  const { användare } = useAuth();
  const sök = useSearchParams();
  const stripeStatus = sök.get('status');

  const [data, setData] = useState(null);
  const [fel, setFel] = useState('');

  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const [jobb, scheman, tidigare, rapporter, konversationer, prenumeration] = await Promise.all([
          api.minaJobb(),
          api.minaScheman(),
          api.minaTidigareJobb(),
          api.tidrapporterFörFöretag(),
          api.företagsKonversationer(),
          api.prenumerationStatus().catch(() => null),
        ]);
        if (!avbruten) setData({ jobb, scheman, tidigare, rapporter, konversationer, prenumeration });
      } catch (f) {
        if (!avbruten) setFel(f?.message || 'Kunde inte hämta översikten');
      }
    })();
    return () => {
      avbruten = true;
    };
  }, []);

  const härledd = useMemo(() => {
    if (!data) return null;
    const jobb = Array.isArray(data.jobb) ? data.jobb : [];
    const scheman = Array.isArray(data.scheman) ? data.scheman : [];
    const tidigare = Array.isArray(data.tidigare) ? data.tidigare : [];
    const rapporter = Array.isArray(data.rapporter) ? data.rapporter : [];
    const konversationer = Array.isArray(data.konversationer) ? data.konversationer : [];

    const avslutadeJobbIds = new Set(rapporter.map((r) => r.jobbId).filter(Boolean));
    const attAvsluta = [...jobb, ...tidigare].filter(
      (j) => !avslutadeJobbIds.has(j.id) && behöverAvslutas(j.arbetstider) && j.harGodkänd
    ).length;

    const nyaAnsökningar =
      jobb.reduce((s, j) => s + (Number(j.nyaAnsökningar) || 0), 0) +
      scheman.reduce((s, j) => s + (Number(j.nyaAnsökningar) || 0), 0);

    // Kommande pass: aktiva enstaka jobb sorterade på närmaste arbetsdatum.
    const kommande = jobb
      .map((j) => ({ ...j, _datum: förstaArbetsdatum(j.arbetstider) }))
      .filter((j) => j._datum)
      .sort((a, b) => a._datum.localeCompare(b._datum))
      .slice(0, 5);

    // Senaste ansökningar: hoppa över materialiserade schemapass (inget folk sökt själva).
    const senaste = konversationer.filter((k) => !k.schemaPassId).slice(0, 5);

    const aktivaScheman = scheman.filter((s) => s.status !== 'avbrutet');

    return { jobb, scheman: aktivaScheman, attAvsluta, nyaAnsökningar, kommande, senaste };
  }, [data]);

  if (fel) return <Besked typ="fel">{fel}</Besked>;

  if (!härledd) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  const prenumeration = data.prenumeration;
  const planText = prenumeration?.pro
    ? 'Pro'
    : prenumeration
      ? `${prenumeration.gratisPassKvar} gratispass kvar`
      : 'Gratis';

  return (
    <div>
      <div className="mb-8">
        <h1 className="rubrik-l text-text">Översikt</h1>
        <p className="mt-1 text-[15px] text-text-dämpad">Hej {användare?.namn}!</p>
      </div>

      {stripeStatus === 'ok' && (
        <Besked typ="framgång">Tack! Din prenumeration är uppdaterad.</Besked>
      )}
      {stripeStatus === 'avbruten' && (
        <Besked typ="info">Betalningen avbröts – ingen ändring gjordes.</Besked>
      )}

      {/* Summeringskort */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summeringskort etikett="Aktiva annonser" värde={härledd.jobb.length} href="/annonser" />
        <Summeringskort
          etikett="Pass att avsluta"
          värde={härledd.attAvsluta}
          under={härledd.attAvsluta > 0 ? 'Skapa tidrapport i appen' : 'Allt klart'}
        />
        <Summeringskort
          etikett="Nya ansökningar"
          värde={härledd.nyaAnsökningar}
          href="/annonser"
        />
        <Summeringskort etikett="Plan" värde={planText} under={prenumeration?.pro ? 'Lägsta påslag' : undefined} />
      </div>

      {/* Snabblänkar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/publicera/jobb"
          className="rounded-sm bg-gradient-primär px-5 py-3 text-[15px] font-bold text-white shadow-mjuk transition-shadow hover:shadow-lyft"
        >
          Publicera pass
        </Link>
        <Link
          href="/publicera/schema"
          className="rounded-sm border border-kant bg-yta px-5 py-3 text-[15px] font-bold text-text transition-colors hover:border-kant-stark"
        >
          Publicera schema
        </Link>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Kommande pass */}
        <section>
          <h2 className="mb-3 text-[17px] font-bold text-text">Kommande pass</h2>
          {härledd.kommande.length === 0 && härledd.scheman.length === 0 ? (
            <p className="rounded-lg border border-dashed border-kant p-6 text-center text-[14px] text-text-dämpad">
              Inga kommande pass. Publicera ett pass för att komma igång.
            </p>
          ) : (
            <ul className="space-y-2">
              {härledd.kommande.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/annonser/jobb/${j.id}/ansokningar`}
                    className="flex items-center justify-between rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-text">{j.Titel}</p>
                      <p className="text-[13px] text-text-dämpad">{j.Plats}</p>
                    </div>
                    <span className="ml-3 shrink-0 text-[13px] font-semibold text-primär">
                      {formatDagDatum(j._datum)}
                    </span>
                  </Link>
                </li>
              ))}
              {härledd.scheman.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/annonser/schema/${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-text">{s.titel}</p>
                      <div className="mt-1">
                        <RollBrickor kategorier={s.kategorier} />
                      </div>
                    </div>
                    <span className="ml-3 shrink-0 text-[13px] font-semibold text-text-dämpad">
                      {formatPeriod(parsaArbetstider(s.arbetstider)?.map((d) => d.datum) ?? [s.startdatum, s.slutdatum])}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Senaste ansökningar */}
        <section>
          <h2 className="mb-3 text-[17px] font-bold text-text">Senaste ansökningar</h2>
          {härledd.senaste.length === 0 ? (
            <p className="rounded-lg border border-dashed border-kant p-6 text-center text-[14px] text-text-dämpad">
              Inga ansökningar än.
            </p>
          ) : (
            <ul className="space-y-2">
              {härledd.senaste.map((k) => {
                const färg = STATUSFÄRGER_ANSÖKAN[k.status] ?? STATUSFÄRGER_ANSÖKAN.väntande;
                const länk = k.schemaId
                  ? `/annonser/schema/${k.schemaId}`
                  : `/annonser/jobb/${k.jobb_id}/ansokningar`;
                return (
                  <li key={k.id}>
                    <Link
                      href={länk}
                      className="flex items-center justify-between rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-text">{k.sökandeNamn || 'Sökande'}</p>
                        <p className="truncate text-[13px] text-text-dämpad">{k.jobbTitel}</p>
                      </div>
                      <span
                        className="ml-3 shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-bold capitalize"
                        style={{ backgroundColor: färg.bg, color: färg.text }}
                      >
                        {k.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Översikt() {
  // useSearchParams kräver en Suspense-gräns i App Router.
  return (
    <Suspense fallback={null}>
      <ÖversiktInnehåll />
    </Suspense>
  );
}
