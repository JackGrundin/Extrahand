'use client';

// Statusbanner som visas för privatpersoner vars avtal ännu inte är godkänt.
// Kräver inloggad användare av typen 'privatperson' med avtalGodkant === false.
// Visas överst på /jobb och /jobb/[id] – försvinner automatiskt när avtalet godkänts
// och användaren laddar om sidan.
import { useAuth } from '@/context/AuthContext';

export default function AvtalBanner() {
  const { användare } = useAuth();

  // Visa bara för privatpersoner vars avtal INTE är godkänt
  if (!användare || användare.typ !== 'privatperson' || användare.avtalGodkant !== false) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-varning/40 bg-varning/10 px-5 py-4">
      <div className="flex items-start gap-3">
        {/* Klocka-ikon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-varning"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div>
          <p className="text-[15px] font-semibold text-text">Ditt konto granskas</p>
          <p className="mt-0.5 text-[14px] text-text-dämpad">
            Vi går igenom ditt avtal just nu. Så snart det är godkänt får du en notis och
            kan börja söka jobb.
          </p>
        </div>
      </div>
    </div>
  );
}
