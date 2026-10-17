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

// accent styr en tunn färgad topplist som drar ögat till det som kräver handling.
const ACCENTER = {
  primär: 'border-t-primär',
  varning: 'border-t-varning',
  neutral: 'border-t-kant',
};

function Summeringskort({ etikett, värde, under, href, accent = 'neutral', aktiv = false }) {
  const innehåll = (
    <div
      className={`flex h-full flex-col rounded-lg border border-kant border-t-[3px] ${
        ACCENTER[accent]
      } bg-yta p-6 shadow-mjuk transition-shadow ${href ? 'hover:shadow-lyft' : ''}`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wider text-text-svag">{etikett}</p>
      <p className={`mt-3 text-[36px] font-bold leading-none ${aktiv ? 'text-primär' : 'text-text'}`}>{värde}</p>
      {under && <p className="mt-auto pt-3 text-[13px] text-text-dämpad">{under}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {innehåll}
    </Link>
  ) : (
    innehåll
  );
}

// Sektionsrubrik med valfri räknare och "visa alla"-länk.
function SektionsRubrik({ children, antal, länk, länkText }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-[17px] font-bold text-text">
        {children}
        {antal != null && <span className="ml-2 text-[15px] font-semibold text-text-svag">· {antal}</span>}
      </h2>
      {länk && (
        <Link href={länk} className="text-[14px] font-semibold text-primär hover:underline">
          {länkText || 'Visa alla'}
        </Link>
      )}
    </div>
  );
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

  const idagText = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-text-svag">{idagText}</p>
          <h1 className="mt-1 rubrik-l text-text">Hej {användare?.namn}!</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/publicera/jobb"
            className="rounded-sm bg-gradient-primär px-5 py-2.5 text-[14px] font-bold text-white shadow-mjuk transition-shadow hover:shadow-lyft"
          >
            Publicera pass
          </Link>
          <Link
            href="/publicera/schema"
            className="rounded-sm border border-kant bg-yta px-5 py-2.5 text-[14px] font-bold text-text transition-colors hover:border-kant-stark"
          >
            Publicera schema
          </Link>
        </div>
      </div>

      {stripeStatus === 'ok' && (
        <Besked typ="framgång">Tack! Din prenumeration är uppdaterad.</Besked>
      )}
      {stripeStatus === 'avbruten' && (
        <Besked typ="info">Betalningen avbröts – ingen ändring gjordes.</Besked>
      )}

      {/* Summeringskort */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summeringskort etikett="Aktiva annonser" värde={härledd.jobb.length} href="/annonser" />
        <Summeringskort
          etikett="Pass att avsluta"
          värde={härledd.attAvsluta}
          accent={härledd.attAvsluta > 0 ? 'varning' : 'neutral'}
          href="/avsluta"
          under={härledd.attAvsluta > 0 ? 'Fyll i jobbade timmar' : 'Allt klart'}
        />
        <Summeringskort
          etikett="Nya ansökningar"
          värde={härledd.nyaAnsökningar}
          accent={härledd.nyaAnsökningar > 0 ? 'primär' : 'neutral'}
          aktiv={härledd.nyaAnsökningar > 0}
          href="/annonser"
        />
        <Summeringskort etikett="Plan" värde={planText} />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {/* Kommande pass */}
        <section>
          <SektionsRubrik
            antal={härledd.kommande.length + härledd.scheman.length || null}
            länk={härledd.jobb.length ? '/annonser' : undefined}
          >
            Kommande pass
          </SektionsRubrik>
          {härledd.kommande.length === 0 && härledd.scheman.length === 0 ? (
            <div className="rounded-lg border border-dashed border-kant p-8 text-center">
              <p className="text-[14px] text-text-dämpad">Inga kommande pass.</p>
              <Link href="/publicera/jobb" className="mt-1 inline-block text-[14px] font-semibold text-primär hover:underline">
                Publicera ett pass →
              </Link>
            </div>
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
          <SektionsRubrik antal={härledd.senaste.length || null} länk="/meddelanden" länkText="Meddelanden">
            Senaste ansökningar
          </SektionsRubrik>
          {härledd.senaste.length === 0 ? (
            <p className="rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
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
