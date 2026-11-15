'use client';

// Företagsprofil: skapa/redigera den information som visas för sökande (och på den publika
// profilen i appen). Fälten speglar appens RedigeraProfilScreen för företag: beskrivning,
// bransch, stad och hemsida. Profilbilden laddas upp som base64 via backend-proxyn
// (POST /users/profil-bild → Supabase Storage). Namn och e-post sätts vid registrering och
// visas här skrivskyddat. Fakturauppgifter ändras inte via profil-API:t.
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import StadInput from '@/components/app/StadInput';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';
import { ärGiltigStad } from '@/utils/stad';

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
  const [stadFel, setStadFel] = useState('');
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
    setStadFel('');
    // Frivillig stad, men en ifylld stad måste väljas ur SVENSKA_ORTER – fri text splittrar
    // stadsmatchningen i backend.
    if (form.stad.trim() && !ärGiltigStad(form.stad)) {
      setStadFel('Välj en stad från listan');
      return;
    }
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
    <div className="mx-auto max-w-5xl">
      <h1 className="rubrik-l text-text">Företagsprofil</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">Det här ser sökande när de tittar på era annonser.</p>

      {fel && <Besked typ="fel">{fel}</Besked>}
      {sparat && <Besked typ="framgång">Profilen är sparad.</Besked>}

      <form onSubmit={spara} className="mt-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Vänsterkolumn: profilkort med avatar, namn, e-post och bildbyte */}
          <div className="h-fit rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
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
              {/* truncate: en lång e-post får inte bryta ut ur kortet på smala skärmar. */}
              <p className="mt-0.5 truncate text-[13px] text-text-svag">{email}</p>
            </div>

            <div className="mt-4 flex flex-col items-center">
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

          {/* Mittkolumn: Om företaget */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="rounded-lg border border-kant bg-yta p-6 shadow-mjuk">
              <h2 className="överlinje mb-4">Om företaget</h2>
              <div className="flex flex-col gap-5">
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
                <StadInput
                  värde={form.stad}
                  onVälj={(v) => { sätt('stad', v); setStadFel(''); }}
                  fel={stadFel}
                />
                {/* Ingen type="url": webbläsarens inbyggda url-validering kräver ett schema (https://)
                    och blockerar HELA formulärets submit för vanliga värden som "www.foretaget.se",
                    så profilen gick inte att spara. Hemsidan är fri text; backend är validerare. */}
                <Input
                  etikett="Hemsida"
                  inputMode="url"
                  value={form.hemsida}
                  onChange={(e) => sätt('hemsida', e.target.value)}
                  placeholder="t.ex. www.foretaget.se"
                />
              </div>
            </div>

            <Knapp type="submit" variant="primär" laddar={sparar}>
              Spara profil
            </Knapp>
          </div>
        </div>
      </form>
    </div>
  );
}
