'use client';

// Privatpersonens profilsida på webben: se och redigera CV/Om mig, tidigare erfarenheter,
// kompetenser, intressen och stad, byt profilbild, hantera dokument (CV m.m.) och se mottagna
// betyg. Ligger UTANFÖR (app)-gruppen (som gatear till företag) och har en egen auth-gate –
// samma mönster som app/schema/[id]. Fälten och endpoints speglar appens RedigeraProfilScreen
// och ProfilScreen; backend är sista försvaret.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import StadInput from '@/components/app/StadInput';
import DokumentLista from '@/components/DokumentLista';
import BetygsSektion from '@/components/BetygsSektion';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';
import { ärGiltigStad } from '@/utils/stad';

const MAX_BILD_BYTES = 3 * 1024 * 1024;

export default function MinProfil() {
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare, uppdateraAnvändare } = useAuth();
  const filInput = useRef(null);

  const [form, setForm] = useState({
    cv: '',
    erfarenheter: '',
    kompetenser: '',
    intressen: '',
    stad: '',
  });
  // Företagsfält bevaras oförändrade: PUT /users/profil nollar varje fält som inte skickas.
  const bevarade = useRef({ beskrivning: null, bransch: null, hemsida: null });

  const [namn, setNamn] = useState('');
  const [email, setEmail] = useState('');
  const [ålder, setÅlder] = useState(null);
  const [profilBild, setProfilBild] = useState(null);
  const [totalTimmar, setTotalTimmar] = useState(0);
  const [dokument, setDokument] = useState([]);
  const [betyg, setBetyg] = useState(null);
  // Utbetalningsinställning ('direkt'/'25'): sparas direkt vid val, utanför "Spara profil".
  const [utbetalning, setUtbetalning] = useState('direkt');
  const [spararUtbetalning, setSpararUtbetalning] = useState(false);

  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [laddarBild, setLaddarBild] = useState(false);
  const [fel, setFel] = useState('');
  const [stadFel, setStadFel] = useState('');
  const [sparat, setSparat] = useState(false);

  // Auth-gate: utloggad → inloggning med next tillbaka hit; företag → sin egen profil.
  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent('/min-profil')}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/profil');
    }
  }, [authLaddar, inloggad, användare, router]);

  const hämta = useCallback(async () => {
    try {
      const p = await api.hämtaProfil();
      setForm({
        cv: p.cv ?? '',
        erfarenheter: p.erfarenheter ?? '',
        kompetenser: p.kompetenser ?? '',
        intressen: p.intressen ?? '',
        stad: p.stad ?? '',
      });
      bevarade.current = {
        beskrivning: p.beskrivning ?? null,
        bransch: p.bransch ?? null,
        hemsida: p.hemsida ?? null,
      };
      setNamn(p.namn ?? '');
      setEmail(p.email ?? '');
      setÅlder(p.alder ?? null);
      setProfilBild(p.profilBild ?? null);
      setTotalTimmar(p.totalTimmar ?? 0);
      setDokument(p.dokument ?? []);
      setUtbetalning(p.utbetalningInstallning ?? 'direkt');
      // Betyg i egen try/catch – får inte sänka hela sidan.
      try {
        setBetyg(await api.hämtaBetyg(p.id));
      } catch {
        setBetyg(null);
      }
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    if (!authLaddar && inloggad && användare?.typ !== 'företag') hämta();
  }, [authLaddar, inloggad, användare, hämta]);

  function sätt(nyckel, värde) {
    setForm((f) => ({ ...f, [nyckel]: värde }));
    setSparat(false);
  }

  async function spara(e) {
    e?.preventDefault?.();
    setFel('');
    setStadFel('');
    // Stad är frivillig, men en ifylld stad måste väljas ur SVENSKA_ORTER – fri text splittrar
    // stadsmatchningen så att jobbnotiser missar folk.
    if (form.stad.trim() && !ärGiltigStad(form.stad)) {
      setStadFel('Välj en stad från listan');
      return;
    }
    setSparat(false);
    setSparar(true);
    try {
      await api.uppdateraProfil({
        cv: form.cv,
        erfarenheter: form.erfarenheter,
        kompetenser: form.kompetenser,
        intressen: form.intressen,
        stad: form.stad,
        // Bevara företagsfälten så att PUT inte nollar dem.
        beskrivning: bevarade.current.beskrivning,
        bransch: bevarade.current.bransch,
        hemsida: bevarade.current.hemsida,
      });
      setSparat(true);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSparar(false);
    }
  }

  async function väljBild(e) {
    const fil = e.target.files?.[0];
    if (!fil) return;
    if (fil.size > MAX_BILD_BYTES) {
      setFel('Bilden är för stor (max 3 MB)');
      return;
    }
    setFel('');
    setLaddarBild(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const läsare = new FileReader();
        läsare.onload = () => resolve(läsare.result);
        läsare.onerror = () => reject(new Error('Kunde inte läsa filen'));
        läsare.readAsDataURL(fil);
      });
      const { url } = await api.laddaUppProfilBild(dataUrl);
      // Cache-bust: filnamnet är <id>.jpg med upsert, så URL:en är oförändrad.
      const visningsUrl = url ? `${url}?t=${Date.now()}` : url;
      setProfilBild(visningsUrl);
      uppdateraAnvändare({ profilBild: visningsUrl });
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddarBild(false);
      if (filInput.current) filInput.current.value = '';
    }
  }

  // Byter utbetalningsinställning. Sparas direkt (optimistiskt) via samma PUT /users/profil;
  // backend gör en partiell update så övriga profilfält inte rörs.
  async function väljUtbetalning(val) {
    if (val === utbetalning || spararUtbetalning) return;
    const föregående = utbetalning;
    setUtbetalning(val);
    setSpararUtbetalning(true);
    setFel('');
    try {
      await api.uppdateraProfil({ utbetalning_installning: val });
    } catch (f) {
      setUtbetalning(föregående);
      setFel(felText(f));
    } finally {
      setSpararUtbetalning(false);
    }
  }

  // Medan auth kontrolleras / vi omdirigerar bort ett företag: visa bara spinnern.
  if (authLaddar || !inloggad || användare?.typ === 'företag' || laddar) {
    return (
      <PrivatSkal>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      </PrivatSkal>
    );
  }

  return (
    <PrivatSkal>
      <div className="mx-auto max-w-5xl">
        {/* Sidhuvud (full bredd) */}
        <h1 className="rubrik-l text-text">Min profil</h1>
        <p className="mt-1 text-[15px] text-text-dämpad">
          Det här ser företag när de tittar på din ansökan.
        </p>

        {fel && <Besked typ="fel">{fel}</Besked>}
        {sparat && <Besked typ="framgång">Profilen är sparad.</Besked>}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_300px]">
          {/* Vänsterkolumn: profilkort + dokument + utbetalning */}
          <div className="flex flex-col gap-6">
            {/* Profilkort */}
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              {profilBild ? (
                <Image
                  src={profilBild}
                  alt="Profilbild"
                  width={112}
                  height={112}
                  className="mx-auto h-28 w-28 rounded-full object-cover"
                />
              ) : (
                <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-primär text-[40px] font-bold text-white">
                  {(namn || '?').charAt(0).toUpperCase()}
                </span>
              )}

              <div className="mt-4 text-center">
                <p className="text-[18px] font-bold text-text">{namn}</p>
                {form.stad && (
                  <p className="mt-0.5 text-[14px] text-text-dämpad">{form.stad}</p>
                )}
                <p className="mt-0.5 truncate text-[13px] text-text-svag">{email}</p>
              </div>

              <div className="mt-4 flex flex-col items-center">
                <input
                  ref={filInput}
                  type="file"
                  accept="image/*"
                  onChange={väljBild}
                  className="hidden"
                />
                <Knapp
                  variant="kontur"
                  storlek="liten"
                  laddar={laddarBild}
                  onClick={() => filInput.current?.click()}
                >
                  Byt bild
                </Knapp>
                <p className="mt-1 text-[12px] text-text-svag">JPG eller PNG, max 3 MB</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {ålder != null && (
                  <div className="rounded-md border border-kant p-3 text-center">
                    <p className="text-[12px] font-semibold text-text-dämpad">Ålder</p>
                    <p className="mt-1 text-[18px] font-bold text-text">{ålder} år</p>
                  </div>
                )}
                <div className="rounded-md border border-kant p-3 text-center">
                  <p className="text-[12px] font-semibold text-text-dämpad">Jobbade timmar</p>
                  <p className="mt-1 text-[18px] font-bold text-text">{totalTimmar} h</p>
                </div>
              </div>
            </div>

            {/* Dokument (DokumentLista renderar egen rubrik) */}
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <DokumentLista dokument={dokument} onÄndrad={hämta} />
            </div>

            {/* Utbetalning */}
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <h2 className="överlinje mb-1">Utbetalning</h2>
              <p className="mb-4 text-[14px] text-text-dämpad">Välj när du vill ha din lön utbetald.</p>
              <div className="flex flex-col gap-3">
                {[
                  { nyckel: 'direkt', rubrik: 'Direkt', beskrivning: 'Din löneutbetalning startar inom 1 arbetsdag' },
                  { nyckel: '25', rubrik: 'Den 25:e varje månad', beskrivning: 'Månadens pass samlas till en utbetalning den 25:e' },
                ].map((val) => {
                  const aktiv = utbetalning === val.nyckel;
                  return (
                    <button
                      key={val.nyckel}
                      type="button"
                      onClick={() => väljUtbetalning(val.nyckel)}
                      disabled={spararUtbetalning}
                      aria-pressed={aktiv}
                      className={`flex items-start gap-3 rounded-md border p-4 text-left transition-colors disabled:opacity-60 ${
                        aktiv ? 'border-primär bg-primär-mjuk' : 'border-kant hover:border-kant-stark'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                          aktiv ? 'border-primär' : 'border-kant-stark'
                        }`}
                      >
                        {aktiv && <span className="h-2.5 w-2.5 rounded-full bg-primär" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[15px] font-semibold ${aktiv ? 'text-primär' : 'text-text'}`}>
                          {val.rubrik}
                        </span>
                        <span className="block text-[13px] text-text-svag">{val.beskrivning}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mittkolumn: Om dig + Kompetenser & intressen + Spara */}
          <div className="flex min-w-0 flex-col gap-6">
            {/* Om dig */}
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <h2 className="överlinje mb-4">Om dig</h2>
              <div className="flex flex-col gap-5">
                <Textfält
                  id="cv"
                  etikett="CV / Om mig"
                  value={form.cv}
                  onChange={(e) => sätt('cv', e.target.value)}
                  placeholder="Berätta om dig själv…"
                />
                <Textfält
                  id="erfarenheter"
                  etikett="Tidigare erfarenheter"
                  value={form.erfarenheter}
                  onChange={(e) => sätt('erfarenheter', e.target.value)}
                  placeholder="t.ex. Jobbade som städare 2023…"
                />
                <div>
                  <StadInput
                    värde={form.stad}
                    onVälj={(v) => { sätt('stad', v); setStadFel(''); }}
                    fel={stadFel}
                  />
                  <p className="mt-1.5 text-[12px] text-text-svag">
                    Ange din stad för att få notiser om nya jobb nära dig.
                  </p>
                </div>
              </div>
            </div>

            {/* Kompetenser & intressen */}
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <h2 className="överlinje mb-4">Kompetenser &amp; intressen</h2>
              <div className="flex flex-col gap-5">
                <Input
                  id="kompetenser"
                  etikett="Kompetenser"
                  value={form.kompetenser}
                  onChange={(e) => sätt('kompetenser', e.target.value)}
                  placeholder="t.ex. Körkort, Snickeri, Matlagning"
                />
                <Input
                  id="intressen"
                  etikett="Intressen"
                  value={form.intressen}
                  onChange={(e) => sätt('intressen', e.target.value)}
                  placeholder="t.ex. Friluftsliv, Musik, Djur"
                />
              </div>
            </div>

            <Knapp variant="primär" laddar={sparar} onClick={spara}>
              Spara profil
            </Knapp>
          </div>

          {/* Högerkolumn: Recensioner (BetygsSektion renderar egen rubrik) */}
          <div className="flex flex-col gap-6">
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <BetygsSektion betyg={betyg} />
            </div>
          </div>
        </div>
      </div>
    </PrivatSkal>
  );
}
