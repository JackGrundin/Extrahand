'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthSkal from '@/components/AuthSkal';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

export default function GlömtLösenord() {
  const [email, setEmail] = useState('');
  const [skickat, setSkickat] = useState(false);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(false);

  async function skicka(e) {
    e.preventDefault();
    setFel('');
    setLaddar(true);
    try {
      await api.glömtLösenord({ email: email.trim() });
      // Backend svarar ALLTID ok – vi visar samma neutrala kvittens oavsett om
      // adressen finns eller inte. En text som avslöjade skillnaden hade gjort
      // detta till ett verktyg för att kartlägga vilka som har konto.
      setSkickat(true);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }

  return (
    <AuthSkal
      titel="Glömt lösenord"
      underrubrik="Ange din e-postadress så skickar vi en länk för att återställa lösenordet."
    >
      {skickat ? (
        <>
          <Besked typ="framgång">
            Om adressen finns hos oss har vi skickat en återställningslänk. Kolla
            din inkorg (och skräpposten). Länken är giltig i en timme.
          </Besked>
          <Knapp variant="sekundär" href="/logga-in" full className="mt-2">
            Tillbaka till inloggning
          </Knapp>
        </>
      ) : (
        <>
          <Besked typ="fel">{fel}</Besked>
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
            <Knapp type="submit" full laddar={laddar}>
              Skicka återställningslänk
            </Knapp>
          </form>
          <p className="mt-6 text-center text-[14px] text-text-dämpad">
            <Link href="/logga-in" className="font-semibold text-primär hover:underline">
              Tillbaka till inloggning
            </Link>
          </p>
        </>
      )}
    </AuthSkal>
  );
}
