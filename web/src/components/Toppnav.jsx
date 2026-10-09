'use client';

// Sticky toppnavigering för marknadsföringssidan och auth-sidorna. Visar logotyp och
// CTA-knappar. När användaren är inloggad byts CTA:erna mot ett utloggningsalternativ
// (webbappens vyer byggs i en senare fas).
import Link from 'next/link';
import Image from 'next/image';
import Knapp from '@/components/ui/Knapp';
import { useAuth } from '@/context/AuthContext';

export default function Toppnav() {
  const { inloggad, användare, loggaUt } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-kant bg-yta/90 backdrop-blur">
      <div className="mx-auto flex max-w-innehåll items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logotyp.png"
            alt="FastGig"
            width={132}
            height={34}
            priority
            style={{ height: 34, width: 'auto' }}
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {inloggad ? (
            <>
              <span className="hidden text-[14px] text-text-dämpad sm:inline">
                Inloggad som {användare?.namn}
              </span>
              <Knapp variant="kontur" onClick={loggaUt}>
                Logga ut
              </Knapp>
            </>
          ) : (
            <>
              <Knapp variant="kontur" href="/logga-in">
                Logga in
              </Knapp>
              <Knapp variant="primär" href="/registrera">
                Skapa konto
              </Knapp>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
