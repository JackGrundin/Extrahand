'use client';

// Publik jobbdetalj + ansökan för privatpersoner. Ligger UTANFÖR (app)-gruppen. Läsning är
// öppen för alla; ansökan kräver inloggning som privatperson (annars skickas man till
// /logga-in?next=/jobb/<id>). Ansökningsflödet speglar web/src/app/schema/[id]/page.jsx:
// intyga behörighetskrav + valfritt meddelande → POST /ansokningar/:jobbId. Backend är sista
// försvaret (avtal, dubblett, tillsatt, krav).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import Textfält from '@/components/ui/Textfält';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';
import { normaliseraKrav, saknadeKrav } from '@/utils/behorighet';
import {
  parsaArbetstider,
  formatDagDatum,
  veckodagsNamn,
  parsaObTillagg,
  planeradeTimmar,
} from '@/utils/datumHelper';

export default function JobbDetalj() {
  const { id } = useParams();
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [jobb, setJobb] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');

  const [meddelande, setMeddelande] = useState('');
  const [ikryssade, setIkryssade] = useState(() => new Set());
  const [ansöker, setAnsöker] = useState(false);
  const [sökt, setSökt] = useState(false);
  const [avtalFel, setAvtalFel] = useState(false);

  const hämta = useCallback(async () => {
    try {
      setJobb(await api.hämtaJobb(id));
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    hämta();
  }, [hämta]);

  const krav = useMemo(() => normaliseraKrav(jobb?.behorighets_krav), [jobb]);
  const allaIntygade = saknadeKrav(krav, [...ikryssade]).length === 0;
  const ärPrivatperson = användare?.typ === 'privatperson';

  const arbetstider = useMemo(() => parsaArbetstider(jobb?.arbetstider) ?? [], [jobb]);
  const obRader = useMemo(() => parsaObTillagg(jobb?.ob_tillagg), [jobb]);
  const timmar = useMemo(() => planeradeTimmar(jobb?.arbetstider), [jobb]);

  function växlaKrav(k) {
    setIkryssade((prev) => {
      const ny = new Set(prev);
      if (ny.has(k)) ny.delete(k);
      else ny.add(k);
      return ny;
    });
  }

  async function ansök() {
    setFel('');
    setAvtalFel(false);
    setAnsöker(true);
    try {
      await api.sökaJobb(id, {
        meddelande: meddelande.trim() || null,
        intygade_krav: [...ikryssade],
      });
      setSökt(true);
    } catch (f) {
      // 409 = redan sökt/tillsatt räknas också som "klar".
      if (f?.status === 409) setSökt(true);
      else if (f?.kod === 'AVTAL_EJ_GODKANT') setAvtalFel(true);
      else setFel(felText(f));
    } finally {
      setAnsöker(false);
    }
  }

  if (laddar || authLaddar) {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  if (!jobb) {
    return (
      <PrivatSkal>
        <div className="mx-auto max-w-2xl">
          <Besked typ="fel">{fel || 'Jobbet hittades inte.'}</Besked>
          <Link
            href="/jobb"
            className="text-[14px] font-semibold text-text-dämpad hover:text-text"
          >
            ← Tillbaka till jobben
          </Link>
        </div>
      </PrivatSkal>
    );
  }

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[28px] font-bold leading-tight text-text">{jobb.Titel}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-text-dämpad">
          {jobb.foretagNamn && (
            <span className="font-semibold text-primär">{jobb.foretagNamn}</span>
          )}
          {jobb.Plats && (
            <>
              <span aria-hidden="true">·</span>
              <span>{jobb.Plats}</span>
            </>
          )}
          {jobb.Lon != null && (
            <>
              <span aria-hidden="true">·</span>
              <span>{jobb.Lon} kr/tim</span>
            </>
          )}
          {jobb.antal_dagar ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {jobb.antal_dagar} {jobb.antal_dagar === 1 ? 'dag' : 'dagar'}
              </span>
            </>
          ) : null}
        </div>

        {fel && (
          <div className="mt-4">
            <Besked typ="fel">{fel}</Besked>
          </div>
        )}

        {jobb.Beskrivning && (
          <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-text-dämpad">
            {jobb.Beskrivning}
          </p>
        )}

        {/* OB-tillägg */}
        {obRader.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold text-text">OB-tillägg</h2>
            <ul className="space-y-1">
              {obRader.map((ob, i) => (
                <li
                  key={i}
                  className="flex justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]"
                >
                  <span className="text-text">
                    {ob.start}–{ob.slut}
                  </span>
                  <span className="font-semibold text-text">
                    {ob.typ === 'procent' ? `+${ob.värde} %` : `+${ob.värde} kr/tim`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Arbetstider */}
        {arbetstider.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold text-text">
              Arbetstider{timmar ? ` · ${timmar} h totalt` : ''}
            </h2>
            <ul className="space-y-1">
              {arbetstider.map((d, i) => (
                <li
                  key={d?.datum ?? i}
                  className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]"
                >
                  <span className="text-text">
                    {veckodagsNamn(d.datum)} {formatDagDatum(d.datum)}
                  </span>
                  <span className="font-semibold text-text-dämpad">
                    {d.start}–{d.slut}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Adress */}
        {jobb.adress && (
          <section className="mt-6">
            <h2 className="mb-1 text-[17px] font-bold text-text">Adress</h2>
            <p className="text-[15px] text-text-dämpad">{jobb.adress}</p>
          </section>
        )}

        {/* Behörighetskrav (läsvy) */}
        {krav.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold text-text">Behörighetskrav</h2>
            <ul className="list-inside list-disc space-y-1 text-[15px] text-text-dämpad">
              {krav.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Ansökan */}
        <section className="mt-8 rounded-lg border border-kant bg-yta-dämpad p-5">
          {sökt ? (
            <Besked typ="framgång">Din ansökan har skickats. Företaget hör av sig.</Besked>
          ) : avtalFel ? (
            <Besked typ="fel">
              Du behöver godkänna ditt avtal i FastGig-appen innan du kan söka jobb.
            </Besked>
          ) : !inloggad ? (
            <>
              <h2 className="text-[17px] font-bold text-text">Vill du söka jobbet?</h2>
              <p className="mt-1 text-[14px] text-text-dämpad">
                Logga in som privatperson för att skicka din ansökan.
              </p>
              <Knapp
                variant="primär"
                full
                href={`/logga-in?next=${encodeURIComponent(`/jobb/${id}`)}`}
                className="mt-3"
              >
                Logga in för att ansöka
              </Knapp>
            </>
          ) : !ärPrivatperson ? (
            <p className="text-[14px] text-text-dämpad">
              Logga in som privatperson för att ansöka.
            </p>
          ) : (
            <>
              <h2 className="text-[17px] font-bold text-text">Ansök till jobbet</h2>

              {krav.length > 0 && (
                <div className="mt-3">
                  <p className="text-[14px] font-semibold text-text-dämpad">
                    Intyga att du uppfyller kraven:
                  </p>
                  <div className="mt-2 space-y-2">
                    {krav.map((k) => (
                      <label
                        key={k}
                        className="flex cursor-pointer items-center gap-2.5 text-[15px] text-text"
                      >
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
                  placeholder="Berätta kort varför du passar för jobbet."
                  rows={4}
                  maxLength={500}
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
                <p className="mt-2 text-[13px] text-text-svag">
                  Kryssa i alla krav för att kunna ansöka.
                </p>
              )}
            </>
          )}
        </section>

        <div className="mt-6">
          <Link
            href="/jobb"
            className="text-[14px] font-semibold text-text-dämpad hover:text-text"
          >
            ← Tillbaka till jobben
          </Link>
        </div>
      </div>
    </PrivatSkal>
  );
}
