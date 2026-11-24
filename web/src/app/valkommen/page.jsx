'use client';

// Välkomst-/onboarding-sida på webben, visad efter e-postverifiering. Speglar appens
// onboarding (frontend/src/components/OnboardingGuide.js) med samma roll-specifika steg,
// men ritas som numrerade funktionsblock i webbens designspråk i stället för SVG-kort.
// Ligger UTANFÖR (app)-gruppen och har en egen auth-gate – samma mönster som /min-profil.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sida from '@/components/Sida';
import Knapp from '@/components/ui/Knapp';
import { useAuth } from '@/context/AuthContext';

// Privatpersonens resa: hitta → ansök → chatta → betyg. Texterna är identiska med appens
// PRIVATPERSON_KORT så app och webb berättar samma sak.
const PRIVAT_STEG = [
  {
    rubrik: 'Hitta jobb nära dig',
    text: 'Bläddra bland enstaka pass och längre uppdrag. Filtrera på stad, lön och kategori för att hitta rätt.',
  },
  {
    rubrik: 'Ansök med ett tryck',
    text: 'Skicka din ansökan direkt från annonsen och intyga att du uppfyller kraven.',
  },
  {
    rubrik: 'Chatta med företaget',
    text: 'Kom överens om detaljerna direkt i appen – både före och under passet.',
  },
  {
    rubrik: 'Få betyg och bygg rykte',
    text: 'Efter avslutat pass betygsätter ni varandra. Bra omdömen ger fler jobb.',
  },
];

// Företagets resa: publicera → få ansökningar → godkänn → avsluta & fakturera.
const FÖRETAG_STEG = [
  {
    rubrik: 'Publicera jobb på minuter',
    text: 'Skapa en annons med datum, tider, lön och OB. Lägg upp enstaka pass eller längre scheman.',
  },
  {
    rubrik: 'Hitta rätt personal',
    text: 'Få ansökningar från folk nära dig. Se profiler, betyg och tidigare erfarenhet innan du väljer.',
  },
  {
    rubrik: 'Godkänn och chatta',
    text: 'Godkänn ansökningar med ett tryck och kom överens om detaljerna direkt i chatten.',
  },
  {
    rubrik: 'Vi sköter allt',
    text: 'FastGig hanterar löner, avtal och administration – du fokuserar på jobbet.',
  },
];

export default function Välkommen() {
  const router = useRouter();
  const { laddar, inloggad, användare } = useAuth();

  // Gate: sidan kräver inloggning (nås normalt bara via verifierings-redirecten).
  useEffect(() => {
    if (laddar) return;
    if (!inloggad) router.replace('/logga-in');
  }, [laddar, inloggad, router]);

  if (laddar || !inloggad) return null;

  const ärFöretag = användare?.typ === 'företag';
  const steg = ärFöretag ? FÖRETAG_STEG : PRIVAT_STEG;
  const ingress = ärFöretag
    ? 'Så här kommer du igång med att bemanna dina pass och uppdrag.'
    : 'Så här kommer du igång med att hitta jobb och bygga ditt rykte.';
  const målLänk = ärFöretag ? '/publicera/jobb' : '/jobb';
  const knappText = ärFöretag ? 'Publicera ditt första pass' : 'Kom igång';

  return (
    <Sida titel="Välkommen till FastGig!" ingress={ingress}>
      <div className="space-y-5">
        {steg.map((s, i) => (
          <section
            key={s.rubrik}
            className="flex gap-4 rounded-xl border border-kant bg-bakgrund p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primär-mjuk text-[16px] font-bold text-primär">
              {i + 1}
            </span>
            <div>
              <h2 className="rubrik-m text-text">{s.rubrik}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-text-dämpad">
                {s.text}
              </p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10">
        <Knapp variant="primär" href={målLänk}>
          {knappText}
        </Knapp>
      </div>
    </Sida>
  );
}
