'use client';

// Sidomenyns innehåll (logotyp, navlänkar, utloggning). Återanvänds av både den fasta
// desktop-sidomenyn och mobilens drawer i AppSkal. Badgen på "Mina annonser" speglar
// appens flik-badge: summan av nya ansökningar och pass som behöver avslutas.
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const LÄNKAR = [
  { namn: 'Översikt', väg: '/oversikt' },
  { namn: 'Mina annonser', väg: '/annonser', badgeNyckel: 'annonser' },
  { namn: 'Schemaöversikt', väg: '/kalender' },
  { namn: 'Meddelanden', väg: '/meddelanden' },
  { namn: 'Publicera pass', väg: '/publicera/jobb' },
  { namn: 'Publicera schema', väg: '/publicera/schema' },
];

export default function Sidomeny({ badges = {}, onNavigera }) {
  const { användare, loggaUt } = useAuth();
  const sökväg = usePathname();

  function ärAktiv(väg) {
    return sökväg === väg || sökväg?.startsWith(`${väg}/`);
  }

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/oversikt"
        onClick={onNavigera}
        className="flex items-center gap-2 px-5 py-4"
      >
        <Image src="/logotyp.png" alt="FastGig" width={132} height={34} priority className="h-7 w-auto" />
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {LÄNKAR.map((l) => {
          const antal = l.badgeNyckel ? badges[l.badgeNyckel] : 0;
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
              {antal > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primär px-1.5 text-[12px] font-bold text-white">
                  {antal}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-kant p-3">
        {/* Företagsnamnet länkar till profilen (skapa/redigera). */}
        <Link
          href="/profil"
          onClick={onNavigera}
          className={`flex items-center gap-2.5 rounded-sm px-3 py-2.5 transition-colors ${
            ärAktiv('/profil') ? 'bg-primär-mjuk' : 'hover:bg-yta-dämpad'
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
          <span className={`truncate text-[14px] font-semibold ${ärAktiv('/profil') ? 'text-primär' : 'text-text'}`}>
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
