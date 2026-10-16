'use client';

// Skal för hela den inloggade företagsdelen. Gatar på auth + användartyp och renderar
// sedan sidomeny-layouten (AppSkal). Route-gruppen (app) påverkar inte URL:en – sidorna
// ligger på /oversikt, /annonser, /publicera/... osv.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppSkal from '@/components/app/AppSkal';

export default function FöretagsLayout({ children }) {
  const { laddar, inloggad, användare } = useAuth();
  const router = useRouter();

  // Inte inloggad → till inloggningen. Görs i en effekt (inte under render) så att
  // Next inte klagar på navigering mitt i renderingen.
  useEffect(() => {
    if (!laddar && !inloggad) router.replace('/logga-in');
  }, [laddar, inloggad, router]);

  if (laddar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakgrund">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  if (!inloggad) return null; // effekten ovan skickar vidare

  // Webbappen har i dag bara företagsvyer. En privatperson som loggar in på webben möts
  // av ett vänligt besked i stället för en halvbyggd vy – privatflödet finns i appen.
  if (användare?.typ !== 'företag') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakgrund px-5">
        <div className="max-w-md rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
          <h1 className="rubrik-m text-text">Webben är i dag för företag</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-text-dämpad">
            Som privatperson använder du FastGig-appen i mobilen för att söka jobb, chatta
            och se dina pass. Företagsverktygen finns här på webben.
          </p>
        </div>
      </div>
    );
  }

  return <AppSkal>{children}</AppSkal>;
}
