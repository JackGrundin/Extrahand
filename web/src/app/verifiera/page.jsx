'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthSkal from '@/components/AuthSkal';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import VälkomstModal from '@/components/VälkomstModal';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';

function VerifieraInnehåll() {
  const router = useRouter();
  const sök = useSearchParams();
  const { verifieraKod } = useAuth();

  const emailFrånLänk = sök.get('email') || '';
  // ?next= bärs hit från registreringen – efter verifiering landar en inbjuden på schemat.
  const nästa = sök.get('next') || '';
  const [email, setEmail] = useState(emailFrånLänk);
  const [kod, setKod] = useState('');
  const [fel, setFel] = useState('');
  const [besked, setBesked] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [skickarKod, setSkickarKod] = useState(false);
  // Privatpersoner möts av en välkomstruta om avtalet (precis som i appen) innan de
  // navigeras vidare – målet sparas tills de klickar bort rutan.
  const [visaVälkomst, setVisaVälkomst] = useState(false);
  const [välkomstMål, setVälkomstMål] = useState('');

  async function skicka(e) {
    e.preventDefault();
    setFel('');
    setBesked('');
    setLaddar(true);
    try {
      const svar = await verifieraKod(email.trim(), kod.trim());
      // Inbjudningslänk (next) först; annars företag → översikt, privatperson → jobblistan.
      const mål = nästa
        ? nästa
        : svar?.användare?.typ === 'företag'
          ? '/oversikt'
          : '/jobb';
      // Privatpersoner ser först välkomstrutan om avtalet; företag navigeras direkt.
      if (svar?.användare?.typ === 'privatperson') {
        setVälkomstMål(mål);
        setVisaVälkomst(true);
      } else {
        router.push(mål);
      }
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }

  async function skickaNyKod() {
    setFel('');
    setBesked('');
    setSkickarKod(true);
    try {
      await api.skickaVerifieringsmail({ email: email.trim() });
      setBesked('En ny kod har skickats. Kolla din inkorg.');
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickarKod(false);
    }
  }

  return (
    <AuthSkal
      titel="Verifiera din e-post"
      underrubrik="Vi har skickat en 6-siffrig kod till din e-postadress. Ange den nedan."
    >
      <Besked typ="fel">{fel}</Besked>
      <Besked typ="framgång">{besked}</Besked>

      <form onSubmit={skicka} className="flex flex-col gap-4">
        <Input
          id="email"
          etikett="E-post"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="kod"
          etikett="Verifieringskod"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="------"
          required
          value={kod}
          onChange={(e) => setKod(e.target.value.replace(/\D/g, ''))}
          className="tracking-[0.5em] text-center text-lg"
        />
        <Knapp type="submit" full laddar={laddar}>
          Verifiera och logga in
        </Knapp>
      </form>

      <div className="mt-6 text-center text-[14px] text-text-dämpad">
        Fick du ingen kod?{' '}
        <button
          type="button"
          onClick={skickaNyKod}
          disabled={skickarKod}
          className="font-semibold text-primär hover:underline disabled:opacity-60"
        >
          Skicka ny kod
        </button>
      </div>

      <VälkomstModal
        öppen={visaVälkomst}
        onStäng={() => router.push(välkomstMål)}
      />
    </AuthSkal>
  );
}

export default function Verifiera() {
  return (
    <Suspense fallback={null}>
      <VerifieraInnehåll />
    </Suspense>
  );
}
