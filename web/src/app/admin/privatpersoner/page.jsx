'use client';

// Admin-privatpersoner: lista alla privatpersoner med avtalsstatus, antal genomförda pass
// och betygssnitt. Sökbar på namn och e-post.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Input from '@/components/ui/Input';
import { api, felText } from '@/lib/api';

export default function AdminPrivatpersoner() {
  const [personer, setPersoner] = useState(null);
  const [fel, setFel] = useState('');
  const [sök, setSök] = useState('');

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminPrivatpersoner();
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

  return (
    <div>
      <h1 className="rubrik-l text-text">Privatpersoner</h1>

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
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-bold text-text">{p.Namn || 'Namnlös'}</p>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[11px] font-bold ${
                        godkänt ? 'bg-framgång-mjuk text-framgång' : 'bg-fel-mjuk text-fel'
                      }`}
                    >
                      {godkänt ? '✓ Avtal godkänt' : '✗ Ej godkänt'}
                    </span>
                  </div>
                  <p className="text-[13px] text-text-dämpad">
                    {p.Email}
                    {p.telefonnummer ? ` · ${p.telefonnummer}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="rounded-sm bg-yta-dämpad px-3 py-2 text-center">
                    <p className="text-[18px] font-bold text-text">{Number(p.genomfördaPass) || 0}</p>
                    <p className="text-[11px] font-semibold uppercase text-text-svag">Pass</p>
                  </div>
                  <div className="rounded-sm bg-yta-dämpad px-3 py-2 text-center">
                    <p className="text-[18px] font-bold text-text">
                      {p.betygSnitt != null ? `${p.betygSnitt}★` : '–'}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-text-svag">
                      Betyg{p.betygAntal ? ` (${p.betygAntal})` : ''}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
