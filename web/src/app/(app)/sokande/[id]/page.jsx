'use client';

// Sökandes profil för företag: öppnas när ett företag klickar en sökandes namn i
// ansökningslistan. Speglar appens SökandeProfilScreen (bild, namn, stad, ålder, jobbade
// timmar, CV/erfarenheter/kompetenser/intressen, dokument och betyg). Ligger i (app)-gruppen,
// så (app)/layout.jsx gatear redan åtkomsten till inloggade företag (utloggad → /logga-in,
// privatperson → /jobb, admin → /admin) och wrappar sidan i AppSkal – därför behövs inget
// eget skal eller egen auth-gate här. Datan kommer från den delade profil-endpointen
// (GET /users/:id/profil) + betyg (GET /betyg/anvandare/:id).
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Besked from '@/components/ui/Besked';
import BetygsSektion from '@/components/BetygsSektion';
import { api, felText } from '@/lib/api';

// En textsektion visas bara när fältet har innehåll – speglar appens Sektion-komponent.
function Sektion({ rubrik, innehåll }) {
  if (!innehåll) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[17px] font-bold text-text">{rubrik}</h2>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text-dämpad">{innehåll}</p>
    </section>
  );
}

export default function SökandeProfil() {
  const { id } = useParams();
  const router = useRouter();

  const [profil, setProfil] = useState(null);
  const [betyg, setBetyg] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');

  const hämta = useCallback(async () => {
    try {
      const data = await api.hämtaAnvändareProfil(id);
      setProfil(data);
      // Betyg i egen try/catch – ett betygsfel får inte sänka hela profilen.
      try {
        setBetyg(await api.hämtaBetyg(id));
      } catch {
        setBetyg(null);
      }
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    hämta();
  }, [hämta]);

  if (laddar) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="mx-auto max-w-2xl">
        <Besked typ="fel">{fel || 'Profilen hittades inte.'}</Besked>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-[14px] font-semibold text-text-dämpad hover:text-text"
        >
          ← Tillbaka
        </button>
      </div>
    );
  }

  const dokument = Array.isArray(profil.dokument) ? profil.dokument : [];

  return (
    <div className="mx-auto max-w-2xl">
      {/* Huvud: bild, namn, stad, ålder, jobbade timmar */}
      <div className="flex flex-col items-center rounded-xl border border-kant bg-yta p-7 text-center shadow-mjuk">
        {profil.profilBild ? (
          <Image
            src={profil.profilBild}
            alt={profil.namn ?? 'Sökande'}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primär text-[32px] font-bold text-white">
            {(profil.namn || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <h1 className="mt-4 text-[22px] font-bold text-text">{profil.namn}</h1>
        {profil.stad && <p className="mt-1 text-[14px] text-text-svag">{profil.stad}</p>}
        {profil.alder != null && (
          <p className="mt-0.5 text-[14px] text-text-svag">{profil.alder} år</p>
        )}
        {profil.totalTimmar > 0 && (
          <p className="mt-2 text-[13px] text-text-svag">{profil.totalTimmar} jobbade timmar</p>
        )}
      </div>

      {/* Fri text + kompetenser */}
      {!profil.cv && !profil.erfarenheter && !profil.kompetenser && !profil.intressen ? (
        <p className="mt-6 text-[15px] text-text-dämpad">Personen har inte fyllt i någon profiltext ännu.</p>
      ) : (
        <>
          <Sektion rubrik="CV / Om mig" innehåll={profil.cv} />
          <Sektion rubrik="Tidigare erfarenheter" innehåll={profil.erfarenheter} />
          <Sektion rubrik="Kompetenser" innehåll={profil.kompetenser} />
          <Sektion rubrik="Intressen" innehåll={profil.intressen} />
        </>
      )}

      {/* Dokument (read-only – företaget kan bara öppna, inte ändra) */}
      {dokument.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold text-text">Dokument</h2>
          <ul className="space-y-2">
            {dokument.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border border-kant bg-yta px-4 py-3 text-[15px] font-semibold text-primär transition hover:border-primär hover:underline"
                >
                  {d.namn}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Omdömen (BetygsSektion renderar egen rubrik) */}
      <div className="mt-6 rounded-xl border border-kant bg-yta p-6 shadow-mjuk">
        <BetygsSektion betyg={betyg} />
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[14px] font-semibold text-text-dämpad hover:text-text"
        >
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
