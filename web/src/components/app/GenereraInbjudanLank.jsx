'use client';

// "Generera inbjudningslänk"-sektion (företagsvy) för ett jobb eller schema. Att generera
// länken gör annonsen privat (döljs ur den öppna listan) – bara den som har länken kan se
// och ansöka. En person som är ny på plattformen och registrerar sig via länken får
// rabatterat påslag. Fungerar för både jobb (typ="jobb") och schema (typ="schema").
import { useState } from 'react';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

export default function GenereraInbjudanLank({ typ, id, onPrivat }) {
  const [url, setUrl] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState('');
  const [kopierad, setKopierad] = useState(false);

  async function generera() {
    setFel('');
    setKopierad(false);
    setLaddar(true);
    try {
      const svar = typ === 'schema'
        ? await api.genereraSchemaInbjudan(id)
        : await api.genereraJobbInbjudan(id);
      setUrl(svar?.url || '');
      if (onPrivat) onPrivat();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }

  async function kopiera() {
    try {
      await navigator.clipboard.writeText(url);
      setKopierad(true);
      setTimeout(() => setKopierad(false), 2000);
    } catch {
      /* Kopiering kan nekas – länken syns ändå i fältet för manuell kopiering. */
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-kant bg-yta-dämpad p-5">
      <h2 className="text-[17px] font-bold text-text">Inbjudningslänk</h2>
      <p className="mt-1 text-[14px] text-text-dämpad">
        Generera en länk att dela direkt med en person. {typ === 'schema' ? 'Schemat' : 'Jobbet'} blir
        privat och syns inte i den öppna listan. Är personen ny på FastGig och registrerar sig
        via länken får du ett rabatterat påslag på passet.
      </p>

      {fel && <div className="mt-3"><Besked typ="fel">{fel}</Besked></div>}

      {url ? (
        <div className="mt-3 flex items-end gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded-sm border border-kant bg-yta px-3.5 py-2.5 text-[14px] text-text"
          />
          <Knapp variant="primär" onClick={kopiera}>
            {kopierad ? 'Kopierad!' : 'Kopiera'}
          </Knapp>
        </div>
      ) : (
        <div className="mt-3">
          <Knapp variant="sekundär" laddar={laddar} onClick={generera}>
            Generera inbjudningslänk
          </Knapp>
        </div>
      )}
    </section>
  );
}
