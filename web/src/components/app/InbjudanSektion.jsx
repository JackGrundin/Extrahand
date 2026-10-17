'use client';

// "Bjud in"-sektion för ett privat schema (företagsvy). Företaget skriver en e-postadress;
// personen får en länk till schemat (och en notis i appen om de redan har konto). Listar
// också vilka som bjudits in och deras status.
import { useCallback, useEffect, useState } from 'react';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

export default function InbjudanSektion({ schemaId }) {
  const [email, setEmail] = useState('');
  const [bjuderIn, setBjuderIn] = useState(false);
  const [fel, setFel] = useState('');
  const [bekräftelse, setBekräftelse] = useState('');
  const [inbjudna, setInbjudna] = useState([]);

  const ladda = useCallback(async () => {
    try {
      setInbjudna(await api.schemaInbjudningar(schemaId));
    } catch {
      /* listan är sekundär – svälj fel */
    }
  }, [schemaId]);

  useEffect(() => {
    ladda();
  }, [ladda]);

  async function bjudIn(e) {
    e.preventDefault();
    const adress = email.trim();
    if (!adress) return;
    setFel('');
    setBekräftelse('');
    setBjuderIn(true);
    try {
      const svar = await api.bjudInTillSchema(schemaId, adress);
      setEmail('');
      setBekräftelse(
        svar?.hadeKonto
          ? 'Inbjudan skickad – personen fick ett mejl och en notis i appen.'
          : 'Inbjudan skickad – personen fick ett mejl med en länk till schemat.'
      );
      ladda();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setBjuderIn(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-kant bg-yta-dämpad p-5">
      <h2 className="text-[17px] font-bold text-text">Bjud in till schemat</h2>
      <p className="mt-1 text-[14px] text-text-dämpad">
        Privata scheman syns bara för inbjudna. Skriv en e-postadress så får personen en länk
        till schemat (och en notis i appen om de redan har ett konto).
      </p>

      {fel && <div className="mt-3"><Besked typ="fel">{fel}</Besked></div>}
      {bekräftelse && <div className="mt-3"><Besked typ="framgång">{bekräftelse}</Besked></div>}

      <form onSubmit={bjudIn} className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="namn@exempel.se"
          />
        </div>
        <Knapp type="submit" variant="primär" laddar={bjuderIn}>
          Bjud in
        </Knapp>
      </form>

      {inbjudna.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {inbjudna.map((i, idx) => (
            <li
              key={`${i.email}-${idx}`}
              className="flex items-center justify-between rounded-sm border border-kant bg-yta px-3.5 py-2.5 text-[14px]"
            >
              <span className="truncate text-text">{i.email}</span>
              <span className="ml-3 shrink-0 text-[12px] font-semibold text-text-dämpad">
                {i.accepterad_at ? 'Öppnat' : i.hadeKonto ? 'Notis skickad' : 'Mejl skickat'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
