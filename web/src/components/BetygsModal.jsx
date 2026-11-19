'use client';

// Global betygsprompt för webben. Monteras EN gång i root-layouten (inuti RealtidsProvider),
// så den kan dyka upp oavsett vilken sida den inloggade befinner sig på – precis som appen
// monterar betygsprompten i App.js. Kollapsar appens BetygsContext + BetygModal till en
// självständig komponent: webben behöver ingen context eftersom inget annat ställe triggar
// prompten manuellt.
//
// Underlaget är GET /api/betyg/vantande, som redan grupperar ett schema till ETT uppdrag –
// här görs ingen egen gruppering. Visas för BÅDA parter: företaget betygsätter personen,
// personen betygsätter uppdraget. "Hoppa över" är ett riktigt val och sparas lokalt (bara
// i localStorage), annars hade prompten tjatat om samma pass vid varje sidladdning.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRealtidsPing } from '@/context/RealtidsContext';
import { api } from '@/lib/api';
import Knapp from '@/components/ui/Knapp';

const NYCKEL = 'fastgig.betyg.hoppadeOver';

// Läser skip-listan ur localStorage → ett Set av ansokanId-strängar. Tolerant mot trasig data.
function läsHoppade() {
  if (typeof window === 'undefined') return new Set();
  try {
    const rått = window.localStorage.getItem(NYCKEL);
    const lista = rått ? JSON.parse(rått) : [];
    return new Set(Array.isArray(lista) ? lista.map(String) : []);
  } catch {
    return new Set();
  }
}

export default function BetygsModal() {
  const { inloggad, användare } = useAuth();
  const ärFöretag = användare?.typ === 'företag';

  const [kö, setKö] = useState([]);
  const [visas, setVisas] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [stjarnor, setStjarnor] = useState(0);
  const [kommentar, setKommentar] = useState('');

  // Skip-listan hålls i en ref så hämtningen aldrig läser en inaktuell closure. Seedas lazily
  // på klienten (localStorage finns inte under server-rendering).
  const hoppadeRef = useRef(null);
  if (hoppadeRef.current == null && typeof window !== 'undefined') {
    hoppadeRef.current = läsHoppade();
  }

  const aktuell = kö[0] ?? null;

  const kollaBetyg = useCallback(async () => {
    if (!inloggad || hoppadeRef.current == null) return;
    try {
      const väntande = await api.väntandeBetyg();
      const kvar = (Array.isArray(väntande) ? väntande : []).filter(
        (p) => !hoppadeRef.current.has(String(p.ansokanId))
      );
      setKö(kvar);
      setVisas(kvar.length > 0);
    } catch {
      // Tyst: prompten är en påminnelse, inte något användaren bad om. Ett nätverksfel här
      // ska inte ge en felruta mitt i något annat.
    }
  }, [inloggad]);

  // Kör vid inloggning; nollställ kön vid utloggning.
  useEffect(() => {
    if (!inloggad) {
      setKö([]);
      setVisas(false);
      return;
    }
    kollaBetyg();
  }, [inloggad, kollaBetyg]);

  // Realtid: 'tidrapport' = motparten godkände just rapporten, 'betyg' = någon betygsatte oss
  // (uppdraget kan vara avslutat i den andra änden). Övriga pingar är ovidkommande.
  useRealtidsPing((payload) => {
    if (payload?.typ === 'tidrapport' || payload?.typ === 'betyg') kollaBetyg();
  });

  // Nollställ fälten mellan poster – annars följer stjärnorna från förra passet med in i nästa.
  useEffect(() => {
    setStjarnor(0);
    setKommentar('');
  }, [aktuell?.ansokanId]);

  // Räknas ut utanför setKö-uppdateraren: en state-uppdaterare får inte ha sidoeffekter,
  // React kan köra den två gånger.
  function tillNästa() {
    const kvar = kö.slice(1);
    setKö(kvar);
    setVisas(kvar.length > 0);
  }

  async function skicka() {
    if (!aktuell || stjarnor < 1) return;
    setSparar(true);
    try {
      await api.sättaBetyg(aktuell.ansokanId, {
        stjarnor,
        kommentar: kommentar.trim() || undefined,
      });
      tillNästa();
    } catch (fel) {
      // 409 = redan betygsatt, t.ex. från en annan inloggad session. Det är inget fel för
      // användaren, uppdraget är klart – gå vidare i stället för att visa en felruta.
      if (fel?.status === 409 || /redan betygsatt/i.test(fel?.message ?? '')) tillNästa();
      else setVisas(false);
    } finally {
      setSparar(false);
    }
  }

  function hoppaÖver() {
    if (!aktuell) return;
    const id = String(aktuell.ansokanId);
    const ny = new Set(hoppadeRef.current);
    ny.add(id);
    hoppadeRef.current = ny;
    // Bara lokalt: det här är en UI-preferens, inte något servern behöver veta.
    try {
      window.localStorage.setItem(NYCKEL, JSON.stringify([...ny]));
    } catch {}
    const kvar = kö.filter((p) => String(p.ansokanId) !== id);
    setKö(kvar);
    setVisas(kvar.length > 0);
  }

  if (!visas || !aktuell) return null;

  const rubrik = ärFöretag
    ? `Hur gick det med ${aktuell.motpartNamn ?? 'personen'}?`
    : `Hur var uppdraget hos ${aktuell.motpartNamn ?? 'företaget'}?`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-lg border border-kant bg-yta p-6 shadow-lyft">
        <h2 className="rubrik-m text-center text-text">{rubrik}</h2>
        {aktuell.jobbTitel ? (
          <p className="mt-1 text-center text-[14px] text-text-dämpad">{aktuell.jobbTitel}</p>
        ) : null}

        {/* Stjärnväljare 1–5 */}
        <div className="mt-5 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStjarnor(n)}
              aria-label={`${n} ${n === 1 ? 'stjärna' : 'stjärnor'}`}
              aria-pressed={n <= stjarnor}
              className="text-3xl leading-none text-[#f5b301] transition-transform hover:scale-110"
            >
              {n <= stjarnor ? '★' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          placeholder="Kommentar (valfritt)"
          rows={3}
          className="mt-5 w-full resize-none rounded-sm border border-kant bg-bakgrund px-3 py-2 text-[15px] text-text placeholder:text-text-dämpad focus:border-primär focus:outline-none"
        />

        <div className="mt-5">
          <Knapp variant="primär" full onClick={skicka} disabled={stjarnor < 1} laddar={sparar}>
            Skicka betyg
          </Knapp>
        </div>

        <button
          type="button"
          onClick={hoppaÖver}
          disabled={sparar}
          className="mt-3 w-full text-center text-[14px] font-medium text-text-dämpad hover:text-text disabled:opacity-60"
        >
          Hoppa över
        </button>
      </div>
    </div>
  );
}
