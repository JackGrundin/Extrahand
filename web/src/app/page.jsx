import {
  IoBriefcaseOutline,
  IoPeopleOutline,
  IoChatbubblesOutline,
  IoStarOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoCheckmarkCircle,
  IoTimeOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import Toppnav from '@/components/Toppnav';
import Sidfot from '@/components/Sidfot';
import Knapp from '@/components/ui/Knapp';
import TelefonMockup from '@/components/TelefonMockup';

// Prissiffror speglar frontend/src/utils/konstanter.js (PRO_PRIS_KR 299, påslag 0.20/0.40).
const PRO_PRIS = 299;

const FÖRETAG_STEG = [
  {
    ikon: IoBriefcaseOutline,
    titel: 'Lägg upp ett pass eller ett helt schema',
    text: 'Enstaka pass eller längre scheman för sommar och säsong. Du sätter datum, tider, timlön och eventuellt OB.',
  },
  {
    ikon: IoPeopleOutline,
    titel: 'Välj vem du vill ha',
    text: 'Prata med dem som sökt direkt i chatten och godkänn den som känns rätt.',
  },
  {
    ikon: IoDocumentTextOutline,
    titel: 'Tidrapport och faktura sköter sig själva',
    text: 'När passet är slut skapas tidrapporten automatiskt. Du får en samlad faktura, utan pappersarbete.',
  },
];

const PRIVAT_STEG = [
  {
    ikon: IoSearchOutline,
    titel: 'Hitta jobb nära dig',
    text: 'Sök bland lediga pass och längre uppdrag i din stad och ansök med ett tryck.',
  },
  {
    ikon: IoChatbubblesOutline,
    titel: 'Prata med företaget först',
    text: 'Har du frågor? Chatta med företaget innan du bestämmer dig.',
  },
  {
    ikon: IoStarOutline,
    titel: 'Samla på bra betyg',
    text: 'Efter varje pass sätter ni betyg på varandra. Bra omdömen gör det lättare att få nästa jobb.',
  },
];

function StegKort({ ikon: Ikon, titel, text }) {
  return (
    <div className="group rounded-lg border border-kant/70 bg-yta p-7 shadow-mjuk transition duration-200 hover:-translate-y-1 hover:shadow-lyft">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-primär-mjuk text-primär">
        <Ikon size={24} />
      </div>
      <h3 className="rubrik-m mb-2 text-text">{titel}</h3>
      <p className="text-[15px] leading-relaxed text-text-dämpad">{text}</p>
    </div>
  );
}

function SektionsIntro({ överlinje, titel, text }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <p className="överlinje mb-3">{överlinje}</p>
      <h2 className="rubrik-l text-text">{titel}</h2>
      {text && (
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-text-dämpad">
          {text}
        </p>
      )}
    </div>
  );
}

