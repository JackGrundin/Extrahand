'use client';

// Företagsprofil: skapa/redigera den information som visas för sökande (och på den publika
// profilen i appen). Fälten speglar appens RedigeraProfilScreen för företag: beskrivning,
// bransch, stad och hemsida. Profilbilden laddas upp som base64 via backend-proxyn
// (POST /users/profil-bild → Supabase Storage). Namn och e-post sätts vid registrering och
// visas här skrivskyddat. Fakturauppgifter ändras inte via profil-API:t.
import { useEffect, useRef, useState } from 'react';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';

const MAX_BILD_BYTES = 3 * 1024 * 1024;

export default function Profil() {
  const { uppdateraAnvändare } = useAuth();
  const filInput = useRef(null);

  const [form, setForm] = useState({ beskrivning: '', bransch: '', stad: '', hemsida: '' });
  const [namn, setNamn] = useState('');
  const [email, setEmail] = useState('');
  const [profilBild, setProfilBild] = useState(null);

  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [laddarBild, setLaddarBild] = useState(false);
  const [fel, setFel] = useState('');
  const [sparat, setSparat] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.hämtaProfil();
        setForm({
          beskrivning: p.beskrivning ?? '',
          bransch: p.bransch ?? '',
          stad: p.stad ?? '',
          hemsida: p.hemsida ?? '',
        });
        setNamn(p.namn ?? '');
        setEmail(p.email ?? '');
        setProfilBild(p.profilBild ?? null);
      } catch (f) {
        setFel(felText(f));
      } finally {
        setLaddar(false);
      }
    })();
  }, []);

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
        beskrivning: form.beskrivning,
        bransch: form.bransch,
        stad: form.stad,
        hemsida: form.hemsida,
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
      // Cache-bust: filnamnet är <id>.jpg med upsert, så URL:en är oförändrad – utan detta
      // visar webbläsaren den gamla bilden.
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

  if (laddar) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="rubrik-l text-text">Företagsprofil</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">Det här ser sökande när de tittar på era annonser.</p>

      {fel && <Besked typ="fel">{fel}</Besked>}
      {sparat && <Besked typ="framgång">Profilen är sparad.</Besked>}

      {/* Profilbild */}
      <div className="mt-6 flex items-center gap-4">
        {profilBild ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profilBild} alt="Profilbild" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primär text-[28px] font-bold text-white">
            {(namn || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <input ref={filInput} type="file" accept="image/*" onChange={väljBild} className="hidden" />
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

      {/* Namn + e-post (skrivskyddat) */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-semibold text-text-dämpad">Företagsnamn</p>
          <p className="mt-1 text-[15px] text-text">{namn}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-text-dämpad">E-post</p>
          <p className="mt-1 text-[15px] text-text">{email}</p>
        </div>
      </div>

      <form onSubmit={spara} className="mt-6 flex flex-col gap-5">
        <Textfält
          etikett="Om företaget"
          value={form.beskrivning}
          onChange={(e) => sätt('beskrivning', e.target.value)}
          placeholder="Berätta om företaget – vad ni gör och hur det är att jobba hos er."
        />
        <Input
          etikett="Bransch"
          value={form.bransch}
          onChange={(e) => sätt('bransch', e.target.value)}
          placeholder="t.ex. Restaurang, Bygg, Städ"
        />
        <Input
          etikett="Stad"
          value={form.stad}
          onChange={(e) => sätt('stad', e.target.value)}
          placeholder="t.ex. Stockholm"
        />
        <Input
          etikett="Hemsida"
          type="url"
          value={form.hemsida}
          onChange={(e) => sätt('hemsida', e.target.value)}
          placeholder="t.ex. www.foretaget.se"
        />
        <Knapp type="submit" variant="primär" laddar={sparar}>
          Spara profil
        </Knapp>
      </form>
    </div>
  );
}
