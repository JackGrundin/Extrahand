'use client';

// Ansökningar för ett enstaka jobb. Vid mount hämtas ansökningarna + jobbet och räknaren
// nollas (markeraAnsökningarSedda). Godkännande avvisar automatiskt övriga sökande (sköts
// av backend) – vi hämtar om listan efteråt så statusarna stämmer.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Besked from '@/components/ui/Besked';
import AnsökningsKort from '@/components/app/AnsökningsKort';
import { api, felText } from '@/lib/api';
import { harStartat } from '@/utils/datumHelper';

export default function JobbAnsökningar() {
  const { id } = useParams();
  const [jobb, setJobb] = useState(null);
  const [ansökningar, setAnsökningar] = useState([]);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(true);

  const hämta = useCallback(async () => {
    setFel('');
    try {
      const [jobbData, lista] = await Promise.all([api.hämtaJobb(id), api.ansökningarFörJobb(id)]);
      setJobb(jobbData);
      setAnsökningar(Array.isArray(lista) ? lista : []);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    hämta();
    // Nolla badgen; fel här ska inte störa vyn.
    api.markeraAnsökningarSedda(id).catch(() => {});
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
    // Optimistisk uppdatering – stjärnan ska kännas direkt.
    setAnsökningar((prev) => prev.map((a) => (a.id === ansökningId ? { ...a, favorit } : a)));
    try {
      await api.växlaFavoritAnsökan(ansökningId, favorit);
    } catch {
      setAnsökningar((prev) => prev.map((a) => (a.id === ansökningId ? { ...a, favorit: !favorit } : a)));
    }
  }

  const jobbStartat = jobb ? harStartat(jobb.arbetstider) : false;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/annonser" className="text-[14px] font-semibold text-text-dämpad hover:text-text">
        ← Mina annonser
      </Link>

      <h1 className="mt-3 rubrik-l text-text">{jobb?.Titel || 'Ansökningar'}</h1>
      {jobb && (
        <p className="mt-1 text-[15px] text-text-dämpad">
          {jobb.Plats} · {jobb.Lon} kr/tim
        </p>
      )}

      {fel && <Besked typ="fel">{fel}</Besked>}

      {laddar ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : ansökningar.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-kant p-8 text-center text-[14px] text-text-dämpad">
          Inga ansökningar än. De dyker upp här när någon söker.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {ansökningar.map((a) => (
            <AnsökningsKort key={a.id} ansökan={a} jobbStartat={jobbStartat} onStatus={sättStatus} onFavorit={sättFavorit} />
          ))}
        </div>
      )}
    </div>
  );
}
