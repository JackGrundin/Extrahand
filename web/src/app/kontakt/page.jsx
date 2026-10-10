import Sida from '@/components/Sida';

export const metadata = {
  title: 'Kontakt – FastGig',
  description: 'Kontakta FastGig på info@fastgig.se.',
};

export default function Kontakt() {
  return (
    <Sida titel="Kontakt" ingress="Hör av dig så svarar vi så fort vi kan.">
      <div className="rounded-xl border border-kant bg-yta p-8 shadow-mjuk">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-primär">
          E-post
        </p>
        <a
          href="mailto:info@fastgig.se"
          className="mt-2 inline-block text-[24px] font-bold text-text transition-colors hover:text-primär"
        >
          info@fastgig.se
        </a>
        <p className="mt-4 text-[15px] leading-relaxed text-text-dämpad">
          Samma adress gäller för frågor från företag, privatpersoner och press.
          Skriv ett par rader om vad det gäller så återkommer vi.
        </p>
      </div>
    </Sida>
  );
}
