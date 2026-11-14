'use client';

// Tidrapportsektion för FÖRETAGETS chatt-tråd (/meddelanden/[ansokanId]). Speglar
// appens ChattScreen: företaget ser tidrapporten, och vid bestridande både orsaken och
// de föreslagna korrigerade tiderna, samt en knapp för att skicka en korrigerad rapport.
// Self-fetchar rapporten och refetchar på realtidssignal (Supabase Broadcast).
import { useCallback, useEffect, useState } from 'react';
import Knapp from '@/components/ui/Knapp';
import AvslutaPassModal from '@/components/app/AvslutaPassModal';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api, felText } from '@/lib/api';
import { formatDagDatum } from '@/utils/datumHelper';

function formatBelopp(kr) {
  if (kr == null) return '–';
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(kr);
}

export default function TidrapportSektionFöretag({ ansökanId, jobbTitel }) {
  const [rapport, setRapport] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const [modalVisas, setModalVisas] = useState(false);

  const hämta = useCallback(async () => {
    try {
      const r = await api.hämtaTidrapport(ansökanId);
      setRapport(r ?? null);
    } catch (f) {
      if (!f?.message?.includes('404')) setFel(felText(f));
      setRapport(null);
    } finally {
      setLaddar(false);
    }
  }, [ansökanId]);

  useEffect(() => { hämta(); }, [hämta]);
  // Privatpersonen godkänner/bestrider → backend pingar företaget → hämta om rapporten.
  useRealtidsPing(() => { hämta(); });

  if (laddar) {
    return (
      <div className="mt-3 border-t border-kant pt-3">
        <div className="h-4 w-32 animate-pulse rounded bg-yta-dämpad" />
      </div>
    );
  }

  if (!rapport) return null;

  const netto = rapport.totalt_belopp != null && rapport.avdrag_belopp != null
    ? rapport.totalt_belopp - rapport.avdrag_belopp
    : rapport.totalt_belopp;

  const statusFärg = { väntar: 'text-varning', godkänd: 'text-framgång', bestridd: 'text-fel' }[rapport.status] ?? 'text-text-dämpad';
  const statusText = {
    väntar: 'Väntar på svar från personen',
    godkänd: 'Godkänd av personen',
    bestridd: 'Bestridd – skicka en korrigerad rapport',
  }[rapport.status] ?? rapport.status;

  // En bestriden rapport rättas med en NY rapport (POST). En auto-skapad som fortfarande
  // väntar rättas på plats (korrigera). Annars finns ingen åtgärd.
  const kanKorrigeraPåPlats = rapport.auto_skapad && rapport.status === 'väntar';
  const kanSkickaKorrigerad = rapport.status === 'bestridd';

  // Syntetiserat jobb-objekt till modalen – backend räknar om alla belopp från ansökan.
  const jobbFörModal = {
    Titel: jobbTitel,
    Lon: rapport.timlon,
    paslag: rapport.paslag,
    ob_tillagg: rapport.ob_tillagg,
  };

  return (
    <div className="mt-3 border-t border-kant pt-4">
      <p className="text-[13px] font-bold uppercase tracking-wide text-text-svag">Tidrapport</p>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <p className="text-[12px] text-text-svag">Timmar</p>
          <p className="text-[15px] font-bold text-text">{rapport.timmar} h</p>
        </div>
        <div>
          <p className="text-[12px] text-text-svag">Timlön</p>
          <p className="text-[15px] font-bold text-text">{rapport.timlon} kr/h</p>
        </div>
        {rapport.ob_belopp > 0 && (
          <div>
            <p className="text-[12px] text-text-svag">OB-tillägg</p>
            <p className="text-[15px] font-bold text-text">{formatBelopp(rapport.ob_belopp)}</p>
          </div>
        )}
        {rapport.avdrag_belopp > 0 && (
          <div>
            <p className="text-[12px] text-text-svag">Löneavdrag</p>
            <p className="text-[15px] font-bold text-fel">−{formatBelopp(rapport.avdrag_belopp)}</p>
          </div>
        )}
        <div>
          <p className="text-[12px] text-text-svag">Utbetalning</p>
          <p className="text-[17px] font-bold text-primär">{formatBelopp(netto)}</p>
        </div>
      </div>

      <p className={`mt-2 text-[13px] font-semibold ${statusFärg}`}>{statusText}</p>

      {rapport.status === 'godkänd' && rapport.lonedatum && (
        <p className="mt-1 text-[13px] font-semibold text-framgång">
          Lön betalas ut {formatDagDatum(rapport.lonedatum)}
        </p>
      )}

      {/* Bestridande: visa orsak + ev. föreslagna tider, precis som appens BestriddKort. */}
      {rapport.status === 'bestridd' && (
        <div className="mt-3 rounded-sm border border-fel/30 bg-[#fef2f2] p-3">
          <p className="text-[13px] font-bold text-fel">Tidrapport bestriden</p>
          {rapport.bestridande_orsak && (
            <p className="mt-1 whitespace-pre-wrap text-[14px] text-[#7f1d1d]">{rapport.bestridande_orsak}</p>
          )}
          {rapport.bestridande_starttid && rapport.bestridande_sluttid && (
            <p className="mt-2 text-[14px] font-semibold text-[#991b1b]">
              Föreslagen tid: {rapport.bestridande_starttid}–{rapport.bestridande_sluttid}
            </p>
          )}
        </div>
      )}

      {fel && <p className="mt-3 text-[13px] text-fel">{fel}</p>}

      {(kanSkickaKorrigerad || kanKorrigeraPåPlats) && (
        <div className="mt-4">
          <Knapp variant="primär" storlek="liten" onClick={() => setModalVisas(true)}>
            {kanKorrigeraPåPlats ? 'Justera timmar' : 'Skicka korrigerad rapport'}
          </Knapp>
        </div>
      )}

      {modalVisas && (
        <AvslutaPassModal
          jobb={jobbFörModal}
          ansokanId={ansökanId}
          rubrik="Korrigerad tidrapport"
          knappText="Skicka rapport"
          // Auto-väntar rättas på plats (korrigera); en bestriden blir en ny rapport (default POST).
          onSkicka={kanKorrigeraPåPlats ? ((kropp) => api.korrigeraTidrapport(rapport.id, kropp)) : undefined}
          onStäng={() => setModalVisas(false)}
          onKlar={() => { setModalVisas(false); hämta(); }}
        />
      )}
    </div>
  );
}
