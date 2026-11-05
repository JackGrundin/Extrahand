'use client';

// Dashboard-skal för admin-delen: fast sidomeny på desktop, hopfällbar drawer på mobil.
// Speglar components/app/AppSkal.jsx men utan badge-hämtningen – admin har inga
// ansöknings-badgar. Sidorna hämtar sin egen data.
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidomeny from '@/components/admin/AdminSidomeny';

export default function AdminSkal({ children }) {
  const [menyÖppen, setMenyÖppen] = useState(false);
  const sökväg = usePathname();

  // Stäng mobildrawern vid sidbyte.
  useEffect(() => {
    setMenyÖppen(false);
  }, [sökväg]);

  return (
    <div className="min-h-screen bg-bakgrund">
      {/* Fast sidomeny – desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-kant bg-yta md:block">
        <AdminSidomeny />
      </aside>

      {/* Mobil topprad */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-kant bg-yta/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-bold text-text">FastGig Admin</span>
        <button
          type="button"
          onClick={() => setMenyÖppen(true)}
          aria-label="Öppna meny"
          className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-sm border border-kant"
        >
          <span className="h-[2px] w-4 bg-text" />
          <span className="h-[2px] w-4 bg-text" />
          <span className="h-[2px] w-4 bg-text" />
        </button>
      </header>

      {/* Mobil drawer */}
      {menyÖppen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMenyÖppen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-yta shadow-lyft">
            <AdminSidomeny onNavigera={() => setMenyÖppen(false)} />
          </div>
        </div>
      )}

      {/* Innehåll */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
