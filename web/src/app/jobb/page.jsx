'use client';

// Publik jobblista för privatpersoner: bläddra bland öppna enstaka pass och filtrera.
// Ligger UTANFÖR (app)-gruppen (ingen auth krävs för att läsa). Filtreringen är klient-sidig
// och speglar appens JobbScreen (ort = substräng mot Plats, bransch = flerval mot Kategori,
// min-lön mot Lon, min-dagar mot antal_dagar, sortering). Backend GET /jobb är publik och
// har redan rensat bort schema-jobb, tillsatta och passerade pass.
import { useEffect, useMemo, useState } from 'react';
import PrivatSkal from '@/components/privat/PrivatSkal';
import AvtalBanner from '@/components/privat/AvtalBanner';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import JobbListKort from '@/components/JobbListKort';
import { api, felText } from '@/lib/api';
import { KATEGORIER, normalisera } from '@/utils/konstanter';
import { förstaArbetsdatum } from '@/utils/datumHelper';
import { SVENSKA_ORTER } from '@/utils/svenskaOrter';

const SORTERINGAR = [
  { värde: 'nyast', etikett: 'Nyast' },
  { värde: 'datum', etikett: 'Närmast datum' },
  { värde: 'lon', etikett: 'Högst lön' },
  { värde: 'dagar', etikett: 'Flest dagar' },
];

export default function JobbLista() {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');

  // Filter
  const [ort, setOrt] = useState('');
  const [valdaKategorier, setValdaKategorier] = useState(() => new Set());
  const [minLön, setMinLön] = useState('');
  const [minDagar, setMinDagar] = useState('');
  const [sortering, setSortering] = useState('nyast');
  const [kategoriSök, setKategoriSök] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const lista = await api.hämtaAllaJobb();
        setJobb(Array.isArray(lista) ? lista : []);
      } catch (f) {
        setFel(felText(f));
      } finally {
        setLaddar(false);
      }
    })();
  }, []);

  function växlaKategori(kat) {
    setValdaKategorier((prev) => {
      const ny = new Set(prev);
      if (ny.has(kat)) ny.delete(kat);
      else ny.add(kat);
      return ny;
    });
  }

  function återställ() {
    setOrt('');
    setValdaKategorier(new Set());
    setMinLön('');
    setMinDagar('');
    setSortering('nyast');
    setKategoriSök('');
  }

  const synligaKategorier = useMemo(() => {
    const q = normalisera(kategoriSök.trim());
    if (!q) return KATEGORIER;
    return KATEGORIER.filter((k) => normalisera(k).includes(q));
  }, [kategoriSök]);

  const filtrerade = useMemo(() => {
    const ortLc = ort.trim().toLowerCase();
    const minL = minLön ? parseInt(minLön, 10) : null;
    const minD = minDagar ? parseInt(minDagar, 10) : null;

    const träffar = jobb.filter((j) => {
      if (ortLc && !(j.Plats ?? '').toLowerCase().includes(ortLc)) return false;
      if (valdaKategorier.size > 0 && !valdaKategorier.has(j.Kategori)) return false;
      if (minL != null && !(j.Lon != null && j.Lon >= minL)) return false;
      if (minD != null && !(j.antal_dagar != null && j.antal_dagar >= minD)) return false;
      return true;
    });

    const sorterad = [...träffar];
    sorterad.sort((a, b) => {
      if (sortering === 'lon') return (b.Lon ?? 0) - (a.Lon ?? 0);
      if (sortering === 'dagar') return (b.antal_dagar ?? 0) - (a.antal_dagar ?? 0);
      if (sortering === 'datum') {
        const da = förstaArbetsdatum(a.arbetstider);
        const db = förstaArbetsdatum(b.arbetstider);
        // Jobb utan datum hamnar sist.
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      }
      // nyast
      return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
    });
    return sorterad;
  }, [jobb, ort, valdaKategorier, minLön, minDagar, sortering]);

  const antalFilter =
    (ort.trim() ? 1 : 0) +
    valdaKategorier.size +
    (minLön ? 1 : 0) +
    (minDagar ? 1 : 0);

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-3xl">
        <AvtalBanner />
        <h1 className="rubrik-l text-text">Hitta jobb</h1>
          <p className="mt-1 text-[15px] text-text-dämpad">
            Bläddra bland lediga pass och sök direkt på webben.
          </p>

          {fel && <Besked typ="fel">{fel}</Besked>}

          {/* Filterpanel */}
          <div className="mt-6 rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Input
                  id="ort"
                  etikett="Ort"
                  value={ort}
                  onChange={(e) => setOrt(e.target.value)}
                  placeholder="t.ex. Stockholm"
                  list="orter"
                />
                <datalist id="orter">
                  {SVENSKA_ORTER.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </div>
              <div>
                <label
                  htmlFor="sortering"
                  className="text-[13px] font-semibold text-text-dämpad"
                >
                  Sortering
                </label>
                <select
                  id="sortering"
                  value={sortering}
                  onChange={(e) => setSortering(e.target.value)}
                  className="mt-1.5 w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3.5 text-[15px] text-text outline-none focus:border-primär focus:border-[1.5px] focus:bg-yta"
                >
                  {SORTERINGAR.map((s) => (
                    <option key={s.värde} value={s.värde}>
                      {s.etikett}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                id="minlon"
                etikett="Min timlön (kr)"
                type="number"
                inputMode="numeric"
                min="0"
                value={minLön}
                onChange={(e) => setMinLön(e.target.value)}
                placeholder="t.ex. 150"
              />
              <Input
                id="mindagar"
                etikett="Min antal dagar"
                type="number"
                inputMode="numeric"
                min="0"
                value={minDagar}
                onChange={(e) => setMinDagar(e.target.value)}
                placeholder="t.ex. 2"
              />
            </div>

            {/* Bransch (flerval) */}
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-text-dämpad">Bransch</p>
              <input
                type="text"
                value={kategoriSök}
                onChange={(e) => setKategoriSök(e.target.value)}
                placeholder="Sök bransch…"
                className="mt-1.5 w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-primär focus:border-[1.5px] focus:bg-yta"
              />
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {synligaKategorier.map((kat) => {
                  const vald = valdaKategorier.has(kat);
                  return (
                    <button
                      key={kat}
                      type="button"
                      onClick={() => växlaKategori(kat)}
                      className={`rounded-pill px-3 py-1 text-[13px] font-semibold transition-colors ${
                        vald
                          ? 'bg-primär text-white'
                          : 'bg-yta-dämpad text-text-dämpad hover:text-text'
                      }`}
                    >
                      {kat}
                    </button>
                  );
                })}
              </div>
            </div>

            {antalFilter > 0 && (
              <button
                type="button"
                onClick={återställ}
                className="mt-4 text-[14px] font-semibold text-primär hover:underline"
              >
                Återställ filter ({antalFilter})
              </button>
            )}
          </div>

          {/* Resultat */}
          {laddar ? (
            <div className="flex justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
            </div>
          ) : (
            <>
              <p className="mt-6 text-[14px] text-text-dämpad">
                {filtrerade.length} {filtrerade.length === 1 ? 'jobb' : 'jobb'}
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {filtrerade.map((j) => (
                  <JobbListKort key={j.id} jobb={j} />
                ))}
              </div>
              {filtrerade.length === 0 && (
                <p className="py-10 text-center text-[15px] text-text-dämpad">
                  Inga jobb matchar dina filter just nu.
                </p>
              )}
            </>
          )}
      </div>
    </PrivatSkal>
  );
}
