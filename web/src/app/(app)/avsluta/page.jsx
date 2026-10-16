'use client';

// "Avsluta pass": listar de pass som behöver avslutas (sista sluttiden har passerat och
// någon blev godkänd, men ingen tidrapport finns än) och låter företaget stänga vart och
// ett – fylla i jobbade timmar via AvslutaPassModal. Härledningen är EXAKT densamma som
// dashboardens "Pass att avsluta" och appens AttAvslutaContext.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Besked from '@/components/ui/Besked';
import AvslutaPassModal from '@/components/app/AvslutaPassModal';
import { api, felText } from '@/lib/api';
import { behöverAvslutas, parsaArbetstider, formatDagDatum } from '@/utils/datumHelper';

export default function AvslutaPass() {
  const [data, setData] = useState(null);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);
  // Vilket jobb vi håller på att avsluta + dess godkända ansökan.
  const [valt, setValt] = useState(null); // { jobb, ansokanId }
  const [öppnar, setÖppnar] = useState(null); // jobb-id som vi hämtar ansökan för

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const [jobb, tidigare, rapporter] = await Promise.all([
        api.minaJobb(),
        api.minaTidigareJobb(),
        api.tidrapporterFörFöretag(),
      ]);
      setData({ jobb, tidigare, rapporter });
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  const attAvsluta = useMemo(() => {
    if (!data) return [];
    const avslutadeJobbIds = new Set((data.rapporter ?? []).map((r) => r.jobbId).filter(Boolean));
    return [...(data.jobb ?? []), ...(data.tidigare ?? [])].filter(
      (j) => !avslutadeJobbIds.has(j.id) && behöverAvslutas(j.arbetstider) && j.harGodkänd
    );
  }, [data]);

  // Öppna modalen: hämta jobbets godkända ansökan och plocka dess id.
  async function öppna(jobb) {
    setFel('');
    setÖppnar(jobb.id);
    try {
      const ansökningar = await api.ansökningarFörJobb(jobb.id);
      const godkänd = (Array.isArray(ansökningar) ? ansökningar : []).find((a) => a.status === 'godkänd');
      if (!godkänd) {
        setFel('Hittade ingen godkänd ansökan för passet.');
        return;
      }
      setValt({ jobb, ansokanId: godkänd.id });
    } catch (f) {
      setFel(felText(f));
    } finally {
      setÖppnar(null);
    }
  }

  function datumText(jobb) {
    const datum = (parsaArbetstider(jobb.arbetstider) ?? []).map((d) => d?.datum).filter(Boolean).sort();
    if (datum.length === 0) return null;
    return datum.length === 1 ? formatDagDatum(datum[0]) : `${formatDagDatum(datum[0])} – ${formatDagDatum(datum[datum.length - 1])}`;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/oversikt" className="text-[14px] font-semibold text-text-dämpad hover:text-text">
        ← Översikt
      </Link>
      <h1 className="mt-3 rubrik-l text-text">Avsluta pass</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">
        Fyll i jobbade timmar så skapas tidrapporten. Beloppet räknas ut automatiskt.
      </p>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {laddar ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : attAvsluta.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga pass att avsluta just nu.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {attAvsluta.map((jobb) => (
            <li
              key={jobb.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-kant bg-yta p-4 shadow-mjuk"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-text">{jobb.Titel}</p>
                <p className="text-[13px] text-text-dämpad">
                  {[datumText(jobb), jobb.Lon ? `${jobb.Lon} kr/tim` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                disabled={öppnar === jobb.id}
                onClick={() => öppna(jobb)}
                className="shrink-0 rounded-sm bg-gradient-primär px-4 py-2.5 text-[14px] font-bold text-white shadow-mjuk transition-shadow hover:shadow-lyft disabled:opacity-60"
              >
                {öppnar === jobb.id ? 'Öppnar…' : 'Avsluta pass'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {valt && (
        <AvslutaPassModal
          jobb={valt.jobb}
          ansokanId={valt.ansokanId}
          onStäng={() => setValt(null)}
          onKlar={() => {
            setValt(null);
            hämta();
          }}
        />
      )}
    </div>
  );
}
