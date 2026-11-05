'use client';

// Sidomenyns innehåll för admin-delen (info@fastgig.se). Speglar components/app/Sidomeny.jsx
// men med admin-länkarna och utan ansöknings-badgen. Återanvänds av både den fasta
// desktop-sidomenyn och mobilens drawer i AdminSkal.
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const LÄNKAR = [
  { namn: 'Dashboard', väg: '/admin' },
  { namn: 'Tidrapporter', väg: '/admin/tidrapporter' },
  { namn: 'Avtal', väg: '/admin/avtal' },
  { namn: 'Företag', väg: '/admin/foretag' },
  { namn: 'Privatpersoner', väg: '/admin/privatpersoner' },
  { namn: 'Fakturering', väg: '/admin/fakturering' },
  { namn: 'Raderade konton', väg: '/admin/raderade' },
];

export default function AdminSidomeny({ onNavigera }) {
  const { användare, loggaUt } = useAuth();
  const sökväg = usePathname();

  // Dashboard (/admin) ska bara vara aktiv på exakt den vägen – annars skulle den lysa
  // på alla undersidor eftersom de alla börjar med /admin.
  function ärAktiv(väg) {
    if (väg === '/admin') return sökväg === '/admin';
    return sökväg === väg || sökväg?.startsWith(`${väg}/`);
  }

  return (
    <div className="flex h-full flex-col">
      <Link href="/admin" onClick={onNavigera} className="flex items-center gap-2 px-5 py-4">
        <Image src="/logotyp.png" alt="FastGig" width={132} height={34} priority className="h-7 w-auto" />
        <span className="rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primär">
          Admin
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {LÄNKAR.map((l) => {
          const aktiv = ärAktiv(l.väg);
          return (
            <Link
              key={l.väg}
              href={l.väg}
              onClick={onNavigera}
              className={`flex items-center justify-between rounded-sm px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                aktiv ? 'bg-primär-mjuk text-primär' : 'text-text-dämpad hover:bg-yta-dämpad hover:text-text'
              }`}
            >
              <span>{l.namn}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-kant p-3">
        <div className="flex items-center gap-2.5 rounded-sm px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[13px] font-bold text-white">
            {(användare?.namn || 'A').charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-[14px] font-semibold text-text">{användare?.namn || 'Admin'}</span>
        </div>
        <button
          type="button"
          onClick={loggaUt}
          className="mt-1 w-full rounded-sm px-3 py-2.5 text-left text-[15px] font-semibold text-text-dämpad transition-colors hover:bg-yta-dämpad hover:text-fel"
        >
          Logga ut
        </button>
      </div>
    </div>
  );
}
