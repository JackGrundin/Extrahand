'use client';

// Landningssida för en inbjudningslänk (jobb ELLER schema). Ligger UTANFÖR (app)-gruppen
// så att privatpersoner (inte bara företag) når den. Löser in token via backend:
//   - Inloggad → koppla kontot till inbjudan (sätter ev. rabatterat påslag) och vidare till
//     jobb-/schemavyn där man kan ansöka.
//   - Utloggad → en kort förhandsvisning + "Skapa konto och ansök"/"Logga in" (bär med
//     ?next= tillbaka hit, så personen landar på annonsen efter inloggning/registrering).
// Token sparas i sessionStorage så att den överlever registrerings-/verifieringsstegen.
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

const TOKEN_NYCKEL = 'fastgig.inbjudan.token';

export default function Inbjudan() {
  const { token } = useParams();
  const router = useRouter();
  const { laddar, inloggad } = useAuth();

  const [inbjudan, setInbjudan] = useState(null);
  const [fel, setFel] = useState('');
  const kopplar = useRef(false);

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

  // Inloggad + inbjudan uppslagen → koppla kontot och gå vidare till annonsen.
  useEffect(() => {
    if (laddar || !inloggad || !inbjudan || kopplar.current) return;
    const mål = inbjudan.jobbId ? `/jobb/${inbjudan.jobbId}` : inbjudan.schemaId ? `/schema/${inbjudan.schemaId}` : null;
    if (!mål) return;
    kopplar.current = true;
    (async () => {
      // Koppla kontot (idempotent, sätter rabatt om kontot registrerades via länken).
      // Fel här ska inte stoppa vidarenavigeringen – annonsen går ändå att ansöka på.
      try {
        await api.kopplaInbjudan(token);
      } catch {
        /* svälj – koppling är bäst-ansträngning */
      }
      try {
        window.sessionStorage.removeItem(TOKEN_NYCKEL);
      } catch {
        /* ignorera */
      }
      router.replace(mål);
    })();
  }, [laddar, inloggad, inbjudan, token, router]);

  const nästa = `/inbjudan/${token}`;
  const ärSchema = Boolean(inbjudan?.schemaId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bakgrund px-5">
      <div className="w-full max-w-md rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
        <h1 className="text-[24px] font-bold text-primär">FastGig</h1>

        {fel ? (
          <div className="mt-4">
            <Besked typ="fel">{fel}</Besked>
            <p className="mt-2 text-[14px] text-text-dämpad">Länken kan vara felaktig eller ha tagits bort.</p>
          </div>
        ) : !inbjudan ? (
          <div className="mt-8 flex justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
          </div>
        ) : inloggad ? (
          // Omdirigeras av effekten ovan.
          <div className="mt-8 flex justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
          </div>
        ) : (
          <>
            <p className="mt-4 text-[16px] leading-relaxed text-text">
              {inbjudan.företagNamn ? <strong>{inbjudan.företagNamn}</strong> : 'Ett företag'} har bjudit in dig
              till {ärSchema ? 'schemat' : 'jobbet'} <strong>{inbjudan.titel}</strong>.
            </p>
            <p className="mt-2 text-[14px] text-text-dämpad">
              Skapa ett konto eller logga in för att se {ärSchema ? 'schemat' : 'jobbet'} och ansöka.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Knapp variant="primär" full href={`/registrera?next=${encodeURIComponent(nästa)}`}>
                Skapa konto och ansök
              </Knapp>
              <Knapp variant="kontur" full href={`/logga-in?next=${encodeURIComponent(nästa)}`}>
                Logga in
              </Knapp>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
