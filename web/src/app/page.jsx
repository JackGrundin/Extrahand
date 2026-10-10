import Toppnav from '@/components/Toppnav';
import Sidfot from '@/components/Sidfot';
import Knapp from '@/components/ui/Knapp';
import TelefonMockup from '@/components/TelefonMockup';

// Prissiffror speglar frontend/src/utils/konstanter.js (PRO_PRIS_KR 299, påslag 0.20/0.40).
const PRO_PRIS = 299;

const FÖRETAG_STEG = [
  {
    titel: 'Lägg upp ett pass eller ett helt schema',
    text: 'Enstaka pass eller längre scheman för sommar och säsong. Du sätter datum, tider, timlön och eventuellt OB.',
  },
  {
    titel: 'Välj vem du vill ha',
    text: 'Prata med dem som sökt direkt i chatten och godkänn den som känns rätt.',
  },
  {
    titel: 'Tidrapport och faktura sköter sig själva',
    text: 'När passet är slut skapas tidrapporten automatiskt. Du får en samlad faktura, utan pappersarbete.',
  },
];

const PRIVAT_STEG = [
  {
    titel: 'Hitta jobb nära dig',
    text: 'Sök bland lediga pass och längre uppdrag i din stad och ansök med ett tryck.',
  },
  {
    titel: 'Prata med företaget först',
    text: 'Har du frågor? Chatta med företaget innan du bestämmer dig.',
  },
  {
    titel: 'Samla på bra betyg',
    text: 'Efter varje pass sätter ni betyg på varandra. Bra omdömen gör det lättare att få nästa jobb.',
  },
];

// Minimal, tunn check för prislistorna (ren linje, inte en "generisk ikon").
function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0 text-primär"
    >
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SektionsIntro({ överlinje, titel, text }) {
  return (
    <div className="mx-auto mb-16 max-w-2xl text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-primär">
        {överlinje}
      </p>
      <h2 className="rubrik-l mt-3 text-text">{titel}</h2>
      {text && (
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-text-dämpad">
          {text}
        </p>
      )}
    </div>
  );
}

// Funktionsblock utan ikon – en diskret numrerad etikett, rubrik och text, med en
// tunn topphårlinje (Linear-stil).
function Funktion({ nr, titel, text }) {
  return (
    <div className="border-t border-kant pt-5">
      <span className="text-[13px] font-semibold tabular-nums text-primär">
        {nr}
      </span>
      <h3 className="rubrik-m mt-2 text-text">{titel}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">{text}</p>
    </div>
  );
}

function PunktRad({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] text-text">
      <Check />
      <span>{children}</span>
    </li>
  );
}

