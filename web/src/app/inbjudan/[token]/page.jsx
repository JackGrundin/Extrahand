'use client';

// Landningssida för en schema-inbjudningslänk (från mejlet). Ligger UTANFÖR (app)-gruppen
// så att privatpersoner (inte bara företag) når den. Löser in token via backend:
//   - Inloggad → vidare till schemavyn (/schema/<id>) där man kan ansöka.
//   - Utloggad → en kort förhandsvisning + "Logga in" (bär med ?next= tillbaka hit, så
//     personen landar på schemat efter inloggning). Registrering är stängd före lansering.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

export default function Inbjudan() {
  const { token } = useParams();
  const router = useRouter();
  const { laddar, inloggad } = useAuth();

  const [inbjudan, setInbjudan] = useState(null);
  const [fel, setFel] = useState('');

  useEffect(() => {
    let avbruten = false;
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

  // Inloggad + inbjudan uppslagen → direkt till schemat.
  useEffect(() => {
    if (!laddar && inloggad && inbjudan?.schemaId) {
      router.replace(`/schema/${inbjudan.schemaId}`);
    }
  }, [laddar, inloggad, inbjudan, router]);

  const nästa = `/inbjudan/${token}`;

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
              till schemat <strong>{inbjudan.titel}</strong>.
            </p>
            <p className="mt-2 text-[14px] text-text-dämpad">
              Logga in för att se schemat och ansöka.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Knapp variant="primär" full href={`/logga-in?next=${encodeURIComponent(nästa)}`}>
                Logga in
              </Knapp>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
