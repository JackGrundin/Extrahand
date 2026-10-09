// Delat skal för auth-sidorna: toppnav + centrerat kort med titel och underrubrik.
import Toppnav from '@/components/Toppnav';

export default function AuthSkal({ titel, underrubrik, children, bredd = 'max-w-md' }) {
  return (
    <>
      <Toppnav />
      <main className="flex min-h-[calc(100vh-61px)] items-start justify-center bg-bakgrund px-4 py-8 sm:px-5 sm:py-12">
        <div className={`w-full ${bredd}`}>
          <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk sm:p-7">
            <h1 className="rubrik-l mb-1 text-text">{titel}</h1>
            {underrubrik && (
              <p className="mb-6 text-[15px] text-text-dämpad">{underrubrik}</p>
            )}
            {children}
          </div>
        </div>
      </main>
    </>
  );
}
