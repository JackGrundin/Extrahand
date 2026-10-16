// Flerradigt textfält (textarea) som matchar Input.jsx visuellt. Etikett ovanför,
// FältFel nedanför. Används för beskrivningar.
import FältFel from './FältFel';

export default function Textfält({ etikett, fel, id, className = '', rows = 5, ...props }) {
  const felläge = Boolean(fel);
  const basstil =
    'w-full rounded-sm border px-3.5 py-3 text-[15px] text-text outline-none transition-colors placeholder:text-text-svag resize-y';
  const lägesstil = felläge
    ? 'border-fel border-[1.5px] bg-[#fef2f2]'
    : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta';

  return (
    <div className="flex flex-col gap-1.5">
      {etikett && (
        <label htmlFor={id} className="text-[13px] font-semibold text-text-dämpad">
          {etikett}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className={`${basstil} ${lägesstil} ${className}`}
        aria-invalid={felläge}
        {...props}
      />
      <FältFel>{fel}</FältFel>
    </div>
  );
}
