'use client';

// Kort för ett enstaka pass i Mina annonser. Visar titel, plats, timlön och upp till tre
// datum ur arbetstider. Badge för nya ansökningar och "Behöver avslutas" (passerat datum +
// någon godkänd). ⋯-menyn (ta bort) döljs när passet startat – ett pågående pass ska inte
// kunna tas bort under fötterna på den som jobbar.
import { useState } from 'react';
import Link from 'next/link';
import { api, felText } from '@/lib/api';
import AvslutaPassModal from '@/components/app/AvslutaPassModal';
import FältFel from '@/components/ui/FältFel';
import { parsaArbetstider, formatDagDatum, harStartat, behöverAvslutas } from '@/utils/datumHelper';

export default function JobbKort({ jobb, onÄndrad, redanAvslutad = false, onAvslutat }) {
  const [meny, setMeny] = useState(false);
  const [tarBort, setTarBort] = useState(false);
  const [görPublik, setGörPublik] = useState(false);
  // Avsluta pass: id på den godkända ansökan vi öppnat modalen för, + laddning/fel.
  const [valt, setValt] = useState(null);
  const [öppnar, setÖppnar] = useState(false);
  const [avslutaFel, setAvslutaFel] = useState('');

  const datum = (parsaArbetstider(jobb.arbetstider) ?? [])
    .map((d) => d?.datum)
    .filter(Boolean)
    .sort();
  const visade = datum.slice(0, 3);
  const extra = datum.length - visade.length;

  const startat = harStartat(jobb.arbetstider);
  const måsteAvslutas = jobb.harGodkänd && behöverAvslutas(jobb.arbetstider);
  // Visa "Avsluta pass" så fort passet är bemannat (godkänd ansökan) och ingen tidrapport
  // finns än – samma villkor som appens MinaJobbScreen.
  const kanAvsluta = jobb.harGodkänd && !redanAvslutad;

  // Slå upp jobbets godkända ansökan och öppna modalen – samma mönster som /avsluta-sidan.
  async function öppnaAvsluta() {
    setAvslutaFel('');
    setÖppnar(true);
    try {
      const ansökningar = await api.ansökningarFörJobb(jobb.id);
      const godkänd = (Array.isArray(ansökningar) ? ansökningar : []).find((a) => a.status === 'godkänd');
      if (!godkänd) {
        setAvslutaFel('Hittade ingen godkänd ansökan för passet.');
        return;
      }
      setValt(godkänd.id);
    } catch (f) {
      setAvslutaFel(felText(f));
    } finally {
      setÖppnar(false);
    }
  }

  async function taBort() {
    if (!window.confirm('Ta bort det här passet? Det går inte att ångra.')) return;
    setTarBort(true);
    try {
      await api.taBortJobb(jobb.id);
      onÄndrad?.();
    } catch (f) {
      window.alert(f?.message || 'Kunde inte ta bort passet');
    } finally {
      setTarBort(false);
      setMeny(false);
    }
  }

  async function görPublikt() {
    setGörPublik(true);
    try {
      await api.görJobbPublikt(jobb.id);
      onÄndrad?.();
    } catch (f) {
      window.alert(f?.message || 'Kunde inte göra passet publikt');
    } finally {
      setGörPublik(false);
    }
  }

  return (
    <div className="relative rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[16px] font-bold text-text">{jobb.Titel}</h3>
            {jobb.privat && (
              <span className="rounded-pill border border-varning-kant bg-varning-mjuk px-2 py-0.5 text-[11px] font-bold text-varning-text">
                Privat
              </span>
            )}
          </div>
          <p className="text-[14px] text-text-dämpad">{jobb.Plats}</p>
        </div>
        {!startat && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMeny((v) => !v)}
              aria-label="Fler val"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-text-dämpad hover:bg-yta-dämpad"
            >
              ⋯
            </button>
            {meny && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-sm border border-kant bg-yta shadow-lyft">
                {/* Redigera går bara innan någon godkänts – då har ingen tackat ja till
                    villkoren annonsen beskriver. */}
                {!jobb.harGodkänd && (
                  <Link
                    href={`/redigera/jobb/${jobb.id}`}
                    className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-text hover:bg-yta-dämpad"
                  >
                    Redigera
                  </Link>
                )}
                <button
                  type="button"
                  disabled={tarBort}
                  onClick={taBort}
                  className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-fel hover:bg-fel-mjuk disabled:opacity-60"
                >
                  {tarBort ? 'Tar bort…' : 'Ta bort'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-bold text-primär">{Math.round(Number(jobb.Lon))} kr/tim</span>
        {visade.map((d) => (
          <span key={d} className="rounded-pill bg-yta-dämpad px-2.5 py-0.5 text-[12px] font-semibold text-text-dämpad">
            {formatDagDatum(d)}
          </span>
        ))}
        {extra > 0 && <span className="text-[12px] font-semibold text-text-svag">+{extra}</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {jobb.nyaAnsökningar > 0 && (
          <span className="rounded-pill bg-primär-mjuk px-2.5 py-1 text-[12px] font-bold text-primär">
            {jobb.nyaAnsökningar} {jobb.nyaAnsökningar === 1 ? 'ny ansökan' : 'nya ansökningar'}
          </span>
        )}
        {måsteAvslutas && (
          <span className="rounded-pill bg-varning-mjuk px-2.5 py-1 text-[12px] font-bold text-varning-text">
            Behöver avslutas
          </span>
        )}
        {/* Tackade den inbjudne nej? Gör passet publikt igen – men bara innan någon godkänts. */}
        {jobb.privat && !jobb.harGodkänd && (
          <button
            type="button"
            disabled={görPublik}
            onClick={görPublikt}
            className="rounded-pill border border-kant px-2.5 py-1 text-[12px] font-semibold text-text-dämpad hover:border-kant-stark hover:text-text disabled:opacity-60"
          >
            {görPublik ? 'Gör publikt…' : 'Gör publikt'}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/annonser/jobb/${jobb.id}/ansokningar`}
          className="text-[14px] font-semibold text-primär hover:underline"
        >
          Se ansökningar →
        </Link>
        {kanAvsluta && (
          <button
            type="button"
            disabled={öppnar}
            onClick={öppnaAvsluta}
            className="shrink-0 rounded-sm bg-gradient-primär px-4 py-2 text-[14px] font-bold text-white shadow-mjuk transition-shadow hover:shadow-lyft disabled:opacity-60"
          >
            {öppnar ? 'Öppnar…' : 'Avsluta pass'}
          </button>
        )}
      </div>

      {avslutaFel && <FältFel>{avslutaFel}</FältFel>}

      {valt && (
        <AvslutaPassModal
          jobb={jobb}
          ansokanId={valt}
          onStäng={() => setValt(null)}
          onKlar={() => {
            setValt(null);
            onAvslutat?.(jobb.Titel);
            onÄndrad?.();
          }}
        />
      )}
    </div>
  );
}
