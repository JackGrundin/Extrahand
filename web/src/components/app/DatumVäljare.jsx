// Datumfält (native <input type="date">). Värdet är alltid YYYY-MM-DD, vilket är samma
// format som backend vill ha – ingen konvertering behövs. min styr tidigaste valbara dag.
import FältFel from '@/components/ui/FältFel';

export default function DatumVäljare({ etikett, värde, onÄndra, fel, min, className = '' }) {
  const felläge = Boolean(fel);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <input
        type="date"
        value={värde ?? ''}
        min={min}
        onChange={(e) => onÄndra(e.target.value)}
        aria-invalid={felläge}
        className={`w-full rounded-sm border px-3.5 py-3 text-[15px] text-text outline-none transition-colors ${
          felläge
            ? 'border-fel border-[1.5px] bg-[#fef2f2]'
            : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta'
        }`}
      />
      <FältFel>{fel}</FältFel>
    </div>
  );
}
