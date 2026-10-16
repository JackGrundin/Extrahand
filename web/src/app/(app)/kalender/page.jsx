'use client';

// Schemaöversikt: företagets bemanningskalender. Visar vilka dagar som är bemannade (och av
// vem) och vilka som väntar på personal, via GET /api/scheman/kalender (schemapass +
// godkända enstaka pass, inkl. obemannade). Hämtar tre månader åt gången kring den visade
// månaden så grannmånadernas data redan finns vid månadsbyte. Refetchar vid realtidsping.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Besked from '@/components/ui/Besked';
import MånadsKalender from '@/components/app/MånadsKalender';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api } from '@/lib/api';
import { datumTillIso, veckodagsNamn, formatDagDatum } from '@/utils/datumHelper';
import { grupperaPerKategori } from '@/utils/schemaPass';
import { rollFärg } from '@/utils/konstanter';

// Rollerna i den visade månaden, vanligast först – matar förklaringsraden.
function rollerIMånaden(pass, år, månad) {
  const prefix = `${år}-${String(månad + 1).padStart(2, '0')}`;
  const antal = {};
  for (const p of pass) {
    if (!p.datum?.startsWith(prefix) || !p.kategori) continue;
    antal[p.kategori] = (antal[p.kategori] || 0) + 1;
  }
  return Object.entries(antal)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
    .map(([namn, n]) => ({ namn, antal: n, färg: rollFärg(namn) }));
}

// Dagar som är bemannade resp. väntar på personal (en delvis bemannad dag räknas i båda).
function räknaDagar(passPerDatum, år, månad) {
  const prefix = `${år}-${String(månad + 1).padStart(2, '0')}`;
  let bemannade = 0;
  let väntande = 0;
  for (const [datum, dagensPass] of Object.entries(passPerDatum)) {
    if (!datum.startsWith(prefix)) continue;
    if (dagensPass.some((p) => p.personId != null)) bemannade += 1;
    if (dagensPass.some((p) => p.personId == null)) väntande += 1;
  }
  return { bemannade, väntande };
}

export default function Kalender() {
  const idag = new Date();
  const [vy, setVy] = useState({ år: idag.getFullYear(), månad: idag.getMonth() });
  const [valtDatum, setValtDatum] = useState(datumTillIso(idag));
  const [pass, setPass] = useState([]);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      // Första dagen i föregående månad → sista dagen i nästa.
      const från = datumTillIso(new Date(vy.år, vy.månad - 1, 1));
      const till = datumTillIso(new Date(vy.år, vy.månad + 2, 0));
      const data = await api.schemaKalender(från, till);
      setPass(Array.isArray(data) ? data : []);
    } catch (f) {
      setFel(f?.message || 'Kunde inte hämta kalendern');
    } finally {
      setLaddar(false);
    }
  }, [vy.år, vy.månad]);

  useEffect(() => {
    hämta();
  }, [hämta]);

  // En ny/ändrad ansökan kan ändra bemanningen → hämta om.
  useRealtidsPing(() => hämta());

  const passPerDatum = useMemo(() => {
    const karta = {};
    for (const p of pass) {
      if (!p.datum) continue;
      (karta[p.datum] ??= []).push(p);
    }
    return karta;
  }, [pass]);

  const förklaring = useMemo(() => rollerIMånaden(pass, vy.år, vy.månad), [pass, vy]);
  const summering = useMemo(() => räknaDagar(passPerDatum, vy.år, vy.månad), [passPerDatum, vy]);
  const dagensGrupper = useMemo(
    () => grupperaPerKategori(passPerDatum[valtDatum] ?? []),
    [passPerDatum, valtDatum]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="rubrik-l text-text">Schemaöversikt</h1>
        <p className="mt-1 text-[15px] text-text-dämpad">Vem jobbar vilka dagar – och var det saknas personal.</p>
      </div>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {/* Månadssummering */}
      <div className="mb-4 flex flex-wrap gap-3">
        <span className="rounded-pill bg-framgång-mjuk px-3 py-1 text-[13px] font-bold text-framgång">
          {summering.bemannade} bemannade dagar
        </span>
        <span className="rounded-pill bg-varning-mjuk px-3 py-1 text-[13px] font-bold text-varning-text">
          {summering.väntande} dagar söker personal
        </span>
      </div>

      {/* Förklaringsrad: roll → färg */}
      {förklaring.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
          {förklaring.map((r) => (
            <span key={r.namn} className="flex items-center gap-1.5 text-[13px] text-text-dämpad">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.färg }} />
              {r.namn} <span className="text-text-svag">({r.antal})</span>
            </span>
          ))}
        </div>
      )}

      {laddar && pass.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : (
        <MånadsKalender
          passPerDatum={passPerDatum}
          valtDatum={valtDatum}
          onVäljDag={setValtDatum}
          år={vy.år}
          månad={vy.månad}
          onBytMånad={(år, månad) => setVy({ år, månad })}
        />
      )}

      {/* Dagslista för vald dag */}
      <div className="mt-6">
        <h2 className="mb-3 text-[17px] font-bold text-text">
          {valtDatum ? `${veckodagsNamn(valtDatum)} ${formatDagDatum(valtDatum)}` : 'Välj en dag'}
        </h2>
        {dagensGrupper.length === 0 ? (
          <p className="rounded-lg border border-dashed border-kant p-6 text-center text-[14px] text-text-dämpad">
            Inga pass den här dagen.
          </p>
        ) : (
          <div className="space-y-4">
            {dagensGrupper.map((grupp) => (
              <div key={grupp.kategori ?? '—'}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: rollFärg(grupp.kategori) }}
                  />
                  <p className="text-[14px] font-bold text-text">{grupp.kategori || 'Utan roll'}</p>
                </div>
                <ul className="space-y-1.5">
                  {grupp.pass.map((p, i) => {
                    const rad = (
                      <div className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-text">{p.titel}</p>
                          <p className="text-[13px] text-text-dämpad">
                            {p.starttid && p.sluttid ? `${p.starttid}–${p.sluttid}` : 'Tid ej satt'}
                          </p>
                        </div>
                        <span
                          className={`ml-3 shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-bold ${
                            p.personId
                              ? 'bg-framgång-mjuk text-framgång'
                              : 'bg-varning-mjuk text-varning-text'
                          }`}
                        >
                          {p.personId ? p.personNamn || 'Bemannat' : 'Söker person'}
                        </span>
                      </div>
                    );
                    // Schemapass länkar till schemadetaljen; enstaka pass saknar id att öppna.
                    return (
                      <li key={`${p.titel}-${p.starttid}-${i}`}>
                        {p.typ === 'schema' && p.schemaId ? (
                          <Link href={`/annonser/schema/${p.schemaId}`} className="block transition-opacity hover:opacity-80">
                            {rad}
                          </Link>
                        ) : (
                          rad
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
