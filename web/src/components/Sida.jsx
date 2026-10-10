// Lätt innehållsskal för statiska sidor (Om oss, Kontakt m.fl.): toppnav + centrerad
// vit yta med titel/ingress, sedan innehåll, och sidfot. Matchar startsidans rena stil.
import Toppnav from '@/components/Toppnav';
import Sidfot from '@/components/Sidfot';

export default function Sida({ titel, ingress, children }) {
  return (
    <>
      <Toppnav />
      <main className="min-h-[calc(100vh-61px)] bg-yta">
        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
          <h1 className="rubrik-xl text-text">{titel}</h1>
          {ingress && (
            <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-text-dämpad">
              {ingress}
            </p>
          )}
          <div className="mt-12">{children}</div>
        </section>
      </main>
      <Sidfot />
    </>
  );
}
