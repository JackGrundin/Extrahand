'use client';

// Landningssida för en inbjudningslänk (jobb ELLER schema). Ligger UTANFÖR (app)-gruppen
// så att privatpersoner (inte bara företag) når den.
//   - Inloggad → visa förhandsvisning + "Acceptera förfrågan". Ett klick skapar ansökan
//     OCH godkänner den direkt (POST /inbjudan/:token/acceptera). Har personen signerat
//     avtal → vidare till chatten. Annars → "Jobbet är ditt, vi väntar på avtalet".
//   - Utloggad → förhandsvisning + "Skapa konto och ansök"/"Logga in" (bär med ?next=
//     tillbaka hit, så personen landar här igen efter inloggning/registrering).
// Token sparas i sessionStorage så att den överlever registrerings-/verifieringsstegen.
import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import RollBrickor from '@/components/app/RollBrickor';
import { api, felText } from '@/lib/api';
import {
  formatPeriod,
  veckodagsNamn,
  formatDagDatum,
  parsaArbetstider,
  parsaObTillagg,
  planeradeTimmar,
} from '@/utils/datumHelper';
import { schematypEtikett, formateraPris } from '@/utils/konstanter';
import { normaliseraKrav } from '@/utils/behorighet';

const TOKEN_NYCKEL = 'fastgig.inbjudan.token';