export default function Marknadsforing() {
  return (
    <>
      <Toppnav />

      <main>
        {/* ── Hero (mörk, Vercel-stil) ───────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#0f172a] text-white">
          {/* Animerad gradient-glöd i bakgrunden. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="anim-gloed absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-primär/40 blur-3xl" />
            <div
              className="anim-gloed absolute -right-20 top-0 h-[440px] w-[440px] rounded-full bg-accent/25 blur-3xl"
              style={{ animationDelay: '-8s' }}
            />
            <div
              className="anim-gloed absolute -bottom-32 left-1/3 h-[380px] w-[380px] rounded-full bg-primär-djup/40 blur-3xl"
              style={{ animationDelay: '-14s' }}
            />
            {/* Fin linje längst ner för övergång mot ljus sektion. */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
          </div>

          <div className="relative mx-auto max-w-innehåll px-5 py-16 sm:py-24 lg:py-32">
            <div className="grid items-center gap-12 sm:gap-14 lg:grid-cols-2">
              {/* Text */}
              <div className="text-center lg:text-left">
                <span className="anim-fade-up inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-white/90 backdrop-blur">
                  <IoSparklesOutline size={15} /> Jobb och bemanning, utan krångel
                </span>
                <h1 className="anim-fade-up d-1 mt-6 text-white">
                  <span className="rubrik-hero block">Få hjälp med passet,</span>
                  <span className="rubrik-hero block bg-gradient-to-r from-[#93c5fd] via-[#a5b4fc] to-[#c4b5fd] bg-clip-text text-transparent">
                    eller hitta ditt nästa jobb
                  </span>
                </h1>
                <p className="anim-fade-up d-2 mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-white/70 lg:mx-0">
                  FastGig är en enkel app där företag lägger upp jobbpass och
                  privatpersoner söker dem. Ni chattar, kommer överens och sätter
                  betyg efteråt. Inga bemanningsavtal och ingen uppstartsavgift.
                </p>
                <div className="anim-fade-up d-3 mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Knapp
                    variant="primär"
                    href="/registrera"
                    className="!bg-none bg-white !text-primär shadow-lyft hover:brightness-100"
                  >
                    Skapa konto gratis
                  </Knapp>
                  <Knapp
                    variant="kontur"
                    href="/logga-in"
                    className="border-white/25 !bg-white/5 !text-white backdrop-blur hover:border-white/60"
                  >
                    Logga in
                  </Knapp>
                </div>
                <div className="anim-fade-up d-4 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/50 lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <IoCheckmarkCircle size={16} className="text-accent" /> Gratis
                    att börja
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IoCheckmarkCircle size={16} className="text-accent" /> Ingen
                    bindningstid
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IoTimeOutline size={16} className="text-accent" /> Igång på
                    några minuter
                  </span>
                </div>
              </div>

              {/* Telefon-mockup */}
              <div className="anim-fade-up d-3 flex justify-center lg:justify-end">
                <TelefonMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ── För företag ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-innehåll px-5 py-24">
          <SektionsIntro
            överlinje="För företag"
            titel="Extrapersonal utan dyra avtal"
            text="Lägg upp passet, välj bland dem som söker och betala bara när någon faktiskt jobbar. Du binder dig inte för något."
          />
          <div className="grid gap-5 sm:grid-cols-3">
            {FÖRETAG_STEG.map((s) => (
              <StegKort key={s.titel} {...s} />
            ))}
          </div>
        </section>

        {/* ── För privatpersoner ─────────────────────────────────────── */}
        <section className="border-y border-kant bg-yta">
          <div className="mx-auto max-w-innehåll px-5 py-24">
            <SektionsIntro
              överlinje="För privatpersoner"
              titel="Jobba när det passar dig"
              text="Hitta extrajobb i din stad, sök på en minut och ha koll på allt i appen. Du bestämmer själv vad du tackar ja till."
            />
            <div className="grid gap-5 sm:grid-cols-3">
              {PRIVAT_STEG.map((s) => (
                <StegKort key={s.titel} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Priser ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-innehåll px-5 py-24">
          <SektionsIntro
            överlinje="Priser för företag"
            titel="Enkla priser, inga överraskningar"
            text="Privatpersoner betalar aldrig något. För företag är det gratis att börja – uppgradera bara om du bemannar ofta."
          />

          <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
            {/* Gratis */}
            <div className="flex flex-col rounded-lg border border-kant bg-yta p-8 shadow-mjuk">
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
              <ul className="flex flex-1 flex-col gap-3 text-[15px] text-text">
                <PunktRad>2 pass i månaden med lågt påslag</PunktRad>
                <PunktRad>Lägg upp hur många annonser du vill</PunktRad>
                <PunktRad>Chatt, tidrapporter och betyg ingår</PunktRad>
                <PunktRad>Något högre påslag från tredje passet</PunktRad>
              </ul>
              <Knapp variant="sekundär" href="/registrera" full className="mt-8">
                Skapa konto
              </Knapp>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-lg border-2 border-primär bg-yta p-8 shadow-lyft">
              <span className="absolute -top-3 left-8 rounded-pill bg-gradient-primär px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white">
                Populärast
              </span>
              <h3 className="rubrik-m text-text">Pro</h3>
              <p className="mt-1 text-[14px] text-text-dämpad">
                För dig som bemannar ofta
              </p>
              <div className="my-6">
                <span className="text-[44px] font-bold tracking-tight text-text">
                  {PRO_PRIS} kr
                </span>
                <span className="text-[15px] text-text-dämpad"> /mån</span>
              </div>
              <ul className="flex flex-1 flex-col gap-3 text-[15px] text-text">
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
        </section>

        {/* ── Avslutande CTA (ekar hero) ─────────────────────────────── */}
        <section className="px-5 pb-24">
          <div className="relative mx-auto max-w-innehåll overflow-hidden rounded-[1.5rem] bg-[#0f172a] px-6 py-20 text-center text-white">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="anim-gloed absolute -left-10 top-0 h-72 w-72 rounded-full bg-primär/40 blur-3xl" />
              <div
                className="anim-gloed absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
                style={{ animationDelay: '-10s' }}
              />
            </div>
            <div className="relative mx-auto flex max-w-xl flex-col items-center gap-6">
              <h2 className="rubrik-l">Kom igång på ett par minuter</h2>
              <p className="text-[17px] leading-relaxed text-white/70">
                Skapa ett konto gratis. Samma inloggning funkar både i appen och
                här på webben.
              </p>
              <Knapp
                variant="primär"
                href="/registrera"
                className="!bg-none bg-white !text-primär shadow-lyft hover:brightness-100"
              >
                Skapa konto gratis
              </Knapp>
            </div>
          </div>
        </section>
      </main>

      <Sidfot />
    </>
  );
}

function PunktRad({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <IoCheckmarkCircle size={20} className="mt-0.5 shrink-0 text-framgång" />
      <span>{children}</span>
    </li>
  );
}
