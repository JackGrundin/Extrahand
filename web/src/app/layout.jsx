import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'FastGig – Flexibla jobb, enkelt',
  description:
    'En enkel app för extrajobb och extrapersonal. Företag lägger upp pass, privatpersoner söker, ni chattar och sätter betyg. Inga bemanningsavtal, gratis att börja.',
  icons: {
    icon: '/favicon.png',
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
