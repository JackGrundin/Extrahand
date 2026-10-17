'use client';

// Privatpersons-schemavy på webben (invite-vägen): se ett schema och ansöka. Ligger UTANFÖR
// (app)-gruppen (som gatear till företag) och har en egen enkel auth-gate: utloggad skickas
// till inloggning med ?next tillbaka hit. Ansökan går mot schemats annons-jobb, precis som i
// appen – backend fryser kravlistan och är sista försvaret.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import Textfält from '@/components/ui/Textfält';
import RollBrickor from '@/components/app/RollBrickor';
import { api, felText } from '@/lib/api';
import { formatPeriod, veckodagsNamn, formatDagDatum } from '@/utils/datumHelper';
import { schematypEtikett, formateraPris } from '@/utils/konstanter';
import { normaliseraKrav, saknadeKrav } from '@/utils/behorighet';

export default function PrivatSchemaVy() {
  const { id } = useParams();
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [schema, setSchema] = useState(null);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);

  const [meddelande, setMeddelande] = useState('');
  const [ikryssade, setIkryssade] = useState(() => new Set());
  const [ansöker, setAnsöker] = useState(false);
  const [sökt, setSökt] = useState(false);

  // Auth-gate: utloggad → inloggning med next tillbaka hit.
  useEffect(() => {
    if (!authLaddar && !inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent(`/schema/${id}`)}`);
    }
  }, [authLaddar, inloggad, id, router]);

  const hämta = useCallback(async () => {
    try {
      setSchema(await api.hämtaSchema(id));
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    if (inloggad) hämta();
  }, [inloggad, hämta]);

  const krav = useMemo(() => normaliseraKrav(schema?.behorighets_krav), [schema]);
  const allaIntygade = saknadeKrav(krav, [...ikryssade]).length === 0;
  const ärPrivatperson = användare?.typ === 'privatperson';

  function växlaKrav(k) {
    setIkryssade((prev) => {
      const ny = new Set(prev);
      if (ny.has(k)) ny.delete(k);
      else ny.add(k);
      return ny;
    });
  }

  async function ansök() {
    if (!schema?.annons_jobb_id) {
      setFel('Schemat går inte att ansöka till just nu.');
      return;
    }
    setFel('');
    setAnsöker(true);
    try {
      await api.sökSchema(schema.annons_jobb_id, {
        meddelande: meddelande.trim() || null,
        intygade_krav: [...ikryssade],
      });
      setSökt(true);
    } catch (f) {
      // 409 = redan sökt/tillsatt räknas också som "klar".
      if (f?.status === 409) setSökt(true);
      else setFel(felText(f));
    } finally {
      setAnsöker(false);
    }
  }

  if (authLaddar || (inloggad && laddar)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bakgrund">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </main>
    );
  }

  if (!inloggad) return null; // effekten skickar vidare
  if (!schema) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        {fel && <Besked typ="fel">{fel}</Besked>}
      </main>
    );
  }

  const period = formatPeriod((schema.pass ?? []).map((p) => p.datum).filter(Boolean));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-[28px] font-bold leading-tight text-text">{schema.titel}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[15px] text-text-dämpad">
        {schema.företagNamn && <span className="font-semibold text-primär">{schema.företagNamn}</span>}
        <span>{schematypEtikett(schema.typ)}</span>
        <span>·</span>
        <span>{schema.timlon} kr/tim</span>
        {period && (
          <>
            <span>·</span>
            <span>{period}</span>
          </>
        )}
      </div>
      <div className="mt-3">
        <RollBrickor kategorier={schema.kategorier} />
      </div>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {schema.beskrivning && (
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-text-dämpad">{schema.beskrivning}</p>
      )}

      {/* Löneavdrag visas INNAN ansökan – den sökande ska se avdragen först. */}
      {Array.isArray(schema.avdrag) && schema.avdrag.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold text-text">Löneavdrag</h2>
          <ul className="space-y-1">
            {schema.avdrag.map((a) => (
              <li key={a.id} className="flex justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]">
                <span className="text-text">{a.namn}</span>
                <span className="font-semibold text-text">
                  {formateraPris(Number(a.belopp) || 0)} kr {a.typ === 'totalt' ? '(totalt)' : '(per pass)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pass */}
      <section className="mt-6">
        <h2 className="mb-2 text-[17px] font-bold text-text">Pass ({schema.antalPass})</h2>
        <ul className="space-y-1">
          {(schema.pass ?? []).map((p, i) => (
            <li key={p.id ?? i} className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]">
              <span className="text-text">
                {veckodagsNamn(p.datum)} {formatDagDatum(p.datum)}
                {p.kategori ? ` · ${p.kategori}` : ''}
              </span>
              <span className="font-semibold text-text-dämpad">
                {p.starttid}–{p.sluttid}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ansökan */}
      <section className="mt-8 rounded-lg border border-kant bg-yta-dämpad p-5">
        {sökt ? (
          <Besked typ="framgång">Du har ansökt till schemat. Företaget hör av sig.</Besked>
        ) : !ärPrivatperson ? (
          <p className="text-[14px] text-text-dämpad">Logga in som privatperson för att ansöka.</p>
        ) : (
          <>
            <h2 className="text-[17px] font-bold text-text">Ansök till schemat</h2>

            {krav.length > 0 && (
              <div className="mt-3">
                <p className="text-[14px] font-semibold text-text-dämpad">Intyga att du uppfyller kraven:</p>
                <div className="mt-2 space-y-2">
                  {krav.map((k) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[15px] text-text">
                      <input
                        type="checkbox"
                        checked={ikryssade.has(k)}
                        onChange={() => växlaKrav(k)}
                        className="h-5 w-5 accent-[#1d4ed8]"
                      />
                      {k}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <Textfält
                etikett="Meddelande (valfritt)"
                value={meddelande}
                onChange={(e) => setMeddelande(e.target.value)}
                placeholder="Berätta kort varför du passar för uppdraget."
                rows={4}
              />
            </div>

            <Knapp
              variant="primär"
              full
              laddar={ansöker}
              disabled={krav.length > 0 && !allaIntygade}
              onClick={ansök}
              className="mt-2"
            >
              Skicka ansökan
            </Knapp>
            {krav.length > 0 && !allaIntygade && (
              <p className="mt-2 text-[13px] text-text-svag">Kryssa i alla krav för att kunna ansöka.</p>
            )}
          </>
        )}
      </section>

      <div className="mt-6">
        <Link href="/" className="text-[14px] font-semibold text-text-dämpad hover:text-text">
          ← Till startsidan
        </Link>
      </div>
    </main>
  );
}
