'use client';

// Företagets dashboard. Hämtar jobb, scheman, tidrapporter och prenumerationsstatus
// parallellt och visar en överblick: summeringskort plus actionbara mini-listor för
// "Pass att avsluta" och "Nya ansökningar". "Pass att avsluta" räknas exakt som appens
// AttAvslutaContext: jobb (aktiva + tidigare) utan tidrapport där sista sluttiden
// passerat och någon godkänts.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';
import { behöverAvslutas, förstaArbetsdatum, formatDagDatum, formatPeriod, parsaArbetstider } from '@/utils/datumHelper';

// accent styr en tunn färgad topplist som drar ögat till det som kräver handling.
const ACCENTER = {
  primär: 'border-t-primär',
  varning: 'border-t-varning',
  neutral: 'border-t-kant',
};

function Summeringskort({ etikett, värde, under, cta, href, onKlick, accent = 'neutral', aktiv = false }) {
  const innehåll = (
    <div
      className={`flex h-full flex-col rounded-lg border border-kant border-t-[3px] ${
        ACCENTER[accent]
      } bg-yta p-6 shadow-mjuk transition-shadow ${href || onKlick ? 'hover:shadow-lyft' : ''}`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wider text-text-svag">{etikett}</p>
      <p className={`mt-3 text-[36px] font-bold leading-none ${aktiv ? 'text-primär' : 'text-text'}`}>{värde}</p>
      {under && <p className="mt-auto pt-3 text-[13px] text-text-dämpad">{under}</p>}
      {/* cta är bara visuell text – hela kortet är klickbart, så inget nästlat <a>. */}
      {cta && <p className="mt-auto pt-3 text-[13px] font-semibold text-primär">{cta}</p>}
    </div>
  );
  if (onKlick) {
    return (
      <button type="button" onClick={onKlick} className="block h-full w-full text-left">
        {innehåll}
      </button>
    );
  }
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
  const [uppgraderingsfel, setUppgraderingsfel] = useState('');

  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const [jobb, scheman, tidigare, rapporter, prenumeration] = await Promise.all([
          api.minaJobb(),
          api.minaScheman(),
          api.minaTidigareJobb(),
          api.tidrapporterFörFöretag(),
          api.prenumerationStatus().catch(() => null),
        ]);
        if (!avbruten) setData({ jobb, scheman, tidigare, rapporter, prenumeration });
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

    // Pass att avsluta: jobb (aktiva + tidigare) utan tidrapport där sista sluttiden
    // passerat och någon godkänts – exakt appens AttAvslutaContext. Byggs som lista
    // (titel + datum + tid) för mini-listan; antalet driver summeringskortet.
    const avslutadeJobbIds = new Set(rapporter.map((r) => r.jobbId).filter(Boolean));
    const attAvslutaLista = [...jobb, ...tidigare]
      .filter((j) => !avslutadeJobbIds.has(j.id) && behöverAvslutas(j.arbetstider) && j.harGodkänd)
      .map((j) => {
        const datum = förstaArbetsdatum(j.arbetstider);
        // Tiden hämtas från den tidigaste dagen (arbetstider är inte garanterat sorterade).
        const första = (parsaArbetstider(j.arbetstider) ?? [])
          .filter((d) => d?.datum)
          .sort((a, b) => a.datum.localeCompare(b.datum))[0];
        const tid = första?.start && första?.slut ? `${första.start}–${första.slut}` : null;
        return { id: j.id, titel: j.Titel, datum, tid };
      })
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
    const antalAttAvsluta = attAvslutaLista.length;

    const nyaAnsökningar =
      jobb.reduce((s, j) => s + (Number(j.nyaAnsökningar) || 0), 0) +
      scheman.reduce((s, j) => s + (Number(j.nyaAnsökningar) || 0), 0);

    // Nya ansökningar: jobb och scheman med osedda ansökningar, var och en klickbar till
    // sin ansökningsvy. Titel + datum + antal nya.
    const nyaAnsökningarLista = [
      ...jobb
        .filter((j) => Number(j.nyaAnsökningar) > 0)
        .map((j) => ({
          id: `j-${j.id}`,
          titel: j.Titel,
          antal: Number(j.nyaAnsökningar),
          datum: formatDagDatum(förstaArbetsdatum(j.arbetstider)),
          länk: `/annonser/jobb/${j.id}/ansokningar`,
        })),
      ...scheman
        .filter((s) => Number(s.nyaAnsökningar) > 0)
        .map((s) => ({
          id: `s-${s.id}`,
          titel: s.titel,
          antal: Number(s.nyaAnsökningar),
          datum: formatPeriod(parsaArbetstider(s.arbetstider)?.map((d) => d.datum) ?? [s.startdatum, s.slutdatum]),
          länk: `/annonser/schema/${s.id}`,
        })),
    ];

    return {
      jobb,
      attAvslutaLista,
      antalAttAvsluta,
      nyaAnsökningar,
      nyaAnsökningarLista,
    };
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

  // Ej Pro: starta Stripe Checkout (samma mönster som publicera-flödena). Pro: öppna
  // kundportalen. Båda returnerar { url } att redirecta till; fel visas som Besked.
  async function uppgradera() {
    setUppgraderingsfel('');
    try {
      const { url } = await api.skapaCheckout();
      if (url) window.location.href = url;
    } catch (f) {
      setUppgraderingsfel(felText(f));
    }
  }
  async function hanteraPrenumeration() {
    setUppgraderingsfel('');
    try {
      const { url } = await api.öppnaPortal();
      if (url) window.location.href = url;
    } catch (f) {
      setUppgraderingsfel(felText(f));
    }
  }

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

      {uppgraderingsfel && <Besked typ="fel">{uppgraderingsfel}</Besked>}

      {/* Summeringskort */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summeringskort etikett="Aktiva annonser" värde={härledd.jobb.length} href="/annonser" />
        <Summeringskort
          etikett="Pass att avsluta"
          värde={härledd.antalAttAvsluta}
          accent={härledd.antalAttAvsluta > 0 ? 'varning' : 'neutral'}
          href="/avsluta"
          under={härledd.antalAttAvsluta > 0 ? 'Fyll i jobbade timmar' : 'Allt klart'}
        />
        <Summeringskort
          etikett="Nya ansökningar"
          värde={härledd.nyaAnsökningar}
          accent={härledd.nyaAnsökningar > 0 ? 'primär' : 'neutral'}
          aktiv={härledd.nyaAnsökningar > 0}
          href="/annonser"
        />
        {prenumeration?.pro ? (
          <Summeringskort
            etikett="Plan"
            värde="Pro"
            cta="Hantera prenumeration →"
            onKlick={hanteraPrenumeration}
          />
        ) : (
          <Summeringskort
            etikett="Pass till ordinarie pris"
            värde={prenumeration?.gratisPassKvar ?? 0}
            cta="Uppgradera till Pro →"
            onKlick={uppgradera}
          />
        )}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {/* Pass att avsluta – genväg rakt till avsluta-flödet för varje pass. */}
        <section>
          <SektionsRubrik antal={härledd.antalAttAvsluta || null} länk="/avsluta" länkText="Avsluta pass">
            Pass att avsluta
          </SektionsRubrik>
          {härledd.attAvslutaLista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
              Inga pass att avsluta – allt klart.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {härledd.attAvslutaLista.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href="/avsluta"
                      className="flex items-center justify-between rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-text">{p.titel}</p>
                        {p.tid && <p className="text-[13px] text-text-dämpad">{p.tid}</p>}
                      </div>
                      <span className="ml-3 shrink-0 text-[13px] font-semibold text-primär">
                        {formatDagDatum(p.datum)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {härledd.attAvslutaLista.length > 5 && (
                <Link href="/avsluta" className="mt-3 inline-block text-[14px] font-semibold text-primär hover:underline">
                  Visa alla →
                </Link>
              )}
            </>
          )}
        </section>

        {/* Nya ansökningar – per jobb/schema, klickar rakt in i ansökningsvyn. */}
        <section>
          <SektionsRubrik antal={härledd.nyaAnsökningar || null} länk="/annonser">
            Nya ansökningar
          </SektionsRubrik>
          {härledd.nyaAnsökningarLista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
              Inga nya ansökningar.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {härledd.nyaAnsökningarLista.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.länk}
                      className="flex items-center justify-between rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-text">{a.titel}</p>
                        {a.datum && <p className="text-[13px] text-text-dämpad">{a.datum}</p>}
                      </div>
                      <span className="ml-3 shrink-0 rounded-pill bg-primär-mjuk px-2.5 py-0.5 text-[12px] font-bold text-primär">
                        {a.antal} {a.antal === 1 ? 'ny' : 'nya'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {härledd.nyaAnsökningarLista.length > 5 && (
                <Link href="/annonser" className="mt-3 inline-block text-[14px] font-semibold text-primär hover:underline">
                  Visa alla →
                </Link>
              )}
            </>
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
