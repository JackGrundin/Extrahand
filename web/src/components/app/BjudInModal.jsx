'use client';

// Enhetlig "Bjud in"-modal för både jobb (typ="jobb") och schema (typ="schema"). Två flikar:
//  - "Ny på FastGig": generera en delbar länk (Kopiera-knapp). Personen skapar konto via länken.
//  - "Redan på FastGig": skriv e-post, vi skickar inbjudan direkt (push om konto finns, annars mejl).
// Att generera/skicka gör annonsen privat, därför anropas onÄndrad så att föräldern refetchar.
import { useEffect, useState } from 'react';
import Input from '@/components/ui/Input';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

const FLIKAR = [
  { nyckel: 'ny', etikett: 'Ny på FastGig' },
  { nyckel: 'konto', etikett: 'Redan på FastGig' },
];

export default function BjudInModal({ typ, id, öppen, onStäng, onÄndrad }) {
  const [flik, setFlik] = useState('ny');

  // Flik 1 – delbar länk
  const [url, setUrl] = useState('');
  const [genererar, setGenererar] = useState(false);
  const [kopierad, setKopierad] = useState(false);

  // Flik 2 – e-postinbjudan
  const [email, setEmail] = useState('');
  const [skickar, setSkickar] = useState(false);
  const [bekräftelse, setBekräftelse] = useState('');

  const [fel, setFel] = useState('');

  // Nollställ när modalen stängs så nästa öppning börjar rent.
  useEffect(() => {
    if (!öppen) {
      setFlik('ny');
      setUrl('');
      setKopierad(false);
      setEmail('');
      setBekräftelse('');
      setFel('');
    }
  }, [öppen]);

  if (!öppen) return null;

  function generera(email) {
    return typ === 'schema'
      ? api.genereraSchemaInbjudan(id, email)
      : api.genereraJobbInbjudan(id, email);
  }

  async function genereraLänk() {
    setFel('');
    setKopierad(false);
    setGenererar(true);
    try {
      const svar = await generera();
      setUrl(svar?.url || '');
      onÄndrad?.();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setGenererar(false);
    }
  }

  async function kopiera() {
    try {
      await navigator.clipboard.writeText(url);
      setKopierad(true);
      setTimeout(() => setKopierad(false), 2000);
    } catch {
      /* Kopiering kan nekas – länken syns ändå i fältet för manuell kopiering. */
    }
  }

  async function skickaInbjudan(e) {
    e.preventDefault();
    const adress = email.trim();
    if (!adress) return;
    setFel('');
    setBekräftelse('');
    setSkickar(true);
    try {
      const svar = await generera(adress);
      setEmail('');
      setBekräftelse(
        svar?.hadeKonto
          ? 'Inbjudan skickad!'
          : 'Inbjudan skickad – personen har inget konto än, de får ett mejl med länken.'
      );
      onÄndrad?.();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setSkickar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onStäng} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-auto rounded-t-lg bg-yta p-6 shadow-lyft sm:rounded-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-[18px] font-bold text-text">Bjud in</h2>
          <button
            type="button"
            onClick={onStäng}
            aria-label="Stäng"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-sm text-text-dämpad hover:bg-yta-dämpad hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* Flikar */}
        <div className="mb-5 flex gap-1 border-b border-kant">
          {FLIKAR.map((f) => (
            <button
              key={f.nyckel}
              type="button"
              onClick={() => { setFlik(f.nyckel); setFel(''); }}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                flik === f.nyckel
                  ? 'border-primär text-primär'
                  : 'border-transparent text-text-dämpad hover:text-text'
              }`}
            >
              {f.etikett}
            </button>
          ))}
        </div>

        {fel && <Besked typ="fel">{fel}</Besked>}

        {flik === 'ny' ? (
          <div>
            <p className="text-[14px] text-text-dämpad">
              Generera en länk och skicka den hur du vill. Personen skapar ett konto via länken
              och du får ett rabatterat pris på detta pass.
            </p>
            {url ? (
              <div className="mt-4 flex items-end gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded-sm border border-kant bg-yta-dämpad px-3.5 py-2.5 text-[14px] text-text"
                />
                <Knapp variant="primär" onClick={kopiera}>
                  {kopierad ? 'Kopierad!' : 'Kopiera'}
                </Knapp>
              </div>
            ) : (
              <div className="mt-4">
                <Knapp variant="primär" full laddar={genererar} onClick={genereraLänk}>
                  Generera länk
                </Knapp>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[14px] text-text-dämpad">
              Skriv in personens e-postadress så skickar vi inbjudan direkt till dem.
            </p>
            {bekräftelse && (
              <div className="mt-4"><Besked typ="framgång">{bekräftelse}</Besked></div>
            )}
            {/* Formuläret ligger kvar efter utskick så företaget kan bjuda in fler i rad. */}
            <form onSubmit={skickaInbjudan} className="mt-4 flex flex-col gap-3">
              <Input
                id="bjud-in-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@exempel.se"
                autoComplete="off"
              />
              <Knapp type="submit" variant="primär" full laddar={skickar} disabled={!email.trim()}>
                Skicka inbjudan
              </Knapp>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
