// Textfält som speglar STIL.input / inputFokus / inputFel i appens tema.js:
// nedtonad bakgrund som default, blå kant + vit bakgrund vid fokus, röd vid fel.
// Visar etikett ovanför och FältFel nedanför när `fel` är satt.
import FältFel from './FältFel';

export default function Input({
  etikett,
  fel,
  id,
  className = '',
  ...props
}) {
  const felläge = Boolean(fel);
  const basstil =
    'w-full rounded-sm border px-3.5 py-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-text-svag';
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
      <input
        id={id}
        className={`${basstil} ${lägesstil} ${className}`}
        aria-invalid={felläge}
        {...props}
      />
      <FältFel>{fel}</FältFel>
    </div>
  );
}
