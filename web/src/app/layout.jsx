import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'FastGig – Flexibla jobb, enkelt',
  description:
    'FastGig kopplar samman företag och privatpersoner för kortare jobbpass och längre uppdrag. Publicera pass, ansök, chatta och få betyg – allt på ett ställe.',
  icons: {
    icon: '/favicon.png',
  },
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
