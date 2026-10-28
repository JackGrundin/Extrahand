'use client';

// Privatpersonens "Mina pass": de pass man blivit godkänd för, uppdelat i Kommande och
// Genomförda – speglar appens MinaPassScreen. Samma endpoint som Mina ansökningar
// (GET /ansokningar/mina), men filtrerat på status === 'godkänd'. Ligger UTANFÖR (app).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Besked from '@/components/ui/Besked';
import RollBrickor from '@/components/app/RollBrickor';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';
import {
  parsaArbetstider,
  formatDagDatum,
  formatPeriod,
  förstaArbetsdatum,
  passSlutTidpunkt,
} from '@/utils/datumHelper';

// Ett pass är genomfört när företaget skapat en tidrapport (rapportStatus) eller när sista
// sluttiden passerat. Speglar appens ärGenomfört i MinaPassScreen.
function ärGenomfört(a) {
  if (a.rapportStatus != null) return true;
  const slut = passSlutTidpunkt(a.arbetstider);
  return slut != null && slut.getTime() < Date.now();
}

// Gruppera på arbetsdatum (inte created_at – ett schema tilldelas i en transaktion så alla
// pass delar created_at). Faller tillbaka på created_at för pass utan datum. Äldst → nyast.
function grupperaPerMånad(pass) {
  const grupper = {};
  pass.forEach((p) => {
    const arbetsdatum = förstaArbetsdatum(p.arbetstider);
    const datum = arbetsdatum ? new Date(arbetsdatum + 'T12:00:00') : new Date(p.created_at);
    const nyckel = datum.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
    if (!grupper[nyckel]) grupper[nyckel] = { titel: nyckel, sortering: datum.getTime(), data: [] };
    grupper[nyckel].data.push(p);
  });
  return Object.values(grupper).sort((a, b) => a.sortering - b.sortering);
}

function detaljLänk(a) {
  return a.schemaId ? `/schema/${a.schemaId}` : `/jobb/${a.jobb_id}`;
}

function PassKort({ pass }) {
  const schema = parsaArbetstider(pass.arbetstider);
  const allaDatum = (schema ?? []).map((d) => d?.datum).filter(Boolean);
  const ärSchemaKort = pass.schemaId != null && pass.schemaPassId == null;
  const roller = [...new Set((schema ?? []).map((d) => d?.kategori).filter(Boolean))];
  const visaDatum = allaDatum.slice(0, 3);
  const fler = allaDatum.length > 3 ? allaDatum.length - 3 : 0;

  return (
    <div className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk">
      <Link href={detaljLänk(pass)} className="block">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-[16px] font-bold text-text">
            {pass.jobbTitel ?? 'Jobb'}
          </h2>
          {ärSchemaKort && (
            <span className="shrink-0 rounded-pill bg-primär-mjuk px-2 py-0.5 text-[11px] font-bold text-primär">
              Schema
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[14px] text-text-dämpad">
          {pass.foretagNamn ?? 'Okänt företag'}
        </p>

        {roller.length > 0 && (
          <div className="mt-2">
            <RollBrickor kategorier={roller} />
          </div>
        )}

        {/* Schemakort visar hela perioden; ett enstaka pass sina datum som chips. */}
        {ärSchemaKort && allaDatum.length > 0 ? (
          <p className="mt-3 text-[13px] font-semibold text-text-dämpad">
            {formatPeriod(allaDatum)}
          </p>
        ) : allaDatum.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visaDatum.map((d) => (
              <span
                key={d}
                className="rounded-pill bg-yta-dämpad px-2.5 py-0.5 text-[12px] font-semibold text-text-dämpad"
              >
                {formatDagDatum(d)}
              </span>
            ))}
            {fler > 0 && (
              <span className="px-1 text-[12px] font-semibold text-text-svag">+{fler} till</span>
            )}
          </div>
        ) : pass.antalDagar != null ? (
          <p className="mt-3 text-[13px] text-text-dämpad">
            {pass.antalDagar} {pass.antalDagar === 1 ? 'dag' : 'dagar'}
          </p>
        ) : null}
      </Link>

      {/* Enskilda schemapass (schemaPassId satt) har ingen egen tråd – chatten ligger på
          annons-ansökan. Visa "Öppna chatt" för enstaka jobb och det samlade schemakortet. */}
      {pass.schemaPassId == null && (
        <div className="mt-3 border-t border-kant pt-3">
          <Link
            href={`/chatt/${pass.id}`}
            className="text-[14px] font-semibold text-primär hover:underline"
          >
            Öppna chatt
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MinaPass() {
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const [aktivFlik, setAktivFlik] = useState('kommande');

  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent('/mina-pass')}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/oversikt');
    }
  }, [authLaddar, inloggad, användare, router]);

  const hämta = useCallback(async () => {
    try {
      const data = await api.minaAnsökningar();
      setAnsökningar(Array.isArray(data) ? data : []);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    if (!authLaddar && inloggad && användare?.typ !== 'företag') hämta();
  }, [authLaddar, inloggad, användare, hämta]);

  const { kommande, genomförda } = useMemo(() => {
    const godkända = ansökningar.filter((a) => a.status === 'godkänd');
    const genomförda = godkända
      .filter(ärGenomfört)
      .filter((a) => !(a.schemaId && !a.schemaPassId));
    const kommande = godkända
      .filter((a) => !ärGenomfört(a))
      .filter((a) => !a.schemaPassId)
      .sort((a, b) => {
        const da = förstaArbetsdatum(a.arbetstider);
        const db = förstaArbetsdatum(b.arbetstider);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      });
    return { kommande, genomförda };
  }, [ansökningar]);

  const sektioner = useMemo(
    () => grupperaPerMånad(aktivFlik === 'kommande' ? kommande : genomförda),
    [aktivFlik, kommande, genomförda]
  );

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
          <h1 className="rubrik-l text-text">Mina pass</h1>

          {fel && <div className="mt-4"><Besked typ="fel">{fel}</Besked></div>}

          {/* Flikar Kommande / Genomförda */}
          <div className="mt-5 flex gap-2">
            {[
              { nyckel: 'kommande', etikett: `Kommande (${kommande.length})` },
              { nyckel: 'genomförda', etikett: `Genomförda (${genomförda.length})` },
            ].map((f) => (
              <button
                key={f.nyckel}
                type="button"
                onClick={() => setAktivFlik(f.nyckel)}
                className={`flex-1 rounded-sm py-2.5 text-[14px] font-bold transition-colors ${
                  aktivFlik === f.nyckel
                    ? 'bg-primär text-white'
                    : 'bg-yta text-text-dämpad hover:text-text'
                }`}
              >
                {f.etikett}
              </button>
            ))}
          </div>

          {sektioner.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-text-dämpad">
              {aktivFlik === 'kommande'
                ? 'Du har inga kommande pass ännu. Sök och ansök till jobb – godkända pass hamnar här.'
                : 'Inga genomförda pass ännu. Här samlas pass du har jobbat klart.'}
            </p>
          ) : (
            sektioner.map((sektion) => (
              <section key={sektion.titel} className="mt-6">
                <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-text-svag">
                  {sektion.titel}
                </h2>
                <div className="flex flex-col gap-3">
                  {sektion.data.map((p) => (
                    <PassKort key={p.id} pass={p} />
                  ))}
                </div>
              </section>
            ))
          )}
      </div>
    </PrivatSkal>
  );
}
