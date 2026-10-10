'use client';

// Sticky toppnavigering för hela webben. Logotyp, navflikar (Hem/Om oss/Kontakt) och
// CTA-knappar. Navflikarna visas inline på desktop och via en enkel menytoggle på mobil.
// När användaren är inloggad byts CTA:erna mot ett utloggningsalternativ.
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Knapp from '@/components/ui/Knapp';
import { useAuth } from '@/context/AuthContext';

const FLIKAR = [
  { namn: 'Hem', väg: '/' },
  { namn: 'Om oss', väg: '/om-oss' },
  { namn: 'Kontakt', väg: '/kontakt' },
];

export default function Toppnav() {
  const { inloggad, användare, loggaUt } = useAuth();
  const sökväg = usePathname();
  const [menyÖppen, setMenyÖppen] = useState(false);

  function ärAktiv(väg) {
    return väg === '/' ? sökväg === '/' : sökväg?.startsWith(väg);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-kant bg-yta/90 backdrop-blur">
      <div className="mx-auto flex max-w-innehåll items-center justify-between px-5 py-3">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setMenyÖppen(false)}
        >
          <Image
            src="/logotyp.png"
            alt="FastGig"
            width={132}
            height={34}
            priority
            className="h-7 w-auto sm:h-[34px]"
          />
        </Link>

        {/* Navflikar – inline på desktop */}
        <nav className="hidden items-center gap-7 md:flex">
          {FLIKAR.map((f) => (
            <Link
              key={f.väg}
              href={f.väg}
              className={`text-[15px] font-semibold transition-colors ${
                ärAktiv(f.väg)
                  ? 'text-primär'
                  : 'text-text-dämpad hover:text-text'
              }`}
            >
              {f.namn}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {inloggad ? (
            <>
              <span className="hidden text-[14px] text-text-dämpad sm:inline">
                Inloggad som {användare?.namn}
              </span>
              <Knapp variant="kontur" storlek="liten" onClick={loggaUt}>
                Logga ut
              </Knapp>
            </>
          ) : (
            <>
              <Knapp
                variant="kontur"
                storlek="liten"
                href="/logga-in"
                className="hidden md:inline-flex"
              >
                Logga in
              </Knapp>
              <Knapp variant="primär" storlek="liten" href="/registrera">
                Skapa konto
              </Knapp>
            </>
          )}

          {/* Menytoggle – bara på mobil (tre streck ritade i CSS, inget ikonbibliotek) */}
          <button
            type="button"
            onClick={() => setMenyÖppen((v) => !v)}
            aria-label={menyÖppen ? 'Stäng meny' : 'Öppna meny'}
            aria-expanded={menyÖppen}
            className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-sm border border-kant md:hidden"
          >
            <span
              className={`h-[2px] w-4 bg-text transition-transform ${
                menyÖppen ? 'translate-y-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`h-[2px] w-4 bg-text transition-opacity ${
                menyÖppen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`h-[2px] w-4 bg-text transition-transform ${
                menyÖppen ? '-translate-y-[7px] -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobilpanel */}
      {menyÖppen && (
        <div className="border-t border-kant bg-yta md:hidden">
          <nav className="mx-auto flex max-w-innehåll flex-col px-5 py-2">
            {FLIKAR.map((f) => (
              <Link
                key={f.väg}
                href={f.väg}
                onClick={() => setMenyÖppen(false)}
                className={`py-2.5 text-[15px] font-semibold ${
                  ärAktiv(f.väg) ? 'text-primär' : 'text-text'
                }`}
              >
                {f.namn}
              </Link>
            ))}
            {!inloggad && (
              <Link
                href="/logga-in"
                onClick={() => setMenyÖppen(false)}
                className="border-t border-kant py-2.5 text-[15px] font-semibold text-text"
              >
                Logga in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
