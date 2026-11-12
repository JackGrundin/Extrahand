import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { RealtidsProvider } from '@/context/RealtidsContext';
import BetaModal from '@/components/app/BetaModal';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  title: 'FastGig – Flexibla jobb, enkelt',
  description:
    'En enkel app för extrajobb och extrapersonal. Företag lägger upp pass, privatpersoner söker, ni chattar och sätter betyg. Inga bemanningsavtal, gratis att börja.',
  icons: {
    icon: '/favicon.png',
    apple: '/logotyp.png',
  },
  openGraph: {
    images: [{ url: '/logotyp.png' }],
  },
};

// Explicit viewport så att sidan skalar rätt på telefon (Next sätter detta som default,
// men vi är tydliga). initialScale 1 = ingen inzoomning, device-width = mobil-först.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <body>
        <AuthProvider>
          {/* Realtid (Supabase Broadcast) för hela den inloggade produkten. Providern guardar
              på inloggad användare, så den är ofarlig på publika/utloggade sidor. Monterad här
              (inte per route-grupp) så att både skalens badgar/toasts OCH sidornas egna
              useRealtidsPing-anrop ligger inom samma provider. */}
          <RealtidsProvider>
            {children}
            <BetaModal />
            {/* GDPR-samtyckesbanner. Laddar Google Analytics (gtag) först när besökaren
                godkänner – avböjer man laddas inga analys-skript. Valet sparas i localStorage. */}
            <CookieBanner />
          </RealtidsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
