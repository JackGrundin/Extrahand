'use client';

// Privatpersonens profilsida på webben: se och redigera CV/Om mig, tidigare erfarenheter,
// kompetenser, intressen och stad, byt profilbild, hantera dokument (CV m.m.) och se mottagna
// betyg. Ligger UTANFÖR (app)-gruppen (som gatear till företag) och har en egen auth-gate –
// samma mönster som app/schema/[id]. Fälten och endpoints speglar appens RedigeraProfilScreen
// och ProfilScreen; backend är sista försvaret.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import DokumentLista from '@/components/DokumentLista';
import BetygsSektion from '@/components/BetygsSektion';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';

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
  const [profilBild, setProfilBild] = useState(null);
  const [totalTimmar, setTotalTimmar] = useState(0);
  const [dokument, setDokument] = useState([]);
  const [betyg, setBetyg] = useState(null);

  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [laddarBild, setLaddarBild] = useState(false);
  const [fel, setFel] = useState('');
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
      setProfilBild(p.profilBild ?? null);
      setTotalTimmar(p.totalTimmar ?? 0);
      setDokument(p.dokument ?? []);
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
    e.preventDefault();
    setFel('');
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
      <div className="mx-auto max-w-2xl">
          <h1 className="rubrik-l text-text">Min profil</h1>
          <p className="mt-1 text-[15px] text-text-dämpad">
            Det här ser företag när de tittar på din ansökan.
          </p>

          {fel && <Besked typ="fel">{fel}</Besked>}
          {sparat && <Besked typ="framgång">Profilen är sparad.</Besked>}

          {/* Profilbild + namn/e-post (skrivskyddat) + timmar */}
          <div className="mt-6 flex items-center gap-4">
            {profilBild ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profilBild}
                alt="Profilbild"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primär text-[28px] font-bold text-white">
                {(namn || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div>
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
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[13px] font-semibold text-text-dämpad">Namn</p>
              <p className="mt-1 text-[15px] text-text">{namn}</p>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-dämpad">E-post</p>
              <p className="mt-1 text-[15px] text-text">{email}</p>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-dämpad">Jobbade timmar</p>
              <p className="mt-1 text-[15px] text-text">{totalTimmar} h</p>
            </div>
          </div>

          <form onSubmit={spara} className="mt-6 flex flex-col gap-5">
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
            <div>
              <Input
                id="stad"
                etikett="Stad"
                value={form.stad}
                onChange={(e) => sätt('stad', e.target.value)}
                placeholder="t.ex. Stockholm"
              />
              <p className="mt-1.5 text-[12px] text-text-svag">
                Ange din stad för att få notiser om nya jobb nära dig.
              </p>
            </div>
            <Knapp type="submit" variant="primär" laddar={sparar}>
              Spara profil
            </Knapp>
          </form>

          <div className="mt-10">
            <DokumentLista dokument={dokument} onÄndrad={hämta} />
          </div>

          <div className="mt-10">
            <BetygsSektion betyg={betyg} />
          </div>
      </div>
    </PrivatSkal>
  );
}
