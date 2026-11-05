'use client';

// Admin-fakturering: faktureringsunderlag (godkända, ej fakturerade tidrapporter) grupperat
// per företag med delsumma. Markera enskilda rader eller ett helt företag som fakturerat.
// Faktureringsbeloppen kommer färdigräknade från backend (beräknaFakturapris).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Besked from '@/components/ui/Besked';
import Knapp from '@/components/ui/Knapp';
import { api, felText } from '@/lib/api';

function kr(belopp) {
  return `${Math.round(Number(belopp) || 0).toLocaleString('sv-SE')} kr`;
}

function procent(paslag) {
  return `${Math.round((Number(paslag) || 0) * 100)}%`;
}

export default function AdminFakturering() {
  const [rader, setRader] = useState(null);
  const [statistik, setStatistik] = useState([]);
  const [perFöretag, setPerFöretag] = useState([]);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(false);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const [lista, stat, företag] = await Promise.all([
        api.adminFakturering(),
        api.adminFaktureringsstatistik(),
        api.adminFaktureringPerFöretag(),
      ]);
      setRader(Array.isArray(lista) ? lista : []);
      setStatistik(Array.isArray(stat) ? stat : []);
      setPerFöretag(Array.isArray(företag) ? företag : []);
    } catch (f) {
      setRader([]);
      setStatistik([]);
      setPerFöretag([]);
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  // Gruppera per företag. Nyckel på orgnr när det finns, annars namnet.
  const grupper = useMemo(() => {
    if (!rader) return [];
    const karta = new Map();
    for (const r of rader) {
      const nyckel = r.organisationsnummer || r.foretagsnamn || 'okänt';
      let grupp = karta.get(nyckel);
      if (!grupp) {
        grupp = { nyckel, företag: r, rader: [], summa: 0 };
        karta.set(nyckel, grupp);
      }
      grupp.rader.push(r);
      grupp.summa += Number(r.faktureringsbelopp) || 0;
    }
    return [...karta.values()];
  }, [rader]);

  async function markera(ids) {
    setSparar(true);
    setFel('');
    try {
      for (const id of ids) {
        await api.markeraFakturerad(id);
      }
      await hämta();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(false);
    }
  }

  return (
    <div>
      <h1 className="rubrik-l text-text">Fakturering</h1>
      <p className="mt-1 text-[14px] text-text-dämpad">Godkända, ännu ej fakturerade pass</p>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {(statistik.length > 0 || perFöretag.length > 0) && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
            <h2 className="rubrik-m text-text">Faktureringsöversikt</h2>
            <p className="mt-0.5 text-[12px] text-text-svag">Godkända pass denna månad, per påslag</p>
            <table className="mt-4 w-full text-[13px]">
              <thead>
                <tr className="border-b border-kant text-left text-[11px] uppercase text-text-svag">
                  <th className="pb-2 font-semibold">Påslagstyp</th>
                  <th className="pb-2 text-right font-semibold">Påslag</th>
                  <th className="pb-2 text-right font-semibold">Antal pass</th>
                  <th className="pb-2 text-right font-semibold">Totalt fakturabelopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kant">
                {statistik.map((s) => (
                  <tr key={s.paslag}>
                    <td className="py-2 text-text">{s.etikett}</td>
                    <td className="py-2 text-right text-text-dämpad">{procent(s.paslag)}</td>
                    <td className="py-2 text-right text-text-dämpad">{s.antal} st</td>
                    <td className="py-2 text-right font-semibold text-text">{kr(s.totalFaktura)}</td>
                  </tr>
                ))}
                {statistik.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-text-svag">Inga godkända pass denna månad.</td></tr>
                )}
              </tbody>
              {statistik.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-kant font-bold text-text">
                    <td className="pt-2">Totalt</td>
                    <td className="pt-2" />
                    <td className="pt-2 text-right">{statistik.reduce((s, r) => s + r.antal, 0)} st</td>
                    <td className="pt-2 text-right text-primär">{kr(statistik.reduce((s, r) => s + r.totalFaktura, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>

          <section className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
            <h2 className="rubrik-m text-text">Fakturering per företag</h2>
            <p className="mt-0.5 text-[12px] text-text-svag">Vad varje företag ska faktureras denna månad</p>
            <table className="mt-4 w-full text-[13px]">
              <thead>
                <tr className="border-b border-kant text-left text-[11px] uppercase text-text-svag">
                  <th className="pb-2 font-semibold">Företag</th>
                  <th className="pb-2 text-right font-semibold">Antal pass</th>
                  <th className="pb-2 text-right font-semibold">Fakturabelopp (exkl. moms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kant">
                {perFöretag.map((f) => (
                  <tr key={f.foretag_id}>
                    <td className="py-2 text-text">{f.foretagsnamn || 'Okänt företag'}</td>
                    <td className="py-2 text-right text-text-dämpad">{f.antal} st</td>
                    <td className="py-2 text-right font-semibold text-text">{kr(f.totalFaktura)}</td>
                  </tr>
                ))}
                {perFöretag.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-text-svag">Inga godkända pass denna månad.</td></tr>
                )}
              </tbody>
              {perFöretag.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-kant font-bold text-text">
                    <td className="pt-2">Totalt</td>
                    <td className="pt-2 text-right">{perFöretag.reduce((s, r) => s + r.antal, 0)} st</td>
                    <td className="pt-2 text-right text-primär">{kr(perFöretag.reduce((s, r) => s + r.totalFaktura, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
        </div>
      )}

      {!rader ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : grupper.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inget faktureringsunderlag just nu.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {grupper.map((g) => (
            <section key={g.nyckel} className="rounded-lg border border-kant bg-yta shadow-mjuk">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-kant p-5">
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-text">{g.företag.foretagsnamn || 'Okänt företag'}</p>
                  {g.företag.organisationsnummer && (
                    <p className="text-[12px] text-text-svag">Org.nr {g.företag.organisationsnummer}</p>
                  )}
                  {(g.företag.fakturaadress || g.företag.ort) && (
                    <p className="text-[12px] text-text-svag">
                      {[g.företag.fakturaadress, g.företag.postnummer, g.företag.ort].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {g.företag.fakturamail && <p className="text-[12px] text-text-svag">{g.företag.fakturamail}</p>}
                  {g.företag.referensperson && (
                    <p className="text-[12px] text-text-svag">Ref: {g.företag.referensperson}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-semibold uppercase text-text-svag">Delsumma</p>
                  <p className="text-[20px] font-bold text-primär">{kr(g.summa)}</p>
                  <Knapp
                    variant="sekundär"
                    storlek="liten"
                    laddar={sparar}
                    onClick={() => markera(g.rader.map((r) => r.id))}
                    className="mt-2"
                  >
                    Markera alla som fakturerat
                  </Knapp>
                </div>
              </div>

              <ul className="divide-y divide-kant">
                {g.rader.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text">
                        {r.jobbTitel || 'Pass'}
                        {r.ärSchemapass && (
                          <span className="ml-2 rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
                            Schemapass
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-text-dämpad">
                        {r.datum} · {Number(r.timmar) || 0} h · {kr(r.timlon)}/h · påslag {Math.round((Number(r.paslag) || 0) * 100)}%
                        {Number(r.ob_belopp) > 0 ? ` · OB ${kr(r.ob_belopp)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-bold text-text">{kr(r.faktureringsbelopp)}</span>
                      <Knapp variant="kontur" storlek="liten" laddar={sparar} onClick={() => markera([r.id])}>
                        Fakturerat
                      </Knapp>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
