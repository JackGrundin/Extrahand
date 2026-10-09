// Meddelanderuta för fel/framgång/info ovanför ett formulär. Renderar null när tomt.
const STILAR = {
  fel: 'bg-fel-mjuk text-fel border-fel/20',
  framgång: 'bg-framgång-mjuk text-framgång border-framgång/20',
  info: 'bg-primär-mjuk text-primär border-primär-kant',
};

export default function Besked({ typ = 'fel', children }) {
  if (!children) return null;
  return (
    <div
      role={typ === 'fel' ? 'alert' : 'status'}
      className={`mb-4 rounded-sm border px-4 py-3 text-[14px] font-medium ${
        STILAR[typ] ?? STILAR.info
      }`}
    >
      {children}
    </div>
  );
}
