'use client';

// Schemadetalj för företaget: grunddata, pass, roller, löneavdrag och schemats ansökningar
// (mot annons-jobbet) med samma godkännandeflöde som enstaka pass. Att godkänna en sökande
// materialiserar schemats framtida pass (backend). Chatt/avsluta-pass ligger utanför v1.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Besked from '@/components/ui/Besked';
import RollBrickor from '@/components/app/RollBrickor';
import AnsökningsKort from '@/components/app/AnsökningsKort';
import InbjudanSektion from '@/components/app/InbjudanSektion';
import { api, felText } from '@/lib/api';
import { formatPeriod, veckodagsNamn, formatDagDatum } from '@/utils/datumHelper';
import { schematypEtikett, formateraPris } from '@/utils/konstanter';

export default function SchemaDetalj() {
  const { id } = useParams();
  const [schema, setSchema] = useState(null);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      setSchema(await api.hämtaSchema(id));
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    hämta();
    api.markeraSchemaAnsökningarSedda(id).catch(() => {});
  }, [hämta, id]);

  async function sättStatus(ansökningId, status) {
    try {
      await api.uppdateraStatus(ansökningId, status);
      await hämta();
    } catch (f) {
      setFel(felText(f));
    }
  }

  async function sättFavorit(ansökningId, favorit) {
    setSchema((prev) =>
      prev ? { ...prev, ansokningar: (prev.ansokningar ?? []).map((a) => (a.id === ansökningId ? { ...a, favorit } : a)) } : prev
    );
    try {
      await api.växlaFavoritAnsökan(ansökningId, favorit);
    } catch {
      setSchema((prev) =>
        prev ? { ...prev, ansokningar: (prev.ansokningar ?? []).map((a) => (a.id === ansökningId ? { ...a, favorit: !favorit } : a)) } : prev
      );
    }
  }

  if (laddar) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/annonser" className="text-[14px] font-semibold text-text-dämpad hover:text-text">← Mina annonser</Link>
        {fel && <Besked typ="fel">{fel}</Besked>}
      </div>
    );
  }

  const period = formatPeriod((schema.pass ?? []).map((p) => p.datum).filter(Boolean));
  const ansökningar = schema.ansokningar ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/annonser" className="text-[14px] font-semibold text-text-dämpad hover:text-text">← Mina annonser</Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="rubrik-l text-text">{schema.titel}</h1>
        {schema.privat && (
          <span className="rounded-pill border border-varning-kant bg-varning-mjuk px-2.5 py-1 text-[12px] font-bold text-varning-text">
            Privat
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[15px] text-text-dämpad">
        <span>{schematypEtikett(schema.typ)}</span>
        <span>·</span>
        <span>{schema.timlon} kr/tim</span>
        {period && (
          <>
            <span>·</span>
            <span>{period}</span>
          </>
        )}
      </div>
      <div className="mt-3">
        <RollBrickor kategorier={schema.kategorier} />
      </div>

      {fel && <Besked typ="fel">{fel}</Besked>}

      {schema.privat && <InbjudanSektion schemaId={id} />}

      {schema.beskrivning && (
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-text-dämpad">{schema.beskrivning}</p>
      )}

      {/* Löneavdrag */}
      {Array.isArray(schema.avdrag) && schema.avdrag.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold text-text">Löneavdrag</h2>
          <ul className="space-y-1">
            {schema.avdrag.map((a) => (
              <li key={a.id} className="flex justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]">
                <span className="text-text">{a.namn}</span>
                <span className="font-semibold text-text">
                  {formateraPris(Number(a.belopp) || 0)} kr {a.typ === 'totalt' ? '(totalt)' : '(per pass)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pass */}
      <section className="mt-6">
        <h2 className="mb-2 text-[17px] font-bold text-text">Pass ({schema.antalPass})</h2>
        <ul className="space-y-1">
          {(schema.pass ?? []).map((p, i) => (
            <li key={p.id ?? i} className="flex items-center justify-between rounded-sm border border-kant bg-yta px-4 py-2.5 text-[14px]">
              <span className="text-text">
                {veckodagsNamn(p.datum)} {formatDagDatum(p.datum)}
                {p.kategori ? ` · ${p.kategori}` : ''}
              </span>
              <span className="font-semibold text-text-dämpad">
                {p.starttid}–{p.sluttid}
                {p.status === 'installt' ? ' (inställt)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ansökningar */}
      <section className="mt-8">
        <h2 className="mb-3 text-[17px] font-bold text-text">Ansökningar ({ansökningar.length})</h2>
        {ansökningar.length === 0 ? (
          <p className="rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
            Inga ansökningar än.
          </p>
        ) : (
          <div className="space-y-3">
            {ansökningar.map((a) => (
              <AnsökningsKort key={a.id} ansökan={a} jobbStartat={false} onStatus={sättStatus} onFavorit={sättFavorit} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
