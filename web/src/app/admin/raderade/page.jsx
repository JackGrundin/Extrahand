'use client';

// Admin-raderade konton: inaktiva konton (aktiv = false). Personuppgifterna är nollade vid
// raderingen, så raderna bär bara id, kontotyp, avtalsstatus och raderingsdatum. Har kontot
// ett kvarvarande godkänt avtal kan det återkallas (utan orsak/mejl – kontot är borta).
import { useCallback, useEffect, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import { api, felText } from '@/lib/api';

function datumText(iso) {
  if (!iso) return 'okänt datum';
  const d = new Date(iso);
  const dagar = Math.floor((Date.now() - d.getTime()) / 86400000);
  const sedan = dagar <= 0 ? 'idag' : dagar === 1 ? '1 dag sedan' : `${dagar} dagar sedan`;
  return `${d.toLocaleDateString('sv-SE')} (${sedan})`;
}

export default function AdminRaderade() {
  const [konton, setKonton] = useState(null);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(null);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminRaderade();
      setKonton(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setKonton([]);
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  async function återkalla(id) {
    setSparar(id);
    setFel('');
    try {
      await api.återkallaAvtalRaderad(id);
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  return (
    <div>
      <h1 className="rubrik-l text-text">Raderade konton</h1>
      <p className="mt-1 text-[14px] text-text-dämpad">Inaktiva konton – personuppgifter är nollade</p>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!konton ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : konton.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga raderade konton.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {konton.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-bold text-text">Konto #{k.id}</p>
                  <span className="rounded-pill bg-yta-dämpad px-2 py-0.5 text-[11px] font-bold capitalize text-text-dämpad">
                    {k.Typ || 'okänd typ'}
                  </span>
                  {k.avtal_godkant === true && (
                    <span className="rounded-pill bg-varning-mjuk px-2 py-0.5 text-[11px] font-bold text-varning">
                      Avtal kvar
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-text-dämpad">Raderat {datumText(k.raderad_at)}</p>
              </div>
              {k.avtal_godkant === true && (
                <Knapp variant="fara" storlek="liten" laddar={sparar === k.id} onClick={() => återkalla(k.id)}>
                  Ta tillbaka avtal
                </Knapp>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