export default function Inbjudan() {
  const { token } = useParams();
  const router = useRouter();
  const { laddar, inloggad } = useAuth();

  const [inbjudan, setInbjudan] = useState(null);
  const [fel, setFel] = useState('');
  const [accepterar, setAccepterar] = useState(false);
  const [accFel, setAccFel] = useState('');
  const [klar, setKlar] = useState(false); // accepterad men avtal saknas → visa väntmeddelande
  const [avböjd, setAvböjd] = useState(false); // tackat nej → visa bekräftelse

  useEffect(() => {
    let avbruten = false;
    // Spara token så att registrerings-/verifieringsflödet kan läsa den efteråt.
    try {
      window.sessionStorage.setItem(TOKEN_NYCKEL, token);
    } catch {
      /* sessionStorage kan vara otillgängligt – länken fungerar ändå via ?next=. */
    }
    (async () => {
      try {
        const data = await api.hämtaInbjudan(token);
        if (!avbruten) setInbjudan(data);
      } catch (f) {
        if (!avbruten) setFel(felText(f));
      }
    })();
    return () => {
      avbruten = true;
    };
  }, [token]);

  async function acceptera() {
    setAccFel('');
    setAccepterar(true);
    try {
      const svar = await api.accepteraInbjudan(token);
      try {
        window.sessionStorage.removeItem(TOKEN_NYCKEL);
      } catch {
        /* ignorera */
      }
      if (svar?.avtalGodkant) {
        // Direkt godkänd och avtal signerat → vidare till chatten med företaget.
        router.replace(`/chatt/${svar.ansokanId}`);
      } else {
        // Jobbet är tilldelat men avtalet väntar på FastGigs godkännande.
        setKlar(true);
      }
    } catch (f) {
      setAccFel(felText(f));
    } finally {
      setAccepterar(false);
    }
  }

  // Tacka nej: ingen backend-åtgärd behövs – vi rensar bara token och visar en bekräftelse
  // (samma sessionStorage-rensning som acceptera gör vid lyckat svar).
  function tackaNej() {
    try {
      window.sessionStorage.removeItem(TOKEN_NYCKEL);
    } catch {
      /* ignorera */
    }
    setAvböjd(true);
  }

  const nästa = `/inbjudan/${token}`;
  const ärSchema = Boolean(inbjudan?.schemaId);
  // Förhandsvisningen (med all pass-/schemainfo) visas i båda inloggningslägena. Fel-, ladd-,
  // klar- och avböjd-lägena behåller det smala centrerade kortet.
  const visarFörhandsvisning = Boolean(inbjudan) && !fel && !laddar && !klar && !avböjd;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bakgrund px-5 py-10">
      <div
        className={`w-full rounded-lg border border-kant bg-yta p-8 shadow-mjuk ${
          visarFörhandsvisning ? 'max-w-2xl text-left' : 'max-w-md text-center'
        }`}
      >
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-svag">FastGig</p>

        {fel ? (
          <div className="mt-4">
            <Besked typ="fel">{fel}</Besked>
            <p className="mt-2 text-[14px] text-text-dämpad">Länken kan vara felaktig eller ha tagits bort.</p>
          </div>
        ) : !inbjudan || laddar ? (
          // Väntar på inbjudningsdata eller på att auth-sessionen laddats (undviker att
          // utloggat-läget blinkar förbi innan vi vet om användaren är inloggad).
          <div className="mt-8 flex justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
          </div>
        ) : klar ? (
          // Accepterad men avtalet är inte godkänt än.
          <div className="mt-4">
            <div className="mb-3 text-[40px]" aria-hidden>🎉</div>
            <p className="text-[17px] font-bold text-text">Jobbet är ditt!</p>
            <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
              Vi väntar bara på att ditt avtal godkänns av FastGig. Så fort det är klart kan du
              börja chatta med företaget om detaljerna.
            </p>
            <div className="mt-6">
              <Knapp variant="kontur" full href="/mina-pass">
                Gå till mina pass
              </Knapp>
            </div>
          </div>
        ) : avböjd ? (
          // Personen tackade nej.
          <div className="mt-4">
            <p className="text-[17px] font-bold text-text">Tack för ditt svar</p>
            <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
              Du har tackat nej till inbjudan. Du behöver inte göra något mer.
            </p>
            <div className="mt-6">
              <Knapp variant="kontur" full href="/">
                Till startsidan
              </Knapp>
            </div>
          </div>
        ) : (
          // Förhandsvisning av passet/schemat ovanför knapparna. Samma info i båda
          // inloggningslägena – bara knapparna längst ner skiljer sig.
          <>
            <h1 className="mt-3 text-center text-[20px] font-bold text-text">
              {inbjudan.företagNamn || 'Ett företag'} har bjudit in dig
            </h1>
            <p className="mt-1 text-center text-[14px] text-text-dämpad">
              till {ärSchema ? 'schemat' : 'jobbet'} nedan · via FastGig
            </p>

            <Detaljer inbjudan={inbjudan} />

            {accFel && (
              <div className="mt-4">
                <Besked typ="fel">{accFel}</Besked>
              </div>
            )}

            {inloggad ? (
              // Inloggad inbjuden → acceptera förfrågan med ett klick.
              <div className="mt-6 flex flex-col gap-3">
                <Knapp variant="primär" full laddar={accepterar} onClick={acceptera}>
                  Acceptera förfrågan
                </Knapp>
                <Knapp variant="kontur" full disabled={accepterar} onClick={tackaNej}>
                  Tacka nej
                </Knapp>
              </div>
            ) : (
              // Utloggad → registrera/logga in och kom tillbaka hit.
              <>
                <p className="mt-5 text-center text-[14px] text-text-dämpad">
                  Skapa ett konto eller logga in för att acceptera förfrågan.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Knapp variant="primär" full href={`/registrera?next=${encodeURIComponent(nästa)}`}>
                    Skapa konto och ansök
                  </Knapp>
                  <Knapp variant="kontur" full href={`/logga-in?next=${encodeURIComponent(nästa)}`}>
                    Logga in
                  </Knapp>
                  <Knapp variant="kontur" full onClick={tackaNej}>
                    Tacka nej
                  </Knapp>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// Fullständig förhandsvisning av passet/schemat. Backend levererar `detaljer` i svaret
// (sidan nås utloggad och kan inte anropa de auth-skyddade /scheman/:id och /jobb/:id).
// Renderingen speglar /schema/[id] respektive /jobb/[id] och återanvänder samma utils.
function Detaljer({ inbjudan }) {
  const detaljer = inbjudan?.detaljer;
  if (!detaljer) return null;
  return inbjudan.schemaId ? (
    <SchemaDetaljer schema={detaljer} />
  ) : (
    <JobbDetaljer jobb={detaljer} />
  );
}

function SchemaDetaljer({ schema }) {
  const period = formatPeriod((schema.pass ?? []).map((p) => p.datum).filter(Boolean));
  const krav = normaliseraKrav(schema.behorighets_krav);

  return (
    <div className="mt-5">
      <h2 className="text-[22px] font-bold leading-tight text-text">{schema.titel}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-dämpad">
        <span>{schematypEtikett(schema.typ)}</span>
        <span aria-hidden="true">·</span>
        <span>{Math.round(Number(schema.timlon))} kr/tim</span>
        {period && (
          <>
            <span aria-hidden="true">·</span>
            <span>{period}</span>
          </>
        )}
      </div>
      <div className="mt-3">
        <RollBrickor kategorier={schema.kategorier} />
      </div>

      {schema.beskrivning && (
        <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-text-dämpad">
          {schema.beskrivning}
        </p>
      )}

      {/* Löneavdrag visas INNAN beslutet – den inbjudna ska se avdragen först. */}
      {Array.isArray(schema.avdrag) && schema.avdrag.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-text">Löneavdrag</h3>
          <ul className="space-y-1">
            {schema.avdrag.map((a) => (
              <li
                key={a.id}
                className="flex justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[13px]"
              >
                <span className="text-text">{a.namn}</span>
                <span className="font-semibold text-text">
                  {formateraPris(Number(a.belopp) || 0)} kr {a.typ === 'totalt' ? '(totalt)' : '(per pass)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h3 className="mb-2 text-[15px] font-bold text-text">Pass ({schema.antalPass})</h3>
        <ul className="space-y-1">
          {(schema.pass ?? []).map((p, i) => (
            <li
              key={p.id ?? i}
              className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[13px]"
            >
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

      {krav.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-text">Behörighetskrav</h3>
          <ul className="list-inside list-disc space-y-1 text-[14px] text-text-dämpad">
            {krav.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function JobbDetaljer({ jobb }) {
  const arbetstider = parsaArbetstider(jobb.arbetstider) ?? [];
  const obRader = parsaObTillagg(jobb.ob_tillagg);
  const timmar = planeradeTimmar(jobb.arbetstider);
  const krav = normaliseraKrav(jobb.behorighets_krav);
  const metad = [
    jobb.Plats || null,
    jobb.Lon != null ? `${Math.round(Number(jobb.Lon))} kr/tim` : null,
    jobb.antal_dagar ? `${jobb.antal_dagar} ${jobb.antal_dagar === 1 ? 'dag' : 'dagar'}` : null,
  ].filter(Boolean);

  return (
    <div className="mt-5">
      <h2 className="text-[22px] font-bold leading-tight text-text">{jobb.Titel}</h2>
      {metad.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-dämpad">
          {metad.map((del, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <span>{del}</span>
            </Fragment>
          ))}
        </div>
      )}

      {jobb.Beskrivning && (
        <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-text-dämpad">
          {jobb.Beskrivning}
        </p>
      )}

      {obRader.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-text">OB-tillägg</h3>
          <ul className="space-y-1">
            {obRader.map((ob, i) => (
              <li
                key={i}
                className="flex justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[13px]"
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

      {arbetstider.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-text">
            Arbetstider{timmar ? ` · ${timmar} h totalt` : ''}
          </h3>
          <ul className="space-y-1">
            {arbetstider.map((d, i) => (
              <li
                key={d?.datum ?? i}
                className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[13px]"
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

      {jobb.adress && (
        <section className="mt-5">
          <h3 className="mb-1 text-[15px] font-bold text-text">Adress</h3>
          <p className="text-[14px] text-text-dämpad">{jobb.adress}</p>
        </section>
      )}

      {krav.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-text">Behörighetskrav</h3>
          <ul className="list-inside list-disc space-y-1 text-[14px] text-text-dämpad">
            {krav.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
