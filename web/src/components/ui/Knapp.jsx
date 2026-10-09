// Primärknapp som speglar frontend/src/components/Knapp.js. Varianter:
//  - primär:   gradientfylld blå→indigo, vit text (huvudåtgärd)
//  - sekundär: ljus indigo-bakgrund (sekundär åtgärd)
//  - kontur:   transparent med kant (låg betoning)
//  - fara:     röd kant (destruktiv åtgärd)
// Kan renderas som <button> (onClick) eller som länk (href via next/link).
import Link from 'next/link';

const VARIANTER = {
  primär:
    'bg-gradient-primär text-white shadow-mjuk hover:shadow-lyft hover:brightness-105',
  sekundär: 'bg-primär-mjuk text-primär hover:bg-[#e0e7ff]',
  kontur: 'bg-white text-text border border-kant hover:border-kant-stark',
  fara: 'bg-white text-fel border border-fel hover:bg-fel-mjuk',
};

// Storlekar: normal = standardknapp, liten = kompakt (t.ex. navbar). liten återanvänds
// i den framtida webbappens täta ytor.
const STORLEKAR = {
  normal: 'px-5 py-3 text-[15px]',
  liten: 'px-4 py-2 text-[14px]',
};

export default function Knapp({
  children,
  variant = 'primär',
  storlek = 'normal',
  href,
  type = 'button',
  full = false,
  laddar = false,
  disabled = false,
  className = '',
  ...props
}) {
  const bas =
    'inline-flex items-center justify-center gap-2 rounded-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none';
  const klasser = `${bas} ${STORLEKAR[storlek] ?? STORLEKAR.normal} ${
    VARIANTER[variant] ?? VARIANTER.primär
  } ${full ? 'w-full' : ''} ${className}`;

  const innehåll = laddar ? 'Vänta…' : children;

  if (href) {
    return (
      <Link href={href} className={klasser} {...props}>
        {innehåll}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={klasser}
      disabled={disabled || laddar}
      {...props}
    >
      {innehåll}
    </button>
  );
}
