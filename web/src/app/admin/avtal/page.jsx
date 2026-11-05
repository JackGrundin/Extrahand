'use client';

// Admin-avtal: lista alla privatpersoner med avtalsstatus. Godkänn ett avtal eller återkalla
// det (med obligatorisk orsak som backend mejlar till personen via Resend).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import Input from '@/components/ui/Input';
import { api, felText } from '@/lib/api';

// Antal hela dagar sedan ett ISO-datum, som "N dagar sedan" / "idag".
function dagarSedan(iso) {
  if (!iso) return null;
  const dagar = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dagar <= 0) return 'idag';
  if (dagar === 1) return '1 dag sedan';
  return `${dagar} dagar sedan`;
}

export default function AdminAvtal() {
  const [personer, setPersoner] = useState(null);
  const [fel, setFel] = useState('');
  const [sök, setSök] = useState('');
  const [sparar, setSparar] = useState(null);
  // Återkallande sker via en modal med obligatoriskt orsaksfält.
  const [återkallar, setÅterkallar] = useState(null); // personobjektet som återkallas
  const [orsak, setOrsak] = useState('');

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminAvtal();
      setPersoner(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setPersoner([]);
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  const filtrerade = useMemo(() => {
    if (!personer) return [];
    const q = sök.trim().toLowerCase();
    if (!q) return personer;
    return personer.filter(
      (p) => p.Namn?.toLowerCase().includes(q) || p.Email?.toLowerCase().includes(q)
    );
  }, [personer, sök]);

  async function godkänn(id) {
    setSparar(id);
    setFel('');
    try {
      await api.godkännAvtal(id);
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  async function bekräftaÅterkalla(e) {
    e.preventDefault();
    if (!återkallar || !orsak.trim()) return;
    setSparar(återkallar.id);
    setFel('');
    try {
      await api.återkallaAvtal(återkallar.id, orsak.trim());
      setÅterkallar(null);
      setOrsak('');
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(null);
    }
  }

  return (
    <div>
      <h1 className="rubrik-l text-text">Avtal</h1>
      <p className="mt-1 text-[14px] text-text-dämpad">Godkänn eller återkalla privatpersoners avtal</p>

      <div className="mt-5 max-w-sm">
        <Input
          id="sok"
          placeholder="Sök på namn eller e-post…"
          value={sök}
          onChange={(e) => setSök(e.target.value)}
        />
      </div>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!personer ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : filtrerade.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga privatpersoner att visa.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtrerade.map((p) => {
            const godkänt = p.avtal_godkant === true;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-bold text-text">{p.Namn || 'Namnlös'}</p>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[11px] font-bold ${
                        godkänt ? 'bg-framgång-mjuk text-framgång' : 'bg-fel-mjuk text-fel'
                      }`}
                    >
                      {godkänt ? '✓ Godkänt' : '✗ Ej godkänt'}
                    </span>
                  </div>
                  <p className="text-[13px] text-text-dämpad">
                    {p.Email}
                    {p.telefonnummer ? ` · ${p.telefonnummer}` : ''}
                  </p>
                  <p className="text-[12px] text-text-svag">Konto skapat {dagarSedan(p.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  {godkänt ? (
                    <Knapp variant="fara" storlek="liten" onClick={() => { setÅterkallar(p); setOrsak(''); }}>
                      Ta tillbaka avtal
                    </Knapp>
                  ) : (
                    <Knapp variant="primär" storlek="liten" laddar={sparar === p.id} onClick={() => godkänn(p.id)}>
                      Godkänn avtal
                    </Knapp>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Återkalla-modal med obligatorisk orsak */}
      {återkallar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setÅterkallar(null)} aria-hidden="true" />
          <form
            onSubmit={bekräftaÅterkalla}
            className="relative w-full max-w-md rounded-lg bg-yta p-6 shadow-lyft"
          >
            <h2 className="text-[18px] font-bold text-text">Återkalla avtal</h2>
            <p className="mt-1 text-[14px] text-text-dämpad">
              {återkallar.Namn} meddelas om återkallandet via e-post med din angivna orsak.
            </p>
            <div className="mt-4">
              <label htmlFor="orsak" className="text-[13px] font-semibold text-text-dämpad">
                Orsak
              </label>
              <textarea
                id="orsak"
                value={orsak}
                onChange={(e) => setOrsak(e.target.value)}
                rows={3}
                required
                className="mt-1.5 w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none transition-colors focus:border-primär focus:border-[1.5px] focus:bg-yta"
                placeholder="Beskriv varför avtalet återkallas…"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Knapp variant="kontur" storlek="liten" type="button" onClick={() => setÅterkallar(null)}>
                Avbryt
              </Knapp>
              <Knapp variant="fara" storlek="liten" type="submit" laddar={sparar === återkallar.id} disabled={!orsak.trim()}>
                Återkalla
              </Knapp>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
