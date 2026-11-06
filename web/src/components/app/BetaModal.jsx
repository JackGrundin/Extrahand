'use client';

// Välkomstmodal för tidiga användare under beta. Visas EN gång för en inloggad
// användare (ej admin) via en localStorage-stämpel. Monterad i root-layouten inuti
// AuthProvider, så den kan dyka upp oavsett vilken sida man landar på. Speglar
// modal-patternen i components/app/PlanvalModal.jsx.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Knapp from '@/components/ui/Knapp';

const STÄMPEL_NYCKEL = 'fastgig.beta.välkommen';

export default function BetaModal() {
  const { laddar, inloggad, användare } = useAuth();
  const pathname = usePathname();
  const [visa, setVisa] = useState(false);

  // Avgör om modalen ska visas – bara i webbläsaren, bara för inloggade icke-admin
  // som inte redan bekräftat. Körs när sessionen återställts (laddar börjar true).
  // Inbjudningssidan (/inbjudan/[token]) är en avsiktlig ingång för privatpersoner –
  // beta-modalen ska aldrig lägga sig över den.
  useEffect(() => {
    if (laddar || !inloggad) return;
    if (pathname?.startsWith('/inbjudan')) return;
    if (användare?.email === 'info@fastgig.se') return;
    if (localStorage.getItem(STÄMPEL_NYCKEL)) return;
    setVisa(true);
  }, [laddar, inloggad, användare, pathname]);

  function bekräfta() {
    localStorage.setItem(STÄMPEL_NYCKEL, '1');
    setVisa(false);
  }

  if (!visa || pathname?.startsWith('/inbjudan')) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-lg border border-kant bg-yta p-6 shadow-lyft">
        <h2 className="rubrik-m text-text">Hej, roligt att du hittat hit! 👋</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-dämpad">
          Appen är under utveckling just nu, men vi lanserar inom snar framtid.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-text-dämpad">MVH FastGig</p>

        <div className="mt-6">
          <Knapp variant="primär" full onClick={bekräfta}>
            Okej, spännande!
          </Knapp>
        </div>
      </div>
    </div>
  );
}
