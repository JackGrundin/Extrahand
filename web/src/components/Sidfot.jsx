// Enkel sidfot för marknadsföringssidan.
import Link from 'next/link';

export default function Sidfot() {
  return (
    <footer className="border-t border-kant bg-yta">
      <div className="mx-auto flex max-w-innehåll flex-col items-center justify-between gap-4 px-5 py-8 text-[14px] text-text-dämpad sm:flex-row">
        <span>© {new Date().getFullYear()} FastGig</span>
        <nav className="flex items-center gap-5">
          <Link href="/logga-in" className="hover:text-text">
            Logga in
          </Link>
          <Link href="/registrera" className="hover:text-text">
            Skapa konto
          </Link>
          <a href="mailto:info@fastgig.se" className="hover:text-text">
            Kontakt
          </a>
        </nav>
      </div>
    </footer>
  );
}
