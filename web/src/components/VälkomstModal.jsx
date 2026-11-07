'use client';

// Välkomstruta som visas för privatpersoner direkt efter lyckad e-postverifiering –
// speglar appens välkomstmodal (frontend/src/navigation/index.js) och informerar om att
// ett anställningsavtal är på väg via mejl. Stängs bara via den tydliga knappen, så att
// användaren inte råkar klicka bort beskedet via backdropen.
import Knapp from '@/components/ui/Knapp';

export default function VälkomstModal({ öppen, onStäng }) {
  if (!öppen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-lg border border-kant bg-yta p-6 shadow-lyft">
        <h2 className="rubrik-m text-text">Välkommen till FastGig!</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-dämpad">
          Du kommer snart att få ett avtal skickat till din e-post. Godkänn det för att
          kunna ansöka på jobb.
        </p>

        <div className="mt-6">
          <Knapp variant="primär" full onClick={onStäng}>
            Okej, förstått!
          </Knapp>
        </div>
      </div>
    </div>
  );
}
