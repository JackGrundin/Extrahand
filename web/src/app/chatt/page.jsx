'use client';

// Privatpersonens Meddelanden: två flikar – Konversationer (en konversation per ansökan,
// via api.minaAnsökningar) och Förfrågningar (inkomna inbjudningar via länk/mejl +
// jobbförfrågningar). Ligger UTANFÖR (app)-gruppen med egen auth-gate; realtid kommer från
// RealtidsProvider i chatt/layout.jsx.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Besked from '@/components/ui/Besked';
import JobbförfråganKort from '@/components/chatt/JobbförfråganKort';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';
import { ansökanStatusVisning } from '@/utils/konstanter';

// Samma dag → klockslag, annars datum. Speglar företagsinkorgens tidKort.
function tidKort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const idag = new Date();
  const sammaDag = d.toDateString() === idag.toDateString();
  return sammaDag
    ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function formatDatum(datum) {
  if (!datum) return null;
  return new Date(`${datum}T12:00:00`).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Kort för en inkommen inbjudan (länk/mejl). Acceptera skapar + godkänner ansökan direkt.
function InbjudanKort({ inbjudan, onAccepterad }) {
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');

  async function acceptera() {
    setFel('');
    setSparar(true);
    try {
      const svar = await api.accepteraInbjudanViaId(inbjudan.id);
      onAccepterad(svar);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(false);
    }
  }

  return (
    <div className="rounded-lg border border-kant bg-yta p-4 shadow-mjuk">
      <div className="flex items-center gap-2">
        <span className="text-[16px]" aria-hidden>✉️</span>
        <h3 className="flex-1 text-[15px] font-bold text-text">Inbjudan</h3>
        <span className="rounded-pill bg-primär-mjuk px-2.5 py-1 text-[12px] font-bold text-primär">
          {inbjudan.typ === 'schema' ? 'Schema' : 'Pass'}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-[14px]">
        {inbjudan.titel && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">{inbjudan.typ === 'schema' ? 'Schema' : 'Pass'}</dt>
            <dd className="font-semibold text-text">{inbjudan.titel}</dd>
          </div>
        )}
        {inbjudan.företagNamn && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">Företag</dt>
            <dd className="font-semibold text-text">{inbjudan.företagNamn}</dd>
          </div>
        )}
        {inbjudan.datum && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">{inbjudan.typ === 'schema' ? 'Start' : 'Datum'}</dt>
            <dd className="font-semibold text-text">{formatDatum(inbjudan.datum)}</dd>
          </div>
        )}
        {inbjudan.timlon != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-dämpad">Timlön</dt>
            <dd className="font-semibold text-text">{Math.round(Number(inbjudan.timlon))} kr/tim</dd>
          </div>
        )}
      </dl>
      {fel && <p className="mt-2 text-[13px] text-fel">{fel}</p>}
      <div className="mt-4">
        <button
          type="button"
          disabled={sparar}
          onClick={acceptera}
          className="w-full rounded-sm bg-framgång py-2.5 text-[14px] font-bold text-white hover:brightness-105 disabled:opacity-50"
        >
          Acceptera förfrågan
        </button>
      </div>
    </div>
  );
}