export default function Marknadsforing() {
  return (
    <>
      <Toppnav />

      <main>
        {/* ── Hero (vit, luftig) ─────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-yta">
          {/* Mycket subtil ljus wash högst upp. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-[#f5f7ff] to-transparent"
          />
          <div className="relative mx-auto max-w-innehåll px-5 py-20 sm:py-24 lg:py-32">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <div className="text-center lg:text-left">
                <p className="anim-fade-up text-[13px] font-semibold uppercase tracking-wider text-primär">
                  Jobb och bemanning
                </p>
                <h1 className="anim-fade-up d-1 rubrik-hero mt-4 text-text">
                  Få hjälp med passet, eller hitta ditt nästa jobb
                </h1>
                <p className="anim-fade-up d-2 mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-text-dämpad lg:mx-0">
                  FastGig är en enkel app där företag lägger upp jobbpass och
                  privatpersoner söker dem. Ni chattar, kommer överens och sätter
                  betyg efteråt. Inga bemanningsavtal och ingen uppstartsavgift.
                </p>
                <div className="anim-fade-up d-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                  <Knapp variant="primär" href="/registrera">
                    Skapa konto gratis
                  </Knapp>
                  <Knapp variant="kontur" href="/logga-in">
                    Logga in
                  </Knapp>
                </div>
                <p className="anim-fade-up d-4 mt-6 text-[14px] text-text-svag">
                  Gratis att börja · Ingen bindningstid · Igång på några minuter
                </p>
              </div>

              <div className="anim-fade-up d-2 flex justify-center lg:justify-end">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 -z-0 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bakgrund"
                  />
                  <div className="relative">
                    <TelefonMockup />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── För företag ────────────────────────────────────────────── */}
        <section className="border-t border-kant bg-yta">
          <div className="mx-auto max-w-innehåll px-5 py-24">
            <SektionsIntro
              överlinje="För företag"
              titel="Extrapersonal utan dyra avtal"
              text="Lägg upp passet, välj bland dem som söker och betala bara när någon faktiskt jobbar. Du binder dig inte för något."
            />
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
              {FÖRETAG_STEG.map((s, i) => (
                <Funktion key={s.titel} nr={`0${i + 1}`} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* ── För privatpersoner ─────────────────────────────────────── */}
        <section className="border-y border-kant bg-bakgrund">
          <div className="mx-auto max-w-innehåll px-5 py-24">
            <SektionsIntro
              överlinje="För privatpersoner"
              titel="Jobba när det passar dig"
              text="Hitta extrajobb i din stad, sök på en minut och ha koll på allt i appen. Du bestämmer själv vad du tackar ja till."
            />
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
              {PRIVAT_STEG.map((s, i) => (
                <Funktion key={s.titel} nr={`0${i + 1}`} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Priser ─────────────────────────────────────────────────── */}
        <section className="bg-yta">
          <div className="mx-auto max-w-innehåll px-5 py-24">
            <SektionsIntro
              överlinje="Priser för företag"
              titel="Enkla priser, inga överraskningar"
              text="Privatpersoner betalar aldrig något. För företag är det gratis att börja – uppgradera bara om du bemannar ofta."
            />

            <div className="mx-auto grid max-w-3xl items-stretch gap-6 sm:grid-cols-2">
              {/* Gratis */}
              <div className="flex flex-col rounded-xl border border-kant bg-yta p-8 shadow-mjuk">
                <h3 className="rubrik-m text-text">Gratis</h3>
                <p className="mt-1 text-[14px] text-text-dämpad">
                  Bra för att testa
                </p>
                <div className="my-6">
                  <span className="text-[44px] font-bold tracking-tight text-text">
                    0 kr
                  </span>
                  <span className="text-[15px] text-text-dämpad"> /mån</span>
                </div>
                <ul className="flex flex-1 flex-col gap-3">
                  <PunktRad>2 pass i månaden med lågt påslag</PunktRad>
                  <PunktRad>Lägg upp hur många annonser du vill</PunktRad>
                  <PunktRad>Chatt, tidrapporter och betyg ingår</PunktRad>
                  <PunktRad>Något högre påslag från tredje passet</PunktRad>
                </ul>
                <Knapp variant="kontur" href="/registrera" full className="mt-8">
                  Skapa konto
                </Knapp>
              </div>

              {/* Pro */}
              <div className="flex flex-col rounded-xl border border-primär bg-yta p-8 shadow-lyft">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-primär">
                  Populärast
                </p>
                <h3 className="rubrik-m mt-1 text-text">Pro</h3>
                <p className="mt-1 text-[14px] text-text-dämpad">
                  För dig som bemannar ofta
                </p>
                <div className="my-6">
                  <span className="text-[44px] font-bold tracking-tight text-text">
                    {PRO_PRIS} kr
                  </span>
                  <span className="text-[15px] text-text-dämpad"> /mån</span>
                </div>
                <ul className="flex flex-1 flex-col gap-3">
                  <PunktRad>Lågt påslag på alla pass</PunktRad>
                  <PunktRad>Obegränsat med pass och annonser</PunktRad>
                  <PunktRad>Chatt, tidrapporter och betyg ingår</PunktRad>
                  <PunktRad>Säg upp när du vill</PunktRad>
                </ul>
                <Knapp variant="primär" href="/registrera" full className="mt-8">
                  Kom igång med Pro
                </Knapp>
              </div>
            </div>
          </div>
        </section>

        {/* ── Avslutande CTA ─────────────────────────────────────────── */}
        <section className="border-t border-kant bg-bakgrund">
          <div className="mx-auto max-w-innehåll px-5 py-24">
            <div className="mx-auto max-w-2xl rounded-2xl border border-kant bg-yta px-6 py-14 text-center shadow-mjuk">
              <h2 className="rubrik-l text-text">Kom igång på ett par minuter</h2>
              <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed text-text-dämpad">
                Skapa ett konto gratis. Samma inloggning funkar både i appen och
                här på webben.
              </p>
              <div className="mt-8 flex justify-center">
                <Knapp variant="primär" href="/registrera">
                  Skapa konto gratis
                </Knapp>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Sidfot />
    </>
  );
}
