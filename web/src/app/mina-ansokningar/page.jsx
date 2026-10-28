'use client';

// Privatpersonens "Mina ansökningar": alla ansökningar man skickat som INTE är godkända ännu,
// med status och jobbdetaljer samt möjlighet att ångra en väntande ansökan. Ligger UTANFÖR
// (app)-gruppen med egen auth-gate (spegla min-profil). Godkända pass visas i stället på
// /mina-pass. Filterregeln speglar appens MinaAnsokningarScreen.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PrivatSkal from '@/components/privat/PrivatSkal';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { useAuth } from '@/context/AuthContext';
import { api, felText } from '@/lib/api';
import { ansökanStatusVisning } from '@/utils/konstanter';

// Länk till rätt detaljvy: schemaansökan → schemat, enstaka pass → jobbet. (Webben har
// ingen privatpersons-chatt, till skillnad från appen.)
function detaljLänk(a) {
  return a.schemaId ? `/schema/${a.schemaId}` : `/jobb/${a.jobb_id}`;
}

export default function MinaAnsokningar() {
  const router = useRouter();
  const { laddar: authLaddar, inloggad, användare } = useAuth();

  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState('');
  const [ångrar, setÅngrar] = useState(null);

  useEffect(() => {
    if (authLaddar) return;
    if (!inloggad) {
      router.replace(`/logga-in?next=${encodeURIComponent('/mina-ansokningar')}`);
    } else if (användare?.typ === 'företag') {
      router.replace('/oversikt');
    }
  }, [authLaddar, inloggad, användare, router]);

  const hämta = useCallback(async () => {
    try {
      const data = await api.minaAnsökningar();
      // Spegla appen: dölj godkända (visas under Mina pass) och auto-skapade pass-ansökningar.
      const lista = (Array.isArray(data) ? data : [])
        .filter((a) => a.status !== 'godkänd' && a.schemaPassId == null)
        .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
      setAnsökningar(lista);
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    if (!authLaddar && inloggad && användare?.typ !== 'företag') hämta();
  }, [authLaddar, inloggad, användare, hämta]);

  async function ångra(id) {
    if (!window.confirm('Vill du ångra din ansökan?')) return;
    setFel('');
    setÅngrar(id);
    try {
      await api.ångraAnsökan(id);
      setAnsökningar((prev) => prev.filter((a) => a.id !== id));
    } catch (f) {
      setFel(felText(f));
    } finally {
      setÅngrar(null);
    }
  }

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
          <h1 className="rubrik-l text-text">Mina ansökningar</h1>

          {fel && <div className="mt-4"><Besked typ="fel">{fel}</Besked></div>}

          {ansökningar.length === 0 ? (
            <div className="mt-10 rounded-lg border border-kant bg-yta p-8 text-center shadow-mjuk">
              <p className="text-[15px] font-semibold text-text">
                Du har inte sökt några jobb ännu
              </p>
              <p className="mt-1 text-[14px] text-text-dämpad">
                Hitta ett pass och skicka din första ansökan.
              </p>
              <Knapp variant="primär" href="/jobb" className="mt-4">
                Hitta jobb
              </Knapp>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {ansökningar.map((a) => {
                const status = ansökanStatusVisning(a) ?? { etikett: a.status, bg: '#f3f4f6', text: '#6b7280' };
                const kräverBekräftelse = a.saknadeKrav?.length > 0;
                const kanÅngra = a.status === 'väntande' && !a.avhoppad_at;
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-kant bg-yta p-5 shadow-mjuk"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={detaljLänk(a)} className="min-w-0">
                        {a.foretagNamn && (
                          <p className="truncate text-[14px] font-semibold text-primär">
                            {a.foretagNamn}
                          </p>
                        )}
                        <h2 className="truncate text-[16px] font-bold text-text">
                          {a.jobbTitel ?? 'Jobb'}
                        </h2>
                      </Link>
                      <span
                        className="shrink-0 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-bold"
                        style={{ backgroundColor: status.bg, color: status.text }}
                      >
                        {status.etikett}
                      </span>
                    </div>

                    <p className="mt-2 text-[13px] text-text-svag">
                      Skickad {new Date(a.created_at).toLocaleDateString('sv-SE')}
                    </p>

                    <p className="mt-2 text-[14px] leading-relaxed text-text-dämpad">
                      {a.meddelande?.trim() || 'Ingen ansökningstext'}
                    </p>

                    {kräverBekräftelse && (
                      <p className="mt-2 rounded-sm bg-varning-mjuk px-3 py-2 text-[13px] text-varning-text">
                        Företaget har lagt till nya krav. Bekräfta dem i FastGig-appen för att
                        behålla din ansökan.
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-4">
                      <Link
                        href={detaljLänk(a)}
                        className="text-[14px] font-semibold text-primär hover:underline"
                      >
                        Visa {a.schemaId ? 'schemat' : 'jobbet'}
                      </Link>
                      <Link
                        href={`/chatt/${a.id}`}
                        className="text-[14px] font-semibold text-primär hover:underline"
                      >
                        Öppna chatt
                      </Link>
                      {kanÅngra && (
                        <Knapp
                          variant="fara"
                          storlek="liten"
                          laddar={ångrar === a.id}
                          onClick={() => ångra(a.id)}
                        >
                          Ångra ansökan
                        </Knapp>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </PrivatSkal>
  );
}
