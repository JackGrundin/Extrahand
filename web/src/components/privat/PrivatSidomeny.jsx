'use client';

// Sidomenyns innehåll för privatpersoner (logotyp, navlänkar, profil + utloggning).
// Speglar företagets Sidomeny men med privatpersonens egna menyval. Återanvänds av både
// den fasta desktop-sidomenyn och mobilens drawer i PrivatSkal.
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const LÄNKAR = [
  { namn: 'Hitta jobb', väg: '/jobb' },
  { namn: 'Mina ansökningar', väg: '/mina-ansokningar' },
  { namn: 'Mina pass', väg: '/mina-pass' },
  { namn: 'Meddelanden', väg: '/chatt' },
  { namn: 'Min profil', väg: '/min-profil' },
];

export default function PrivatSidomeny({ onNavigera, olästa = 0 }) {
  const { användare, loggaUt } = useAuth();
  const sökväg = usePathname();

  function ärAktiv(väg) {
    return sökväg === väg || sökväg?.startsWith(`${väg}/`);
  }

  return (
    <div className="flex h-full flex-col">
      <Link href="/jobb" onClick={onNavigera} className="flex items-center gap-2 px-5 py-4">
        <Image src="/logotyp.png" alt="FastGig" width={132} height={34} priority className="h-7 w-auto" />
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {LÄNKAR.map((l) => {
          const aktiv = ärAktiv(l.väg);
          // Oläst-badge bara på Meddelanden (→ /chatt), antal från föräldern.
          const badge = l.väg === '/chatt' ? olästa : 0;
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
              {badge > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-fel px-1.5 text-[12px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-kant p-3">
        {/* Namnet länkar till profilen. */}
        <Link
          href="/min-profil"
          onClick={onNavigera}
          className={`flex items-center gap-2.5 rounded-sm px-3 py-2.5 transition-colors ${
            ärAktiv('/min-profil') ? 'bg-primär-mjuk' : 'hover:bg-yta-dämpad'
          }`}
        >
          {användare?.profilBild ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={användare.profilBild} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primär text-[13px] font-bold text-white">
              {(användare?.namn || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className={`truncate text-[14px] font-semibold ${ärAktiv('/min-profil') ? 'text-primär' : 'text-text'}`}>
            {användare?.namn}
          </span>
        </Link>
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