export default function ChattInkorg() {
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [flik, setFlik] = useState('konversationer');
  const [ansökningar, setAnsökningar] = useState([]);
  const [inbjudningar, setInbjudningar] = useState([]);
  const [jobbförfrågningar, setJobbförfrågningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const [avtalVäntar, setAvtalVäntar] = useState(false); // accepterad men avtal ej godkänt

  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent('/chatt')}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/oversikt');
    }
  }, [authLaddar, inloggad, användare, router]);

  const hämta = useCallback(async () => {
    try {
      const [ans, inbj, jobbf] = await Promise.all([
        api.minaAnsökningar().catch(() => []),
        api.hämtaMinaInbjudningar().catch(() => []),
        api.minaJobbförfrågningar().catch(() => []),
      ]);
      setAnsökningar(Array.isArray(ans) ? ans : []);
      setInbjudningar(Array.isArray(inbj) ? inbj : []);
      setJobbförfrågningar(Array.isArray(jobbf) ? jobbf : []);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    if (!authLaddar && inloggad && användare?.typ !== 'företag') hämta();
  }, [authLaddar, inloggad, användare, hämta]);

  useRealtidsPing(() => hämta());

  const lista = useMemo(
    () =>
      (ansökningar ?? [])
        .filter((a) => a.schemaPassId == null)
        .sort((a, b) => {
          const ta = a.senasteMeddelande?.created_at || a.created_at || '';
          const tb = b.senasteMeddelande?.created_at || b.created_at || '';
          return tb.localeCompare(ta);
        }),
    [ansökningar]
  );

  // Förfrågningar: inbjudningar + jobbförfrågningar, sorterade nyast först.
  const förfrågningar = useMemo(() => {
    const poster = [
      ...inbjudningar.map((i) => ({ sort: i.skapad_datum || i.datum || '', typ: 'inbjudan', data: i, key: `i-${i.id}` })),
      ...jobbförfrågningar.map((j) => ({ sort: j.skapad_datum || j.datum || '', typ: 'jobbforfragan', data: j, key: `j-${j.id}` })),
    ];
    poster.sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
    return poster;
  }, [inbjudningar, jobbförfrågningar]);

  // Efter accept: avtal godkänt → till chatten; annars visa väntmeddelande + uppdatera listor.
  function efterAccept(svar) {
    if (svar?.avtalGodkant && svar.ansokanId) {
      router.push(`/chatt/${svar.ansokanId}`);
    } else {
      setAvtalVäntar(true);
      hämta();
    }
  }

  if (authLaddar || !inloggad || användare?.typ === 'företag' || laddar) {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  const antalFörfrågningar = förfrågningar.length;

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-2xl">
        <h1 className="rubrik-l text-text">Meddelanden</h1>

        {/* Flikar */}
        <div className="mt-4 mb-2 flex gap-1 border-b border-kant">
          <button
            type="button"
            onClick={() => setFlik('konversationer')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[15px] font-semibold transition-colors ${
              flik === 'konversationer'
                ? 'border-primär text-primär'
                : 'border-transparent text-text-dämpad hover:text-text'
            }`}
          >
            Konversationer
          </button>
          <button
            type="button"
            onClick={() => setFlik('forfragningar')}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[15px] font-semibold transition-colors ${
              flik === 'forfragningar'
                ? 'border-primär text-primär'
                : 'border-transparent text-text-dämpad hover:text-text'
            }`}
          >
            Förfrågningar
            {antalFörfrågningar > 0 && (
              <span className="rounded-pill bg-primär px-2 py-0.5 text-[11px] font-bold text-white">
                {antalFörfrågningar}
              </span>
            )}
          </button>
        </div>

        {fel && <Besked typ="fel">{fel}</Besked>}

        {flik === 'konversationer' ? (
          lista.length === 0 ? (
            <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
              <p className="text-[15px] font-semibold text-text">Inga konversationer än</p>
              <p className="mt-1 text-[14px] text-text-dämpad">Sök ett pass så kan ni chatta här.</p>
              <Link href="/jobb" className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline">
                Hitta jobb
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-2">
              {lista.map((k) => {
                const status = ansökanStatusVisning(k) ?? { etikett: k.status, bg: '#f3f4f6', text: '#6b7280' };
                const initial = (k.foretagNamn || '?').charAt(0).toUpperCase();
                return (
                  <li key={k.id}>
                    <Link
                      href={`/chatt/${k.id}`}
                      className="flex items-center gap-3 rounded-lg border border-kant bg-yta p-4 shadow-mjuk transition-shadow hover:shadow-lyft"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[15px] font-bold text-white">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[15px] font-bold text-text">{k.foretagNamn || 'Företag'}</p>
                          <span className="shrink-0 text-[12px] text-text-svag">
                            {tidKort(k.senasteMeddelande?.created_at)}
                          </span>
                        </div>
                        <p className="truncate text-[13px] text-text-dämpad">{k.jobbTitel}</p>
                        <p className="truncate text-[13px] text-text-svag">
                          {k.senasteMeddelande?.innehall || 'Ingen konversation än'}
                        </p>
                      </div>
                      <span
                        className="ml-1 hidden shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-bold sm:inline"
                        style={{ backgroundColor: status.bg, color: status.text }}
                      >
                        {status.etikett}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : avtalVäntar ? (
          <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
            <div className="mb-2 text-[36px]" aria-hidden>🎉</div>
            <p className="text-[16px] font-bold text-text">Jobbet är ditt!</p>
            <p className="mt-2 text-[14px] leading-relaxed text-text-dämpad">
              Vi väntar bara på att ditt avtal godkänns av FastGig. Så fort det är klart kan du börja
              chatta med företaget.
            </p>
            <button
              type="button"
              onClick={() => setAvtalVäntar(false)}
              className="mt-4 text-[14px] font-semibold text-primär hover:underline"
            >
              Tillbaka till förfrågningar
            </button>
          </div>
        ) : antalFörfrågningar === 0 ? (
          <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
            <p className="text-[15px] font-semibold text-text">Inga förfrågningar</p>
            <p className="mt-1 text-[14px] text-text-dämpad">
              Inbjudningar och passerbjudanden från företag dyker upp här.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {förfrågningar.map((post) =>
              post.typ === 'inbjudan' ? (
                <InbjudanKort key={post.key} inbjudan={post.data} onAccepterad={efterAccept} />
              ) : (
                <JobbförfråganKort
                  key={post.key}
                  förfrågan={post.data}
                  företagNamn={post.data.företagNamn}
                  ärPrivatperson
                  onHanterad={hämta}
                />
              )
            )}
          </div>
        )}
      </div>
    </PrivatSkal>
  );
}
