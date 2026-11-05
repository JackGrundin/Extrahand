'use client';

// Skal för hela admin-delen. Gatar på inloggning + att kontot är admin (info@fastgig.se)
// och renderar sedan sidomeny-layouten (AdminSkal). Ligger UTANFÖR (app)-gruppen, som
// gatear till vanliga företag – admin ska aldrig se företagsvyerna.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AdminSkal from '@/components/admin/AdminSkal';

const ADMIN_EMAIL = 'info@fastgig.se';

export default function AdminLayout({ children }) {
  const { laddar, inloggad, användare } = useAuth();
  const router = useRouter();

  // Inte inloggad → inloggningen. Inloggad men inte admin → startsidan. Görs i en effekt
  // (inte under render) så att Next inte klagar på navigering mitt i renderingen.
  useEffect(() => {
    if (laddar) return;
    if (!inloggad) router.replace('/logga-in');
    else if (användare?.email !== ADMIN_EMAIL) router.replace('/');
  }, [laddar, inloggad, användare, router]);

  if (laddar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakgrund">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  // Inte inloggad eller inte admin → effekten ovan skickar vidare; rendera inget under tiden.
  if (!inloggad || användare?.email !== ADMIN_EMAIL) return null;

  return <AdminSkal>{children}</AdminSkal>;
}
