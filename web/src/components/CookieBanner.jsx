'use client';

// Cookie-banner för GDPR-samtycke till Google Analytics. Visas för nya besökare som
// ännu inte gjort ett val. Valet sparas i localStorage under SAMTYCKE_NYCKEL.
// Google Analytics (gtag) laddas BARA om besökaren godkänner – avböjer man laddas
// inga analys-skript alls. Komponenten renderar även GA-skripten (via next/script)
// när samtycke finns, så att inget analytics-skript någonsin körs utan godkännande.
import { useEffect, useState } from 'react';
import Script from 'next/script';
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
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
          <div className="mx-auto flex max-w-innehåll flex-col gap-4 rounded-lg border border-kant bg-yta p-5 shadow-lyft sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] leading-relaxed text-text-dämpad">
              Vi använder cookies för att förstå hur sajten används (Google Analytics). Du
              väljer själv om du vill tillåta det – vi laddar inga analys-cookies om du
              avböjer.
            </p>
            <div className="flex shrink-0 gap-3">
              <Knapp variant="kontur" storlek="liten" onClick={() => spara('avböjt')}>
                Avböj
              </Knapp>
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
