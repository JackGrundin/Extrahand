'use client';

// Skal för hela den inloggade företagsdelen. Gatar på auth + användartyp och renderar
// sedan sidomeny-layouten (AppSkal). Route-gruppen (app) påverkar inte URL:en – sidorna
// ligger på /oversikt, /annonser, /publicera/... osv.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RealtidsProvider } from '@/context/RealtidsContext';
import AppSkal from '@/components/app/AppSkal';

export default function FöretagsLayout({ children }) {
  const { laddar, inloggad, användare } = useAuth();
  const router = useRouter();

  // Inte inloggad → till inloggningen. Privatpersoner har sin egen webbapp och ska aldrig
  // fastna i företagsdelen → skicka dem till jobblistan. Görs i en effekt (inte under render)
  // så att Next inte klagar på navigering mitt i renderingen.
  // Admin-kontot är ett företagskonto men ska aldrig se företagsvyerna → till admin-delen.
  // Privatpersoner har sin egen webbapp → jobblistan. Görs i en effekt (inte under render)
  // så att Next inte klagar på navigering mitt i renderingen.
  useEffect(() => {
    if (laddar) return;
    if (!inloggad) router.replace('/logga-in');
    else if (användare?.email === 'info@fastgig.se') router.replace('/admin');
    else if (användare?.typ !== 'företag') router.replace('/jobb');
  }, [laddar, inloggad, användare, router]);

  if (laddar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakgrund">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  // Inte inloggad, admin eller privatperson som ska omdirigeras → effekten ovan skickar
  // vidare; rendera inget företagsinnehåll under tiden (undviker en blink av fel vy).
  if (!inloggad || användare?.email === 'info@fastgig.se' || användare?.typ !== 'företag') return null;

  return (
    <RealtidsProvider>
      <AppSkal>{children}</AppSkal>
    </RealtidsProvider>
  );
}
