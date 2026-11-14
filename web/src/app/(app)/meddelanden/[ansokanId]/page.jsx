'use client';

// Chatt-tråd mellan företaget och en sökande (per ansökan). Meddelanden hämtas via
// GET /meddelanden/:ansokanId och skickas via POST. Realtid via Supabase Broadcast:
// useRealtidsPing triggar en refetch när backend signalerar (payloaden bär bara en typ,
// så vi hämtar om hela tråden – samma mönster som appens ChattScreen). Rubrikens namn/
// jobbtitel slås upp ur företagsKonversationer så de överlever direktnavigering/omladdning.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Besked from '@/components/ui/Besked';
import JobbförfråganKort from '@/components/chatt/JobbförfråganKort';
import TidrapportSektionFöretag from '@/components/app/TidrapportSektionFöretag';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';

export default function ChattTråd() {
  const { ansokanId } = useParams();
  const { användare } = useAuth();

  const [meddelanden, setMeddelanden] = useState([]);
  const [förfrågningar, setFörfrågningar] = useState([]);
  const [motpartId, setMotpartId] = useState(null); // sökandens user-id (för jobbförfrågningar)
  const [meta, setMeta] = useState(null); // { sökandeNamn, jobbTitel }
  const [text, setText] = useState('');
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);
  const [skickar, setSkickar] = useState(false);

  const bottenRef = useRef(null);

  const hämta = useCallback(async () => {
    try {
      const lista = await api.hämtaMeddelanden(ansokanId);
      setMeddelanden(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [ansokanId]);

  // Jobbförfrågningar hämtas separat, nycklat på sökandens user-id. Fel är sekundärt.
  const hämtaFörfrågningar = useCallback(async (sokandeId) => {
    if (sokandeId == null) return;
    try {
      const lista = await api.hämtaJobbförfrågningar(sokandeId);
      setFörfrågningar(Array.isArray(lista) ? lista : []);
    } catch {
      /* ignorera */
    }
  }, []);

  useEffect(() => {
    hämta();
    // Rubrikdata (motpartens namn + jobbtitel) och sökandens id slås upp ur konversationslistan.
    api
      .företagsKonversationer()
      .then((konv) => {
        const k = (Array.isArray(konv) ? konv : []).find((x) => String(x.id) === String(ansokanId));
        if (k) {
          setMeta({ sökandeNamn: k.sökandeNamn, jobbTitel: k.jobbTitel });
          setMotpartId(k.sokande_id ?? null);
          hämtaFörfrågningar(k.sokande_id);
        }
      })
      .catch(() => {});
  }, [hämta, hämtaFörfrågningar, ansokanId]);

  useRealtidsPing(() => {
    hämta();
    if (motpartId != null) hämtaFörfrågningar(motpartId);
  });

  // Autoskroll till botten när meddelandelistan ändras.
  useEffect(() => {
    bottenRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meddelanden, förfrågningar]);

  async function skicka(e) {
    e.preventDefault();
    const innehall = text.trim();
    if (!innehall) return;
    setSkickar(true);
    setFel('');
    try {
      const nytt = await api.skicka(ansokanId, { innehall });
      // Optimistiskt append; dedupe på id ifall en realtidsrefetch hinner före.
      setMeddelanden((prev) => (prev.some((m) => m.id === nytt.id) ? prev : [...prev, nytt]));
      setText('');
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickar(false);
    }
  }

  const minId = String(användare?.id);

  const rubrik = useMemo(() => meta?.sökandeNamn || 'Konversation', [meta]);

  // Slår ihop textmeddelanden (created_at) och jobbförfrågningar (skapad_datum) kronologiskt.
  const tidslinje = useMemo(() => {
    const tid = (v) => {
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const poster = [
      ...meddelanden.map((m) => ({ typ: 'meddelande', tid: tid(m.created_at), data: m, key: `m-${m.id}` })),
      ...förfrågningar.map((f) => ({ typ: 'förfrågan', tid: tid(f.skapad_datum), data: f, key: `f-${f.id}` })),
    ];
    poster.sort((a, b) => a.tid - b.tid);
    return poster;
  }, [meddelanden, förfrågningar]);

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-2xl flex-col">
      <div className="shrink-0">
        <Link href="/meddelanden" className="text-[14px] font-semibold text-text-dämpad hover:text-text">
          ← Meddelanden
        </Link>
        <h1 className="mt-2 text-[20px] font-bold text-text">{rubrik}</h1>
        {meta?.jobbTitel && <p className="text-[14px] text-text-dämpad">{meta.jobbTitel}</p>}
      </div>

      {fel && (
        <div className="mt-3 shrink-0">
          <Besked typ="fel">{fel}</Besked>
        </div>
      )}

      {/* Meddelandelista */}
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-kant bg-bakgrund p-4">
        {laddar ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-kant border-t-primär" />
          </div>
        ) : tidslinje.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-text-dämpad">
            Inga meddelanden än. Skriv något för att börja prata.
          </p>
        ) : (
          tidslinje.map((post) => {
            if (post.typ === 'förfrågan') {
              return (
                <JobbförfråganKort
                  key={post.key}
                  förfrågan={post.data}
                  ärPrivatperson={false}
                  onHanterad={() => hämtaFörfrågningar(motpartId)}
                />
              );
            }
            const m = post.data;
            const ärJag = String(m.avsandare_id) === minId;
            return (
              <div key={post.key} className={`flex ${ärJag ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] shadow-mjuk ${
                    ärJag
                      ? 'rounded-br-md bg-gradient-primär text-white'
                      : 'rounded-bl-md bg-yta text-text'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.innehall}</p>
                  <p className={`mt-1 text-[11px] ${ärJag ? 'text-white/70' : 'text-text-svag'}`}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {/* Tidrapportskort sist i tidslinjen – self-fetchar och renderar null utan rapport. */}
        {!laddar && <TidrapportSektionFöretag ansökanId={ansokanId} jobbTitel={meta?.jobbTitel} />}
        <div ref={bottenRef} />
      </div>

      {/* Inmatning */}
      <form onSubmit={skicka} className="mt-3 flex shrink-0 items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter skickar, Shift+Enter ny rad.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              skicka(e);
            }
          }}
          rows={1}
          placeholder="Skriv ett meddelande…"
          className="max-h-32 min-h-[46px] flex-1 resize-none rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär focus:bg-yta"
        />
        <button
          type="submit"
          disabled={skickar || !text.trim()}
          className="h-[46px] shrink-0 rounded-sm bg-gradient-primär px-5 text-[15px] font-bold text-white shadow-mjuk transition-all hover:shadow-lyft disabled:opacity-50"
        >
          Skicka
        </button>
      </form>
    </div>
  );
}
