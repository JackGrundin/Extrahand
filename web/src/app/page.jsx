import { Fragment } from 'react';
import Link from 'next/link';
import Toppnav from '@/components/Toppnav';
import Sidfot from '@/components/Sidfot';
import TelefonMockup from '@/components/TelefonMockup';
import { Understrykning, Cirkel, Pil, Stjarna, Bock } from '@/components/Klotter';

// Prissiffror speglar frontend/src/utils/konstanter.js (PRO_PRIS_KR 299, påslag 0.20/0.40).
const PRO_PRIS = 299;

// Stegen under varje sektion – numrerade, utan ikoner. Färgerna roterar per steg.
const STEG_FÄRGER = ['text-korall', 'text-primär', 'text-framgång'];

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

// Lekfull knapp: solid färg, mörk kant och hård offset-skugga som "trycks in" vid klick.
// Egen komponent (inte den delade Knapp) så att auth-sidorna behåller sin rena look.
const TONER = {
  primär: 'bg-primär text-white',
  mörk: 'bg-text text-white',
  ljus: 'bg-white text-text',
  sekundär: 'bg-lavendel text-primär',
};

function LekfullKnapp({ href, children, ton = 'primär', className = '' }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-pill border-2 border-text px-6 py-3 text-[15px] font-extrabold shadow-hard transition-all duration-150 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[2px_2px_0_#0f172a] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none ${TONER[ton]} ${className}`}
    >
      {children}
    </Link>
  );
}

// Nyckelord med handritad understrykning under.
function Nyckelord({ children, färg = 'text-korall' }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <Understrykning
        className={`pointer-events-none absolute -bottom-1 left-0 h-[0.38em] w-full ${färg}`}
      />
    </span>
  );
}

