import Sida from '@/components/Sida';
import Knapp from '@/components/ui/Knapp';

export const metadata = {
  title: 'Om oss – FastGig',
  description:
    'FastGig kopplar ihop företag och privatpersoner för kortare jobbpass och längre uppdrag – utan bemanningsavtal. Läs om varför vi byggde appen.',
};

export default function OmOss() {
  return (
    <Sida
      titel="Om oss"
      ingress="FastGig kopplar ihop företag och privatpersoner för kortare jobbpass och längre uppdrag – utan bemanningsavtal och utan uppstartsavgifter."
    >
      <div className="space-y-10">
        <section>
          <h2 className="rubrik-m text-text">Varför vi byggde FastGig</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            Vi startade FastGig för att bemanning kändes onödigt krångligt.
            Företag behövde folk till enstaka pass men fastnade i dyra avtal, och
            den som ville ta ett extrajobb hade svårt att hitta jobben. Så vi
            byggde en enkel app: lägg upp ett pass, chatta, kom överens och betala
            bara när någon faktiskt jobbar.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-text-dämpad">
            Idag används FastGig för allt från enstaka lunchpass till hela scheman
            för sommar- och säsongsarbete. Målet är detsamma som dag ett: göra det
            enkelt och tryggt för båda sidor.
          </p>
        </section>

        <section>
          <h2 className="rubrik-m text-text">Grundare</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            <span className="font-semibold text-text">Jack Grundin</span> –
            grundare. Bygger FastGig för att göra extrajobb och bemanning så
            enkelt som det borde vara.
          </p>
        </section>

        <section className="rounded-xl border border-kant bg-bakgrund p-7">
          <h2 className="rubrik-m text-text">Vill du komma igång?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
            Det är gratis att börja – samma konto funkar i både appen och på
            webben.
          </p>
          <div className="mt-5">
            <Knapp variant="primär" href="/registrera">
              Skapa konto gratis
            </Knapp>
          </div>
        </section>
      </div>
    </Sida>
  );
}
