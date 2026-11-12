'use client';

// Cookie-banner för GDPR-samtycke till Google Analytics. Visas för nya besökare som
// ännu inte gjort ett val. Valet sparas i localStorage under SAMTYCKE_NYCKEL.
// Google Analytics (gtag) laddas BARA om besökaren godkänner – avböjer man laddas
// inga analys-skript alls. Komponenten renderar även GA-skripten (via next/script)
// när samtycke finns, så att inget analytics-skript någonsin körs utan godkännande.
import { useEffect, useState } from 'react';
import Script from 'next/script';
import Image from 'next/image';
import Knapp from '@/components/ui/Knapp';

const SAMTYCKE_NYCKEL = 'fastgig.cookie-samtycke';
const GA_MÄT_ID = 'G-4Y9MG9QCEP';

export default function CookieBanner() {
  // null = ännu inte läst från localStorage, 'godkänt'/'avböjt' = besökarens val,
  // '' = inget val gjort än (visa bannern).
  const [samtycke, setSamtycke] = useState(null);

  useEffect(() => {
    try {
      setSamtycke(localStorage.getItem(SAMTYCKE_NYCKEL) || '');
    } catch {
      // localStorage kan vara blockerad (privat läge/strikta inställningar) – visa
      // då ingen banner och ladda inget, hellre än att krascha.
      setSamtycke('avböjt');
    }
  }, []);

  function spara(val) {
    try {
      localStorage.setItem(SAMTYCKE_NYCKEL, val);
    } catch {
      // Ignorera – kunde inte spara valet, men vi respekterar det för denna session.
    }
    setSamtycke(val);
  }

  // Innan vi läst localStorage renderar vi inget (undviker att bannern blinkar förbi
  // för besökare som redan gjort ett val).
  if (samtycke === null) return null;

  return (
    <>
      {samtycke === 'godkänt' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MÄT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MÄT_ID}');
            `}
          </Script>
        </>
      )}

      {samtycke === '' && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-w-full overflow-hidden border-t border-kant bg-yta shadow-[0_-4px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-innehåll flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Image
              src="/logotyp.png"
              alt="FastGig"
              width={132}
              height={34}
              className="hidden h-5 w-auto shrink-0 sm:block"
            />
            <p className="text-[14px] leading-relaxed text-text-dämpad sm:flex-1 sm:px-6">
              Den här webbplatsen använder cookies för analys (Google Analytics).
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => spara('avböjt')}
                className="text-[14px] font-semibold text-text-dämpad transition-colors hover:text-text"
              >
                Avböj
              </button>
              <Knapp variant="primär" storlek="liten" onClick={() => spara('godkänt')}>
                Godkänn
              </Knapp>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