function StegRad({ steg }) {
  return (
    <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-4">
      {steg.map((s, i) => (
        <Fragment key={s.titel}>
          <div className="flex-1">
            <div
              className={`text-[46px] font-extrabold leading-none ${STEG_FÄRGER[i % STEG_FÄRGER.length]}`}
            >
              0{i + 1}
            </div>
            <h3 className="rubrik-m mt-3 text-text">{s.titel}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-text-dämpad">
              {s.text}
            </p>
          </div>
          {i < steg.length - 1 && (
            <Pil className="mt-5 hidden h-10 w-10 shrink-0 rotate-[18deg] text-text/25 md:block" />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function PunktRad({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <Bock className="mt-1 h-4 w-4 shrink-0 text-framgång" />
      <span>{children}</span>
    </li>
  );
}

export default function Marknadsforing() {
  return (
    <>
      <Toppnav />

      <main className="bg-cream">
        {/* ── Hero (ljus, lekfull) ───────────────────────────────────── */}
        <section className="relative overflow-hidden bg-cream">
          {/* Strödda doodles i bakgrunden. */}
          <Stjarna className="absolute left-[7%] top-24 hidden h-6 w-6 rotate-12 text-stjärna sm:block" />
          <Stjarna className="absolute right-[6%] bottom-16 hidden h-5 w-5 text-korall sm:block" />

          <div className="relative mx-auto max-w-innehåll px-5 py-16 sm:py-20 lg:py-28">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              {/* Text */}
              <div className="text-center lg:text-left">
                <h1 className="anim-fade-up rubrik-hero text-text">
                  Få hjälp med{' '}
                  <Nyckelord färg="text-primär">passet</Nyckelord>, eller hitta
                  ditt nästa <Nyckelord färg="text-korall">jobb</Nyckelord>
                </h1>
                <p className="anim-fade-up d-1 mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-text-dämpad lg:mx-0">
                  FastGig är en enkel app där företag lägger upp jobbpass och
                  privatpersoner söker dem. Ni chattar, kommer överens och sätter
                  betyg efteråt. Inga bemanningsavtal och ingen uppstartsavgift.
                </p>
                <div className="anim-fade-up d-2 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                  <LekfullKnapp href="/registrera" ton="primär">
                    Skapa konto gratis
                  </LekfullKnapp>
                  <LekfullKnapp href="/logga-in" ton="ljus">
                    Logga in
                  </LekfullKnapp>
                </div>
                <div className="anim-fade-up d-3 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] font-semibold text-text-dämpad lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <Bock className="h-4 w-4 text-framgång" /> Gratis att börja
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Bock className="h-4 w-4 text-framgång" /> Ingen bindningstid
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Bock className="h-4 w-4 text-framgång" /> Igång på några
                    minuter
                  </span>
                </div>
              </div>

              {/* Telefon-mockup med klistermärke + doodles */}
              <div className="anim-fade-up d-2 relative flex justify-center lg:justify-end">
                {/* Färgblob bakom */}
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 z-0 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-himmel"
                />
                {/* Klistermärke/stämpel */}
                <div className="anim-gunga absolute -top-1 left-2 z-20 grid h-24 w-24 place-items-center rounded-full border-2 border-text bg-stjärna text-center shadow-hard-sm sm:left-6">
                  <span className="text-[12px] font-extrabold uppercase leading-tight text-text">
                    Gratis
                    <br />
                    att börja
                  </span>
                </div>
                <div className="relative z-10 rotate-2">
                  <TelefonMockup />
                </div>
                <Stjarna className="absolute right-2 top-12 z-20 h-6 w-6 text-korall" />
              </div>
            </div>
          </div>
        </section>

        {/* ── För företag (persika-band) ─────────────────────────────── */}
        <section className="border-t-2 border-text bg-persika">
          <div className="mx-auto max-w-innehåll px-5 py-20 sm:py-24">
            <div className="mb-14 max-w-2xl">
              <p className="text-[13px] font-extrabold uppercase tracking-wide text-korall">
                För företag
              </p>
              <h2 className="rubrik-l mt-2 text-text">
                Extrapersonal utan{' '}
                <Nyckelord färg="text-korall">dyra avtal</Nyckelord>
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-text-dämpad">
                Lägg upp passet, välj bland dem som söker och betala bara när
                någon faktiskt jobbar. Du binder dig inte för något.
              </p>
            </div>
            <StegRad steg={FÖRETAG_STEG} />
          </div>
        </section>

        {/* ── För privatpersoner (mint-band) ─────────────────────────── */}
        <section className="border-t-2 border-text bg-mint">
          <div className="mx-auto max-w-innehåll px-5 py-20 sm:py-24">
            <div className="mb-14 max-w-2xl">
              <p className="text-[13px] font-extrabold uppercase tracking-wide text-framgång">
                För privatpersoner
              </p>
              <h2 className="rubrik-l mt-2 text-text">
                Jobba när det{' '}
                <Nyckelord färg="text-framgång">passar dig</Nyckelord>
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-text-dämpad">
                Hitta extrajobb i din stad, sök på en minut och ha koll på allt i
                appen. Du bestämmer själv vad du tackar ja till.
              </p>
            </div>
            <StegRad steg={PRIVAT_STEG} />
          </div>
        </section>

        {/* ── Priser (lavendel-band) ─────────────────────────────────── */}
        <section className="border-t-2 border-text bg-lavendel">
          <div className="mx-auto max-w-innehåll px-5 py-20 sm:py-24">
            <div className="mb-14 text-center">
              <p className="text-[13px] font-extrabold uppercase tracking-wide text-primär">
                Priser för företag
              </p>
              <h2 className="rubrik-l mt-2 text-text">
                Enkla priser,{' '}
                <Nyckelord färg="text-primär">inga överraskningar</Nyckelord>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[16px] text-text-dämpad">
                Privatpersoner betalar aldrig något. För företag är det gratis
                att börja – uppgradera bara om du bemannar ofta.
              </p>
            </div>

            <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
              {/* Gratis */}
              <div className="flex flex-col rounded-[1.4rem] border-2 border-text bg-white p-7 shadow-hard sm:rotate-[-1deg]">
                <h3 className="rubrik-m text-text">Gratis</h3>
                <p className="mt-1 text-[14px] text-text-dämpad">
                  Bra för att testa
                </p>
                <div className="my-6">
                  <span className="text-[46px] font-extrabold tracking-tight text-text">
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
                <LekfullKnapp
                  href="/registrera"
                  ton="mörk"
                  className="mt-8 w-full"
                >
                  Skapa konto
                </LekfullKnapp>
              </div>

              {/* Pro */}
              <div className="relative flex flex-col rounded-[1.4rem] border-2 border-text bg-white p-7 shadow-hard sm:rotate-[1deg]">
                {/* Handritad annotering i stället för pill-badge */}
                <div className="absolute -top-9 right-3 flex items-center gap-1 text-korall">
                  <span className="rotate-[-5deg] text-[15px] font-extrabold">
                    ta den här!
                  </span>
                  <Pil className="h-9 w-9 rotate-[120deg]" />
                </div>
                <h3 className="rubrik-m text-text">Pro</h3>
                <p className="mt-1 text-[14px] text-text-dämpad">
                  För dig som bemannar ofta
                </p>
                <div className="my-6">
                  <span className="relative inline-block">
                    <span className="text-[46px] font-extrabold tracking-tight text-text">
                      {PRO_PRIS} kr
                    </span>
                    <Cirkel className="pointer-events-none absolute -left-3 -top-2 h-[calc(100%+16px)] w-[calc(100%+24px)] text-korall" />
                  </span>
                  <span className="text-[15px] text-text-dämpad"> /mån</span>
                </div>
                <ul className="flex flex-1 flex-col gap-3 text-[15px] text-text">
                  <PunktRad>Lågt påslag på alla pass</PunktRad>
                  <PunktRad>Obegränsat med pass och annonser</PunktRad>
                  <PunktRad>Chatt, tidrapporter och betyg ingår</PunktRad>
                  <PunktRad>Säg upp när du vill</PunktRad>
                </ul>
                <LekfullKnapp
                  href="/registrera"
                  ton="primär"
                  className="mt-8 w-full"
                >
                  Kom igång med Pro
                </LekfullKnapp>
              </div>
            </div>
          </div>
        </section>

        {/* ── Avslutande CTA (djärvt färgblock) ──────────────────────── */}
        <section className="border-t-2 border-text bg-cream px-5 py-20 sm:py-24">
          <div className="relative mx-auto max-w-innehåll overflow-hidden rounded-[2rem] border-2 border-text bg-primär px-6 py-16 text-center text-white shadow-hard">
            <Stjarna className="absolute left-8 top-8 h-7 w-7 text-white/40" />
            <Stjarna className="absolute bottom-10 right-10 h-6 w-6 text-white/30" />
            <div className="relative mx-auto flex max-w-xl flex-col items-center gap-6">
              <h2 className="rubrik-l">Kom igång på ett par minuter</h2>
              <p className="text-[17px] leading-relaxed text-white/80">
                Skapa ett konto gratis. Samma inloggning funkar både i appen och
                här på webben.
              </p>
              <LekfullKnapp href="/registrera" ton="ljus">
                Skapa konto gratis
              </LekfullKnapp>
            </div>
          </div>
        </section>
      </main>

      <Sidfot />
    </>
  );
}
