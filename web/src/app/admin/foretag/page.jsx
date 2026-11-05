'use client';

// Admin-företag: lista alla företag med statistik (antal jobb, godkända pass, plan) och
// faktureringsuppgifter. Sökbar på namn, orgnr och e-post.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Input from '@/components/ui/Input';
import { api, felText } from '@/lib/api';

export default function AdminFöretag() {
  const [företag, setFöretag] = useState(null);
  const [fel, setFel] = useState('');
  const [sök, setSök] = useState('');

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const lista = await api.adminFöretag();
      setFöretag(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setFöretag([]);
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  const filtrerade = useMemo(() => {
    if (!företag) return [];
    const q = sök.trim().toLowerCase();
    if (!q) return företag;
    return företag.filter(
      (f) =>
        f.Namn?.toLowerCase().includes(q) ||
        f.Email?.toLowerCase().includes(q) ||
        f.organisationsnummer?.toLowerCase().includes(q)
    );
  }, [företag, sök]);

  return (
    <div>
      <h1 className="rubrik-l text-text">Företag</h1>

      <div className="mt-5 max-w-sm">
        <Input
          id="sok"
          placeholder="Sök på namn, orgnr eller e-post…"
          value={sök}
          onChange={(e) => setSök(e.target.value)}
        />
      </div>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!företag ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : filtrerade.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga företag att visa.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtrerade.map((f) => {
            const pro = f.prenumeration_status === 'pro';
            return (
              <li key={f.id} className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-bold text-text">{f.Namn || 'Namnlöst företag'}</p>
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[11px] font-bold ${
                          pro ? 'bg-framgång-mjuk text-framgång' : 'bg-yta-dämpad text-text-dämpad'
                        }`}
                      >
                        {pro ? 'Pro' : 'Gratis'}
                      </span>
                    </div>
                    <p className="text-[13px] text-text-dämpad">
                      {f.Email}
                      {f.telefonnummer ? ` · ${f.telefonnummer}` : ''}
                    </p>
                    {f.organisationsnummer && (
                      <p className="text-[12px] text-text-svag">Org.nr {f.organisationsnummer}</p>
                    )}
                    {(f.fakturaadress || f.ort) && (
                      <p className="text-[12px] text-text-svag">
                        {[f.fakturaadress, f.postnummer, f.ort].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-sm bg-primär-mjuk px-3 py-2 text-center">
                      <p className="text-[18px] font-bold text-primär">{Number(f.antalJobb) || 0}</p>
                      <p className="text-[11px] font-semibold uppercase text-primär">Annonser</p>
                    </div>
                    <div className="rounded-sm bg-yta-dämpad px-3 py-2 text-center">
                      <p className="text-[18px] font-bold text-text">{Number(f.godkändaPass) || 0}</p>
                      <p className="text-[11px] font-semibold uppercase text-text-svag">Godkända pass</p>
                    </div>
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
