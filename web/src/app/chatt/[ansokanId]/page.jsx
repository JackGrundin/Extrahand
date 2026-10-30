'use client';

// Privatpersonens chatt-tråd (per ansökan). Speglar webbens företags-tråd
// (app)/meddelanden/[ansokanId]: GET /meddelanden/:ansokanId + POST, realtid via
// useRealtidsPing (RealtidsProvider kommer från chatt/layout.jsx), optimistiskt append.
// Ligger utanför (app) med egen auth-gate. Textmeddelanden + ett tidrapportskort sist i
// tidslinjen när en rapport finns (TidrapportSektion self-fetchar och self-gatar).
// Jobbförfrågningar visas ännu bara i appen (saknar webbstöd).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Besked from '@/components/ui/Besked';
import TidrapportSektion from '@/components/privat/TidrapportSektion';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';

export default function ChattTråd() {
  const { ansokanId } = useParams();
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [meddelanden, setMeddelanden] = useState([]);
  const [meta, setMeta] = useState(null); // { foretagNamn, jobbTitel }
  const [text, setText] = useState('');
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);
  const [skickar, setSkickar] = useState(false);

  const bottenRef = useRef(null);

  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent(`/chatt/${ansokanId}`)}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/oversikt');
    }
  }, [authLaddar, inloggad, användare, ansokanId, router]);

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

  useEffect(() => {
    if (authLaddar || !inloggad || användare?.typ === 'företag') return;
    hämta();
    // Rubrikdata (företagsnamn + jobbtitel) slås upp ur egna ansökningar så den överlever
    // direktnavigering/omladdning (samma mönster som företagstråden).
    api
      .minaAnsökningar()
      .then((lista) => {
        const a = (Array.isArray(lista) ? lista : []).find(
          (x) => String(x.id) === String(ansokanId)
        );
        if (a) setMeta({ foretagNamn: a.foretagNamn, jobbTitel: a.jobbTitel });
      })
      .catch(() => {});
  }, [authLaddar, inloggad, användare, hämta, ansokanId]);

  useRealtidsPing(() => hämta());

  useEffect(() => {
    bottenRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meddelanden]);

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
  const rubrik = useMemo(() => meta?.foretagNamn || 'Konversation', [meta]);

  if (authLaddar || !inloggad || användare?.typ === 'företag') {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  return (
    <PrivatSkal>
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-2xl flex-col">
          <div className="shrink-0">
            <Link
              href="/chatt"
              className="text-[14px] font-semibold text-text-dämpad hover:text-text"
            >
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
          <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-kant bg-yta p-4">
            {laddar ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-kant border-t-primär" />
              </div>
            ) : meddelanden.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-text-dämpad">
                Inga meddelanden än. Skriv något för att börja prata.
              </p>
            ) : (
              meddelanden.map((m) => {
                const ärJag = String(m.avsandare_id) === minId;
                return (
                  <div key={m.id} className={`flex ${ärJag ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] shadow-mjuk ${
                        ärJag
                          ? 'rounded-br-md bg-gradient-primär text-white'
                          : 'rounded-bl-md bg-yta-dämpad text-text'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.innehall}</p>
                      <p
                        className={`mt-1 text-[11px] ${ärJag ? 'text-white/70' : 'text-text-svag'}`}
                      >
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString('sv-SE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            {/* Tidrapportskort sist i tidslinjen – self-fetchar och renderar null utan rapport. */}
            <TidrapportSektion ansökanId={ansokanId} />
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
              className="max-h-32 min-h-[46px] flex-1 resize-none rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär focus:bg-yta"
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
    </PrivatSkal>
  );
}
