'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthSkal from '@/components/AuthSkal';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { felText } from '@/lib/api';

// Speglar MIN_LÖSENORD_LÄNGD i backend/utils/losenord.js – sidan får inte släppa igenom
// ett lösenord som servern sedan avvisar.
const MIN_LÖSENORD = 8;
const ORGNR_FORMAT = /^\d{6}-\d{4}$/;

export default function Registrera() {
  const router = useRouter();
  const { registrera } = useAuth();

  const [typ, setTyp] = useState('privatperson');
  const [form, setForm] = useState({
    namn: '',
    email: '',
    lösenord: '',
    organisationsnummer: '',
    fakturaadress: '',
    postnummer: '',
    ort: '',
    fakturamail: '',
    referensperson: '',
  });
  const [fältFel, setFältFel] = useState({});
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(false);

  const ärFöretag = typ === 'företag';

  function sätt(nyckel, värde) {
    setForm((f) => ({ ...f, [nyckel]: värde }));
  }

  // Klientvalidering som matchar backendens krav (routes/auth.js). Backend är sista
  // försvaret – men inline-fel ger snabbare återkoppling.
  function validera() {
    const f = {};
    if (!form.namn.trim()) f.namn = ärFöretag ? 'Företagsnamn krävs' : 'Namn krävs';
    if (!form.email.trim()) f.email = 'E-post krävs';
    if (!form.lösenord) f.lösenord = 'Lösenord krävs';
    else if (form.lösenord.length < MIN_LÖSENORD)
      f.lösenord = `Lösenordet måste vara minst ${MIN_LÖSENORD} tecken`;

    if (ärFöretag) {
      if (!form.organisationsnummer.trim())
        f.organisationsnummer = 'Organisationsnummer krävs';
      else if (!ORGNR_FORMAT.test(form.organisationsnummer.trim()))
        f.organisationsnummer = 'Format: XXXXXX-XXXX';
      if (!form.fakturaadress.trim()) f.fakturaadress = 'Fakturaadress krävs';
      if (!form.postnummer.trim()) f.postnummer = 'Postnummer krävs';
      if (!form.ort.trim()) f.ort = 'Ort krävs';
      if (!form.fakturamail.trim()) f.fakturamail = 'Fakturamail krävs';
      if (!form.referensperson.trim()) f.referensperson = 'Referensperson krävs';
    }
    return f;
  }

  async function skicka(e) {
    e.preventDefault();
    setFel('');
    const f = validera();
    setFältFel(f);
    if (Object.keys(f).length > 0) return;

    setLaddar(true);
    try {
      const data = {
        namn: form.namn.trim(),
        email: form.email.trim(),
        lösenord: form.lösenord,
        typ,
      };
      if (ärFöretag) {
        data.organisationsnummer = form.organisationsnummer.trim();
        data.fakturaadress = form.fakturaadress.trim();
        data.postnummer = form.postnummer.trim();
        data.ort = form.ort.trim();
        data.fakturamail = form.fakturamail.trim();
        data.referensperson = form.referensperson.trim();
      }
      const svar = await registrera(data);
      if (svar?.väntarVerifiering) {
        router.push(`/verifiera?email=${encodeURIComponent(data.email)}`);
      } else {
        // Oväntat (backend svarar normalt alltid väntarVerifiering), men var robust.
        router.push('/');
      }
    } catch (fe) {
      setFel(felText(fe));
    } finally {
      setLaddar(false);
    }
  }

  return (
    <AuthSkal
      titel="Skapa konto"
      underrubrik="Samma konto fungerar i både appen och på webben."
      bredd="max-w-lg"
    >
      {/* Typväljare */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-sm bg-yta-dämpad p-1">
        <TypKnapp
          aktiv={typ === 'privatperson'}
          onClick={() => setTyp('privatperson')}
        >
          Privatperson
        </TypKnapp>
        <TypKnapp aktiv={typ === 'företag'} onClick={() => setTyp('företag')}>
          Företag
        </TypKnapp>
      </div>

      <Besked typ="fel">{fel}</Besked>

      <form onSubmit={skicka} className="flex flex-col gap-4">
        <Input
          id="namn"
          etikett={ärFöretag ? 'Företagsnamn' : 'Namn'}
          required
          value={form.namn}
          fel={fältFel.namn}
          onChange={(e) => sätt('namn', e.target.value)}
        />
        <Input
          id="email"
          etikett="E-post"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          fel={fältFel.email}
          onChange={(e) => sätt('email', e.target.value)}
        />
        <Input
          id="losenord"
          etikett="Lösenord"
          type="password"
          autoComplete="new-password"
          required
          value={form.lösenord}
          fel={fältFel.lösenord}
          onChange={(e) => sätt('lösenord', e.target.value)}
          placeholder={`Minst ${MIN_LÖSENORD} tecken`}
        />

        {ärFöretag && (
          <>
            <div className="mt-2 border-t border-kant pt-4">
              <p className="överlinje mb-1">Faktureringsuppgifter</p>
            </div>
            <Input
              id="orgnr"
              etikett="Organisationsnummer"
              placeholder="XXXXXX-XXXX"
              required
              value={form.organisationsnummer}
              fel={fältFel.organisationsnummer}
              onChange={(e) => sätt('organisationsnummer', e.target.value)}
            />
            <Input
              id="fakturaadress"
              etikett="Fakturaadress"
              required
              value={form.fakturaadress}
              fel={fältFel.fakturaadress}
              onChange={(e) => sätt('fakturaadress', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="postnummer"
                etikett="Postnummer"
                required
                value={form.postnummer}
                fel={fältFel.postnummer}
                onChange={(e) => sätt('postnummer', e.target.value)}
              />
              <Input
                id="ort"
                etikett="Ort"
                required
                value={form.ort}
                fel={fältFel.ort}
                onChange={(e) => sätt('ort', e.target.value)}
              />
            </div>
            <Input
              id="fakturamail"
              etikett="Fakturamail"
              type="email"
              required
              value={form.fakturamail}
              fel={fältFel.fakturamail}
              onChange={(e) => sätt('fakturamail', e.target.value)}
            />
            <Input
              id="referensperson"
              etikett="Referensperson"
              required
              value={form.referensperson}
              fel={fältFel.referensperson}
              onChange={(e) => sätt('referensperson', e.target.value)}
            />
          </>
        )}

        <Knapp type="submit" full laddar={laddar} className="mt-2">
          Skapa konto
        </Knapp>
      </form>

      <p className="mt-6 text-center text-[14px] text-text-dämpad">
        Har du redan ett konto?{' '}
        <Link href="/logga-in" className="font-semibold text-primär hover:underline">
          Logga in
        </Link>
      </p>
    </AuthSkal>
  );
}

function TypKnapp({ aktiv, children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-[7px] py-2.5 text-[14px] font-bold transition-colors ${
        aktiv
          ? 'bg-yta text-primär shadow-mjuk'
          : 'text-text-dämpad hover:text-text'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
