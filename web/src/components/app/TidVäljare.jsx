// Tidfält (native <input type="time">). Värdet är HH:MM. Ett tomt värde betyder "ej satt"
// och visas som tomt – native time-input defaultar inte till 08:00 när value är "". Det är
// det som gör att massredigeringens tomma utkast inte råkar skriva en tid till alla pass.
import FältFel from '@/components/ui/FältFel';

export default function TidVäljare({ etikett, värde, onÄndra, fel, className = '' }) {
  const felläge = Boolean(fel);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <input
        type="time"
        value={värde ?? ''}
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
