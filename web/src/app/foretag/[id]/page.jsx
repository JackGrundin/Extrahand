'use client';

// Publik företagsprofil på webben: en privatperson som tittar på ett pass kan klicka
// företagets namn och landa här. Speglar appens FöretagsProfilScreen (logga, namn,
// bransch/stad, hemsida, beskrivning, betyg och aktiva annonser). Ligger UTANFÖR
// (app)-gruppen (som gatear till företag) och har en egen auth-gate – samma mönster som
// min-profil/page.jsx. Profil-endpointen (GET /users/:id/profil) kräver inloggning och
// delas med privatpersoners profiler, så sidan kräver inloggning.
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Besked from '@/components/ui/Besked';
import BetygsSektion from '@/components/BetygsSektion';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';

export default function FöretagsProfil() {
  const { id } = useParams();
  const router = useRouter();
  const { laddar: authLaddar, inloggad } = useAuth();

  const [profil, setProfil] = useState(null);
  const [betyg, setBetyg] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');

  // Auth-gate: utloggad → inloggning med next tillbaka hit (profil-endpointen kräver JWT).
  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent(`/foretag/${id}`)}`);
    }
  }, [authLaddar, inloggad, id, router]);

  const hämta = useCallback(async () => {
    try {
      const data = await api.hämtaAnvändareProfil(id);
      setProfil(data);
      // Betyg i egen try/catch – får inte sänka hela sidan.
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
    if (!authLaddar && inloggad) hämta();
  }, [authLaddar, inloggad, hämta]);

  // Medan auth kontrolleras / vi omdirigerar bort en utloggad: visa bara spinnern.
  if (authLaddar || !inloggad || laddar) {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  if (!profil) {
    return (
      <PrivatSkal>
        <div className="mx-auto max-w-2xl">
          <Besked typ="fel">{fel || 'Företaget hittades inte.'}</Besked>
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

  // Hemsidan kan sakna protokoll – prefixa https:// så länken fungerar (som appens öppnaHemsida).
  const hemsidaUrl = profil.hemsida
    ? profil.hemsida.startsWith('http')
      ? profil.hemsida
      : `https://${profil.hemsida}`
    : null;

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-2xl">
        {/* Huvud: logga, namn, bransch/stad, hemsida */}
        <div className="flex flex-col items-center rounded-xl border border-kant bg-yta p-7 text-center shadow-mjuk">
          {profil.profilBild ? (
            <Image
              src={profil.profilBild}
              alt={profil.namn ?? 'Företag'}
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
          {profil.bransch && (
            <p className="mt-1 text-[15px] text-text-dämpad">{profil.bransch}</p>
          )}
          {profil.stad && <p className="mt-0.5 text-[14px] text-text-svag">{profil.stad}</p>}
          {profil.alder != null && (
            <p className="mt-0.5 text-[14px] text-text-svag">{profil.alder} år</p>
          )}
          {hemsidaUrl && (
            <a
              href={hemsidaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-[14px] font-semibold text-primär hover:underline"
            >
              {profil.hemsida}
            </a>
          )}
          {profil.totalTimmar > 0 && (
            <p className="mt-2 text-[13px] text-text-svag">{profil.totalTimmar} timmar genomförda</p>
          )}
        </div>

        {/* Om företaget */}
        {profil.beskrivning && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold text-text">Om företaget</h2>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text-dämpad">
              {profil.beskrivning}
            </p>
          </section>
        )}

        {/* Omdömen (BetygsSektion renderar egen rubrik) */}
        <div className="mt-6 rounded-xl border border-kant bg-yta p-6 shadow-mjuk">
          <BetygsSektion betyg={betyg} />
        </div>

        {/* Aktiva annonser */}
        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold text-text">Aktiva annonser</h2>
          {profil.aktivaJobb?.length > 0 ? (
            <ul className="space-y-2">
              {profil.aktivaJobb.map((jobb) => (
                <li key={jobb.id}>
                  <Link
                    href={`/jobb/${jobb.id}`}
                    className="block rounded-md border border-kant bg-yta px-4 py-3 transition hover:border-primär"
                  >
                    <p className="text-[15px] font-semibold text-text">{jobb.Titel}</p>
                    <p className="mt-0.5 text-[13px] text-text-dämpad">
                      {[jobb.Plats, jobb.Typ].filter(Boolean).join(' · ')}
                    </p>
                    {jobb.Lon != null && (
                      <p className="mt-0.5 text-[13px] font-semibold text-text-dämpad">
                        {Math.round(Number(jobb.Lon))} kr/tim
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-text-dämpad">Inga aktiva annonser just nu.</p>
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
