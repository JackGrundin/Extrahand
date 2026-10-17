'use client';

// Registrering är STÄNGD före lansering – nya konton kan inte skapas via webben just nu.
// Sidan omdirigerar till inloggningen. Formuläret finns kvar i git-historiken och återställs
// när registreringen öppnas igen (git revert av commiten som stängde den).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Registrera() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/logga-in');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bakgrund px-5">
      <p className="text-[15px] text-text-dämpad">Omdirigerar…</p>
    </main>
  );
}
