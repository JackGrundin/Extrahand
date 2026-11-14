'use client';
// Hybrid datumfält: ett textfält för manuell inmatning (ÅÅÅÅ-MM-DD) plus en knapp
// som öppnar den native datumväljaren. Native <input type="date"> ensamt fungerar dåligt
// vid knappning – segmentformatet följer webbläsarens locale (inte lang="sv-SE") och
// placeholder ignoreras – så manuell inmatning sker i stället i ett textfält med mask och
// validering. Värdet som skickas upp är alltid ISO YYYY-MM-DD, samma format backend vill ha.
// min/max styr tidigaste/senaste valbara dag (ISO-strängar jämförs lexikografiskt).
import { useEffect, useRef, useState } from 'react';
import FältFel from '@/components/ui/FältFel';

// Maskerar fri inmatning till ÅÅÅÅ-MM-DD: behåll siffror, lägg bindestreck efter år och månad.
// Backspace som tar bort ett bindestreck tar då naturligt bort föregående siffra.
function maskera(raw) {
  const siffror = raw.replace(/\D/g, '').slice(0, 8);
  const delar = [siffror.slice(0, 4), siffror.slice(4, 6), siffror.slice(6, 8)].filter(Boolean);
  return delar.join('-');
}

// Parsar en komplett ÅÅÅÅ-MM-DD-sträng till ISO, eller null om formatet är fel eller datumet
// inte är ett reellt kalenderdatum (2026-02-31 avvisas via round-trip genom Date).
function parsaIsoDatum(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [, år, mån, dag] = m;
  const d = new Date(`${år}-${mån}-${dag}T12:00:00`);
  if (d.getFullYear() !== Number(år) || d.getMonth() + 1 !== Number(mån) || d.getDate() !== Number(dag)) {
    return null;
  }
  return `${år}-${mån}-${dag}`;
}

export default function DatumVäljare({ etikett, värde, onÄndra, fel, min, max, className = '' }) {
  const [text, setText] = useState(värde ?? '');
  const [lokaltFel, setLokaltFel] = useState('');
  const fokuserad = useRef(false);
  const datumRef = useRef(null);

  // Spegla externa ändringar av värde (kalenderval, rensning via sättPeriod) till textfältet –
  // men inte medan användaren skriver, annars hoppar markören.
  useEffect(() => {
    if (!fokuserad.current) setText(värde ?? '');
  }, [värde]);

  function hanteraText(e) {
    const maskerad = maskera(e.target.value);
    setText(maskerad);
    setLokaltFel('');

    if (maskerad === '') {
      onÄndra('');
      return;
    }
    const iso = parsaIsoDatum(maskerad);
    // Committa bara kompletta, reella datum inom min/max. Ofullständigt/ogiltigt
    // behålls lokalt medan man skriver – föräldern behåller då sitt förra värde.
    if (iso && (!min || iso >= min) && (!max || iso <= max)) {
      onÄndra(iso);
    }
  }

  function hanteraBlur() {
    fokuserad.current = false;
    if (text === '') {
      setLokaltFel('');
      return;
    }
    const iso = parsaIsoDatum(text);
    if (!iso) {
      setLokaltFel('Ange ett giltigt datum, ÅÅÅÅ-MM-DD');
    } else if (min && iso < min) {
      setLokaltFel('Datumet är för tidigt');
    } else if (max && iso > max) {
      setLokaltFel('Datumet är för sent');
    } else {
      setLokaltFel('');
      setText(iso);
    }
  }

  function öppnaKalender() {
    try {
      datumRef.current?.showPicker?.();
    } catch {
      // showPicker kräver användargest/stöd – saknas det fungerar textinmatningen ändå.
    }
  }

  const visatFel = fel || lokaltFel;
  const felläge = Boolean(visatFel);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etikett && <label className="text-[13px] font-semibold text-text-dämpad">{etikett}</label>}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="ÅÅÅÅ-MM-DD"
          maxLength={10}
          value={text}
          onFocus={() => { fokuserad.current = true; }}
          onClick={öppnaKalender}
          onChange={hanteraText}
          onBlur={hanteraBlur}
          aria-invalid={felläge}
          className={`w-full rounded-sm border py-3 pl-3.5 pr-12 text-[15px] text-text outline-none transition-colors ${
            felläge
              ? 'border-fel border-[1.5px] bg-[#fef2f2]'
              : 'border-kant bg-yta-dämpad focus:border-primär focus:border-[1.5px] focus:bg-yta'
          }`}
        />
        <button
          type="button"
          onClick={öppnaKalender}
          aria-label="Öppna kalender"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-sm text-text-dämpad transition-colors hover:bg-yta-dämpad hover:text-primär"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
        {/* Visuellt dold native datumväljare – öppnas av knappen via showPicker(). */}
        <input
          ref={datumRef}
          type="date"
          value={värde ?? ''}
          min={min}
          max={max}
          onChange={(e) => onÄndra(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-0 h-0 w-0 opacity-0"
        />
      </div>
      <FältFel>{visatFel}</FältFel>
    </div>
  );
}
