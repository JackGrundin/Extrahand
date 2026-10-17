'use client';

// Planvals-popup som visas när backend svarar 409 KRAVER_PLANVAL (gratiskonto som
// publicerar sitt tredje pass denna månad). Två vägar: fortsätt utan abonnemang (skickar om
// med acceptera_hogre_paslag) eller uppgradera till Pro via Stripe.
import Knapp from '@/components/ui/Knapp';
import { PRO_PRIS_KR } from '@/utils/konstanter';

export default function PlanvalModal({ onFortsätt, onUppgradera, onStäng, laddarFortsätt, laddarUppgradera }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onStäng} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-lg border border-kant bg-yta p-6 shadow-lyft">
        <h2 className="rubrik-m text-text">Ni har använt månadens gratispass</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-dämpad">
          Vill ni publicera fler pass den här månaden? Uppgradera till Pro, eller fortsätt
          utan abonnemang.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Knapp variant="primär" full laddar={laddarUppgradera} onClick={onUppgradera}>
            Uppgradera till Pro – {PRO_PRIS_KR} kr/mån
          </Knapp>
          <Knapp variant="kontur" full laddar={laddarFortsätt} onClick={onFortsätt}>
            Fortsätt utan abonnemang
          </Knapp>
          <button
            type="button"
            onClick={onStäng}
            className="py-1 text-[14px] font-semibold text-text-svag hover:text-text"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}
