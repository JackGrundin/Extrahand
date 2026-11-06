'use client';

// Landningssida för en inbjudningslänk (jobb ELLER schema). Ligger UTANFÖR (app)-gruppen
// så att privatpersoner (inte bara företag) når den.
//   - Inloggad → visa förhandsvisning + "Acceptera förfrågan". Ett klick skapar ansökan
//     OCH godkänner den direkt (POST /inbjudan/:token/acceptera). Har personen signerat
//     avtal → vidare till chatten. Annars → "Jobbet är ditt, vi väntar på avtalet".
//   - Utloggad → förhandsvisning + "Skapa konto och ansök"/"Logga in" (bär med ?next=
//     tillbaka hit, så personen landar här igen efter inloggning/registrering).
// Token sparas i sessionStorage så att den överlever registrerings-/verifieringsstegen.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';
import { formatPeriod } from '@/utils/datumHelper';

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
  // Perioden visas innan personen väljer – bara för scheman (jobb saknar start/slut).
  const period = ärSchema ? formatPeriod([inbjudan?.startdatum, inbjudan?.slutdatum]) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bakgrund px-5">
      <div className="w-full max-w-md rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
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
              <Knapp variant="kontur" full href="/mina-ansokningar">
                Till mina ansökningar
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
        ) : inloggad ? (
          // Inloggad inbjuden → acceptera förfrågan med ett klick.
          <>
            <h1 className="mt-3 text-[22px] font-bold text-text">
              {inbjudan.företagNamn || 'Ett företag'} har bjudit in dig
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
              till {ärSchema ? 'schemat' : 'jobbet'} <strong>{inbjudan.titel}</strong> · via FastGig
            </p>
            {period && (
              <p className="mt-3 text-[14px] text-text-dämpad">
                Period: <strong className="text-text">{period}</strong>
              </p>
            )}
            {accFel && (
              <div className="mt-4">
                <Besked typ="fel">{accFel}</Besked>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <Knapp variant="primär" full laddar={accepterar} onClick={acceptera}>
                Acceptera förfrågan
              </Knapp>
              <Knapp variant="kontur" full disabled={accepterar} onClick={tackaNej}>
                Tacka nej
              </Knapp>
            </div>
          </>
        ) : (
          // Utloggad → registrera/logga in och kom tillbaka hit.
          <>
            <h1 className="mt-3 text-[22px] font-bold text-text">
              {inbjudan.företagNamn || 'Ett företag'} har bjudit in dig
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
              till {ärSchema ? 'schemat' : 'jobbet'} <strong>{inbjudan.titel}</strong> · via FastGig
            </p>
            {period && (
              <p className="mt-3 text-[14px] text-text-dämpad">
                Period: <strong className="text-text">{period}</strong>
              </p>
            )}
            <p className="mt-3 text-[14px] text-text-dämpad">
              Skapa ett konto eller logga in för att acceptera förfrågan.
            </p>
            <div className="mt-6 flex flex-col gap-3">
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
      </div>
    </main>
  );
}
