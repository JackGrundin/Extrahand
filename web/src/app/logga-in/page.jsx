'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthSkal from '@/components/AuthSkal';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';

export default function LoggaIn() {
  const router = useRouter();
  const { loggaIn } = useAuth();

  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [fel, setFel] = useState('');
  // Sätts när backend svarar EMAIL_EJ_VERIFIERAD (403) – då erbjuder vi att skicka
  // en ny kod och gå till verifieringssteget i stället för att visa ett rött fel.
  const [ejVerifierad, setEjVerifierad] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [skickarKod, setSkickarKod] = useState(false);

  async function skicka(e) {
    e.preventDefault();
    setFel('');
    setEjVerifierad(false);
    setLaddar(true);
    try {
      await loggaIn(email.trim(), lösenord);
      router.push('/');
    } catch (f) {
      if (f.kod === 'EMAIL_EJ_VERIFIERAD') {
        setEjVerifierad(true);
      } else {
        setFel(felText(f));
      }
    } finally {
      setLaddar(false);
    }
  }

  async function skickaNyKod() {
    setSkickarKod(true);
    setFel('');
    try {
      await api.skickaVerifieringsmail({ email: email.trim() });
      router.push(`/verifiera?email=${encodeURIComponent(email.trim())}`);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickarKod(false);
    }
  }

  return (
    <AuthSkal titel="Logga in" underrubrik="Välkommen tillbaka till FastGig.">
      <Besked typ="fel">{fel}</Besked>

      {ejVerifierad && (
        <div className="mb-4 rounded-sm border border-varning-kant bg-varning-mjuk px-4 py-3 text-[14px] text-varning-text">
          <p className="mb-2 font-medium">
            Din e-postadress är inte verifierad ännu. Kolla din inkorg – eller
            skicka en ny kod.
          </p>
          <Knapp
            variant="sekundär"
            onClick={skickaNyKod}
            laddar={skickarKod}
            type="button"
          >
            Skicka ny verifieringskod
          </Knapp>
        </div>
      )}

      <form onSubmit={skicka} className="flex flex-col gap-4">
        <Input
          id="email"
          etikett="E-post"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="losenord"
          etikett="Lösenord"
          type="password"
          autoComplete="current-password"
          required
          value={lösenord}
          onChange={(e) => setLösenord(e.target.value)}
        />
        <div className="-mt-1 text-right">
          <Link
            href="/glomt-losenord"
            className="text-[14px] font-semibold text-primär hover:underline"
          >
            Glömt lösenord?
          </Link>
        </div>
        <Knapp type="submit" full laddar={laddar}>
          Logga in
        </Knapp>
      </form>

      <p className="mt-6 text-center text-[14px] text-text-dämpad">
        Har du inget konto?{' '}
        <Link href="/registrera" className="font-semibold text-primär hover:underline">
          Skapa konto
        </Link>
      </p>
    </AuthSkal>
  );
}
