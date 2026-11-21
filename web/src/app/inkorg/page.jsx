'use client';

// /inkorg – åtgärdslistan, delad av både företag och privatperson. Ligger UTANFÖR (app)-
// gruppen eftersom den serverar båda användartyperna på samma URL; skalet väljs här efter
// typ (företag → AppSkal, privatperson → PrivatSkal). Gatar på inloggning och skickar
// admin till admin-delen, precis som (app)/layout gör för företagsvyerna.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppSkal from '@/components/app/AppSkal';
import PrivatSkal from '@/components/privat/PrivatSkal';
import InkorgsSida from '@/components/InkorgsSida';

export default function InkorgPage() {
  const { laddar, inloggad, användare } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (laddar) return;
    if (!inloggad) router.replace('/logga-in');
    else if (användare?.email === 'info@fastgig.se') router.replace('/admin');
  }, [laddar, inloggad, användare, router]);

  if (laddar || !inloggad || användare?.email === 'info@fastgig.se') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakgrund">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  if (användare?.typ === 'företag') {
    return (
      <AppSkal>
        <InkorgsSida />
      </AppSkal>
    );
  }

  return (
    <PrivatSkal>
      <InkorgsSida />
    </PrivatSkal>
  );
}
