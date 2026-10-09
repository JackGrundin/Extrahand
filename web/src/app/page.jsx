import Link from 'next/link';
import Image from 'next/image';
import {
  IoBriefcaseOutline,
  IoPeopleOutline,
  IoChatbubblesOutline,
  IoStarOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoCheckmarkCircle,
  IoCashOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import Toppnav from '@/components/Toppnav';
import Sidfot from '@/components/Sidfot';
import Knapp from '@/components/ui/Knapp';

// Prissiffror speglar frontend/src/utils/konstanter.js (PRO_PRIS_KR 299, påslag 0.20/0.40).
const PRO_PRIS = 299;

const FÖRETAG_STEG = [
  {
    ikon: IoBriefcaseOutline,
    titel: 'Publicera pass och scheman',
    text: 'Lägg upp enstaka jobbpass eller hela scheman för sommar- och säsongsarbete med datum, tider, timlön och OB-tillägg.',
  },
  {
    ikon: IoPeopleOutline,
    titel: 'Hantera ansökningar',
    text: 'Ta emot ansökningar, chatta med sökande och godkänn den som passar bäst – direkt i appen.',
  },
  {
    ikon: IoDocumentTextOutline,
    titel: 'Tidrapporter och fakturering',
    text: 'Tidrapporter skapas automatiskt när passet är klart. Du faktureras samlat, utan krångel.',
  },
];

const PRIVAT_STEG = [
  {
    ikon: IoSearchOutline,
    titel: 'Hitta jobb nära dig',
    text: 'Bläddra bland lediga pass och längre uppdrag, filtrera på stad och kategori och ansök med ett klick.',
  },
  {
    ikon: IoChatbubblesOutline,
    titel: 'Chatta med företaget',
    text: 'Ställ frågor och kom överens om detaljer i en direktchatt innan du tackar ja.',
  },
  {
    ikon: IoStarOutline,
    titel: 'Få betyg och bygg ditt rykte',
    text: 'Efter varje avslutat pass betygsätter ni varandra – bra omdömen gör dig mer attraktiv för fler uppdrag.',
  },
];

function StegKort({ ikon: Ikon, titel, text }) {
  return (
    <div className="rounded-md border border-kant bg-yta p-6 shadow-mjuk">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-sm bg-primär-mjuk text-primär">
        <Ikon size={24} />
      </div>
      <h3 className="rubrik-m mb-2 text-text">{titel}</h3>
      <p className="text-[15px] leading-relaxed text-text-dämpad">{text}</p>
    </div>
  );
}

export default function Marknadsforing() {
  return (
    <>
      <Toppnav />

      <main>
        {/* Hero */}
        <section className="bg-gradient-primär text-white">
          <div className="mx-auto flex max-w-innehåll flex-col items-center px-5 py-20 text-center sm:py-28">
            <span className="mb-5 inline-flex items-center gap-2 rounded-pill bg-white/15 px-4 py-1.5 text-[13px] font-semibold">
              <IoTimeOutline size={16} /> Flexibla jobb, enkelt
            </span>
            <h1 className="rubrik-xl mb-5 max-w-3xl">
              Rätt person för passet – eller rätt jobb för dig
            </h1>
            <p className="mb-9 max-w-xl text-[17px] leading-relaxed text-white/85">
              FastGig kopplar samman företag och privatpersoner för kortare
              jobbpass och längre uppdrag. Publicera, ansök, chatta och få betyg
              – allt på ett ställe.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Knapp
                variant="primär"
                href="/registrera"
                className="!bg-none bg-white !text-primär shadow-lyft hover:brightness-100"
              >
                Skapa konto
              </Knapp>
              <Knapp
                variant="kontur"
                href="/logga-in"
                className="border-white/40 !bg-transparent !text-white hover:border-white"
              >
                Logga in
              </Knapp>
            </div>
          </div>
        </section>

        {/* För företag */}
        <section className="mx-auto max-w-innehåll px-5 py-16 sm:py-20">
          <p className="överlinje mb-2">För företag</p>
          <h2 className="rubrik-l mb-3 text-text">Bemanna snabbt – betala smart</h2>
          <p className="mb-10 max-w-2xl text-[16px] leading-relaxed text-text-dämpad">
            Fyll luckor i schemat med pålitliga personer, utan dyra
            bemanningsavtal. Du betalar bara för pass som blir av.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            {FÖRETAG_STEG.map((s) => (
              <StegKort key={s.titel} {...s} />
            ))}
          </div>
        </section>

        {/* För privatpersoner */}
        <section className="bg-yta">
          <div className="mx-auto max-w-innehåll px-5 py-16 sm:py-20">
            <p className="överlinje mb-2">För privatpersoner</p>
            <h2 className="rubrik-l mb-3 text-text">
              Jobba när det passar dig
            </h2>
            <p className="mb-10 max-w-2xl text-[16px] leading-relaxed text-text-dämpad">
              Extrajobb, sommarjobb eller ett längre säsongsuppdrag – hitta det
              som passar din kalender och din plånbok.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              {PRIVAT_STEG.map((s) => (
                <StegKort key={s.titel} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* Priser */}
        <section className="mx-auto max-w-innehåll px-5 py-16 sm:py-20">
          <div className="mb-10 text-center">
            <p className="överlinje mb-2">Priser för företag</p>
            <h2 className="rubrik-l text-text">Börja gratis, väx när du vill</h2>
            <p className="mx-auto mt-3 max-w-xl text-[16px] text-text-dämpad">
              Privatpersoner använder FastGig helt kostnadsfritt. Företag väljer
              plan efter hur mycket de bemannar.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
            {/* Gratis */}
            <div className="flex flex-col rounded-lg border border-kant bg-yta p-7 shadow-mjuk">
              <h3 className="rubrik-m text-text">Gratis</h3>
              <p className="mt-1 text-[14px] text-text-dämpad">
                Perfekt för att komma igång
              </p>
              <div className="my-5">
                <span className="text-[40px] font-bold text-text">0 kr</span>
                <span className="text-[15px] text-text-dämpad"> /mån</span>
              </div>
              <ul className="flex flex-1 flex-col gap-3 text-[15px] text-text">
                <PunktRad>2 pass per månad med lågt påslag</PunktRad>
                <PunktRad>Obegränsat antal annonser</PunktRad>
                <PunktRad>Chatt, tidrapporter och betyg</PunktRad>
                <PunktRad>Högre påslag från det tredje passet</PunktRad>
              </ul>
              <Knapp variant="sekundär" href="/registrera" full className="mt-7">
                Skapa konto
              </Knapp>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-lg border-2 border-primär bg-yta p-7 shadow-lyft">
              <span className="absolute -top-3 left-7 rounded-pill bg-gradient-primär px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white">
                Populärast
              </span>
              <h3 className="rubrik-m text-text">Pro</h3>
              <p className="mt-1 text-[14px] text-text-dämpad">
                För dig som bemannar ofta
              </p>
              <div className="my-5">
                <span className="text-[40px] font-bold text-text">
                  {PRO_PRIS} kr
                </span>
                <span className="text-[15px] text-text-dämpad"> /mån</span>
              </div>
              <ul className="flex flex-1 flex-col gap-3 text-[15px] text-text">
                <PunktRad>Alltid lågt påslag – på alla pass</PunktRad>
                <PunktRad>Obegränsat antal pass och annonser</PunktRad>
                <PunktRad>Chatt, tidrapporter och betyg</PunktRad>
                <PunktRad>Avsluta när du vill</PunktRad>
              </ul>
              <Knapp variant="primär" href="/registrera" full className="mt-7">
                Kom igång med Pro
              </Knapp>
            </div>
          </div>
        </section>

        {/* Avslutande CTA */}
        <section className="bg-yta">
          <div className="mx-auto max-w-innehåll px-5 pb-20">
            <div className="flex flex-col items-center gap-6 rounded-lg bg-gradient-primär px-6 py-14 text-center text-white">
              <IoCashOutline size={40} className="opacity-90" />
              <h2 className="rubrik-l max-w-xl">
                Redo att komma igång med FastGig?
              </h2>
              <p className="max-w-lg text-[16px] text-white/85">
                Skapa ett konto på någon minut – samma konto fungerar i både
                appen och på webben.
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
      <IoCheckmarkCircle
        size={20}
        className="mt-0.5 shrink-0 text-framgång"
      />
      <span>{children}</span>
    </li>
  );
}
