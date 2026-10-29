'use client';

// Tidrapportsektion för privatpersonens "Mina pass" – visas under genomförda pass.
// Hämtar rapporten för ansökan, visar belopp/timmar och låter personen godkänna
// eller bestrida. Speglar ChattScreens tidrapportskort i appen.
import { useCallback, useEffect, useState } from 'react';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

function formatBelopp(kr) {
  if (kr == null) return '–';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(kr);
}

export default function TidrapportSektion({ ansökanId }) {
  const [rapport, setRapport] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const [besked, setBesked] = useState('');

  // Bestridandeläge
  const [bestriderVis, setBestriderVis] = useState(false);
  const [orsak, setOrsak] = useState('');
  const [skickar, setSkickar] = useState(false);

  const hämta = useCallback(async () => {
    setLaddar(true);
    setFel('');
    try {
      const r = await api.hämtaTidrapport(ansökanId);
      setRapport(r ?? null);
    } catch (f) {
      // 404 = ingen rapport ännu, det är OK
      if (!f?.message?.includes('404')) setFel(felText(f));
      setRapport(null);
    } finally {
      setLaddar(false);
    }
  }, [ansökanId]);

  useEffect(() => {
    hämta();
  }, [hämta]);

  async function godkänn() {
    setSkickar(true);
    setFel('');
    try {
      await api.godkännRapport(rapport.id);
      setBesked('Tidrapporten är godkänd! 🎉');
      setRapport((prev) => ({ ...prev, status: 'godkänd' }));
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickar(false);
    }
  }

  async function bestrida() {
    if (!orsak.trim()) {
      setFel('Du måste skriva en förklaring till bestridandet.');
      return;
    }
    setSkickar(true);
    setFel('');
    try {
      await api.bestridaRapport(rapport.id, orsak.trim());
      setBesked('Bestridandet är skickat. Företaget får ett meddelande.');
      setRapport((prev) => ({ ...prev, status: 'bestridd' }));
      setBestriderVis(false);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickar(false);
    }
  }

  if (laddar) {
    return (
      <div className="mt-3 border-t border-kant pt-3">
        <div className="h-4 w-32 animate-pulse rounded bg-yta-dämpad" />
      </div>
    );
  }

  if (!rapport) return null;

  // Netto = brutto minus löneavdrag
  const netto =
    rapport.totalt_belopp != null && rapport.avdrag_belopp != null
      ? rapport.totalt_belopp - rapport.avdrag_belopp
      : rapport.totalt_belopp;

  const statusFärg = {
    väntar: 'text-varning',
    godkänd: 'text-framgång',
    bestridd: 'text-fel',
  }[rapport.status] ?? 'text-text-dämpad';

  const statusText = {
    väntar: 'Väntar på ditt svar',
    godkänd: 'Godkänd av dig',
    bestridd: 'Bestridd – väntar på ny rapport',
  }[rapport.status] ?? rapport.status;

  return (
    <div className="mt-3 border-t border-kant pt-4">
      <p className="text-[13px] font-bold uppercase tracking-wide text-text-svag">
        Tidrapport
      </p>

      {/* Belopps-rad */}
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

      {/* Status */}
      <p className={`mt-2 text-[13px] font-semibold ${statusFärg}`}>{statusText}</p>

      {/* Feedback */}
      {fel && <div className="mt-3"><Besked typ="fel">{fel}</Besked></div>}
      {besked && <div className="mt-3"><Besked typ="framgång">{besked}</Besked></div>}

      {/* Knappar – bara om rapporten väntar */}
      {rapport.status === 'väntar' && !besked && (
        <>
          {!bestriderVis ? (
            <div className="mt-4 flex gap-3">
              <Knapp
                variant="primär"
                storlek="liten"
                onClick={godkänn}
                laddar={skickar}
              >
                Godkänn
              </Knapp>
              <Knapp
                variant="kontur"
                storlek="liten"
                onClick={() => { setBestriderVis(true); setFel(''); }}
              >
                Bestrida
              </Knapp>
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-[13px] font-semibold text-text-dämpad">
                Förklaring till bestridandet
              </label>
              <textarea
                value={orsak}
                onChange={(e) => setOrsak(e.target.value)}
                rows={3}
                placeholder="Beskriv vad som är fel – t.ex. fel antal timmar eller att du inte jobbade detta pass."
                className="mt-1.5 w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[14px] text-text outline-none focus:border-primär focus:border-[1.5px] focus:bg-yta"
              />
              <div className="mt-3 flex gap-3">
                <Knapp
                  variant="fara"
                  storlek="liten"
                  onClick={bestrida}
                  laddar={skickar}
                >
                  Skicka bestridande
                </Knapp>
                <Knapp
                  variant="kontur"
                  storlek="liten"
                  onClick={() => { setBestriderVis(false); setFel(''); }}
                >
                  Avbryt
                </Knapp>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
