import Sida from '@/components/Sida';

export const metadata = {
  title: 'Integritetspolicy – FastGig',
  description:
    'Så behandlar FastGig dina personuppgifter: vilka uppgifter vi samlar in, varför, hur länge de sparas och vilka rättigheter du har.',
};

export default function Integritetspolicy() {
  return (
    <Sida titel="Integritetspolicy" ingress="Senast uppdaterad: november 2026">
      <div className="space-y-10">
        <section>
          <h2 className="rubrik-m text-text">1. Vem är ansvarig för dina uppgifter?</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            FastGig är personuppgiftsansvarig för de uppgifter du lämnar när du
            använder vår tjänst.
          </p>
        </section>

        <section>
          <h2 className="rubrik-m text-text">2. Vilka uppgifter samlar vi in?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-relaxed text-text-dämpad">
            <li>Namn, e-postadress och lösenord vid registrering</li>
            <li>Födelsedatum (privatpersoner)</li>
            <li>Profilbild och profiltext (CV, erfarenheter, kompetenser)</li>
            <li>Stad och adress</li>
            <li>Uppladdade dokument (CV, körkort, intyg)</li>
            <li>Chattmeddelanden mellan dig och motparter</li>
            <li>Tidrapporter och betyg kopplade till genomförda pass</li>
            <li>
              Betalningsinformation hanteras av Stripe – vi lagrar inga
              kortuppgifter
            </li>
          </ul>
        </section>

        <section>
          <h2 className="rubrik-m text-text">3. Varför samlar vi in uppgifterna?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-relaxed text-text-dämpad">
            <li>För att du ska kunna skapa konto och använda tjänsten</li>
            <li>För att matcha företag med privatpersoner</li>
            <li>För att hantera tidrapporter, betalningar och fakturering</li>
            <li>För att skicka notifieringar och e-post om din tjänst</li>
          </ul>
        </section>

        <section>
          <h2 className="rubrik-m text-text">4. Cookies och analys</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            Vi använder Google Analytics för att förstå hur sajten används. Detta
            kräver ditt samtycke – du väljer själv i cookie-bannern när du besöker
            sajten. Godkänner du inte laddas inga analyscookies.
          </p>
        </section>

        <section>
          <h2 className="rubrik-m text-text">5. Hur länge sparar vi uppgifterna?</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            Dina uppgifter sparas så länge ditt konto är aktivt. Om du tar bort
            ditt konto anonymiseras dina personuppgifter – tidrapporter och betyg
            behålls i anonymiserad form för bokföringsändamål.
          </p>
        </section>

        <section>
          <h2 className="rubrik-m text-text">6. Dina rättigheter</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            Du har rätt att:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-relaxed text-text-dämpad">
            <li>Få ut en kopia av dina uppgifter</li>
            <li>Rätta felaktiga uppgifter</li>
            <li>Ta bort ditt konto (via inställningar i appen eller webben)</li>
            <li>Återkalla samtycke till cookies när som helst</li>
          </ul>
          <p className="mt-4 text-[16px] leading-relaxed text-text-dämpad">
            För frågor, kontakta oss på:{' '}
            <a
              href="mailto:info@fastgig.se"
              className="font-semibold text-primär hover:underline"
            >
              info@fastgig.se
            </a>
          </p>
        </section>

        <section>
          <h2 className="rubrik-m text-text">7. Tredjeparter</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-dämpad">
            Vi delar uppgifter med:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-relaxed text-text-dämpad">
            <li>Supabase (databaslagring, EU)</li>
            <li>Stripe (betalningshantering)</li>
            <li>Resend (e-postutskick)</li>
            <li>Google Analytics (webbanalys, om du godkänt cookies)</li>
            <li>
              Löneutbetalning – vi anlitar en tredjepartstjänst för utbetalning av
              lön till privatpersoner. Privatpersonen registrerar sina bankuppgifter
              direkt hos den tjänsten – FastGig hanterar aldrig bankuppgifter.
            </li>
          </ul>
        </section>
      </div>
    </Sida>
  );
}
