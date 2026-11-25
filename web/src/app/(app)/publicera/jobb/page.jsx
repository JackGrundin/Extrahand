'use client';

// Publicera ett enstaka pass. Speglar appens PubliceraJobbScreen: samma fält, samma
// validering (valideraJobb), samma payload. Backend är sista försvaret och svarar
// KRAVER_PLANVAL (409) om gratiskontot förbrukat månadens två pass – då visas planvalet
// och publiceringen görs om med acceptera_hogre_paslag.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import FältFel from '@/components/ui/FältFel';
import StadInput from '@/components/app/StadInput';
import AdressInput from '@/components/app/AdressInput';
import KategoriVäljare from '@/components/app/KategoriVäljare';
import DatumVäljare from '@/components/app/DatumVäljare';
import TidVäljare from '@/components/app/TidVäljare';
import OBTilläggRedigerare from '@/components/app/OBTilläggRedigerare';
import BehörighetsKravRedigerare from '@/components/app/BehörighetsKravRedigerare';
import PlanvalModal from '@/components/app/PlanvalModal';
import { api, felText } from '@/lib/api';
import { valideraJobb } from '@/utils/jobbValidering';
import { datumTillIso, planeradeTimmar, beräknaObBelopp, formatDagMedTid } from '@/utils/datumHelper';
import { saniteraObTillagg } from '@/utils/ob';
import { beräknaFakturapris, formateraPris, PÅSLAG_GRATIS } from '@/utils/konstanter';

export default function PubliceraJobb() {
  const router = useRouter();

  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [behorighetsKrav, setBehorighetsKrav] = useState([]);
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [lon, setLon] = useState('');
  const [antalDagar, setAntalDagar] = useState('');
  const [dagScheman, setDagScheman] = useState([]);
  const [sammaTider, setSammaTider] = useState(false);
  const [obTillagg, setObTillagg] = useState([]);
  const [rastMinuter, setRastMinuter] = useState('');
  const [kategori, setKategori] = useState('');

  const [fel, setFel] = useState({});
  const [serverfel, setServerfel] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [visaPlanval, setVisaPlanval] = useState(false);
  const [laddarUppgradera, setLaddarUppgradera] = useState(false);
  // Förhandsgranskning: visas efter validering, innan passet faktiskt skickas.
  const [visaFörhandsgranskning, setVisaFörhandsgranskning] = useState(false);
  // Publicerings-popup: sätts till det skapade jobbet efter lyckad publicering.
  const [publiceratJobb, setPubliceratJobb] = useState(null);
  // Företagets prognospåslag, bara för prisvisningen – backend avgör i slutändan.
  const [prenumeration, setPrenumeration] = useState(null);

  // Hämta påslaget som gäller för nästa pass så prisrutan kan visa rätt kostnad.
  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const status = await api.prenumerationStatus();
        if (!avbruten) setPrenumeration(status);
      } catch {
        // Statusen är bara till för prisvisningen – backend avgör i slutändan.
      }
    })();
    return () => {
      avbruten = true;
    };
  }, []);

  // Dagens datum som undre gräns för datumväljarna (man publicerar inte pass i det förflutna).
  const idag = datumTillIso(new Date());

  function rensaFel(nyckel) {
    setFel((prev) => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  function hanteraAntalDagar(val) {
    setAntalDagar(val);
    rensaFel('schema');
    rensaFel('antal_dagar');
    const n = parseInt(val) || 0;
    setDagScheman((prev) => Array.from({ length: n }, (_, i) => prev[i] || { datum: '', start: '08:00', slut: '17:00' }));
    if (n <= 1) setSammaTider(false);
  }

  function uppdateraDag(index, fält, värde) {
    rensaFel('schema');
    setDagScheman((prev) => {
      if (sammaTider && fält !== 'datum') {
        return prev.map((dag) => ({ ...dag, [fält]: värde }));
      }
      const ny = [...prev];
      ny[index] = { ...ny[index], [fält]: värde };
      return ny;
    });
  }

  function toggleSammaTider() {
    const nästa = !sammaTider;
    setSammaTider(nästa);
    if (nästa && dagScheman.length > 0) {
      const { start, slut } = dagScheman[0];
      setDagScheman((prev) => prev.map((dag) => ({ ...dag, start, slut })));
    }
  }

  // Validerar formuläret och öppnar förhandsgranskningen – själva publiceringen sker
  // först när företaget bekräftar i modalen (skicka).
  function granska() {
    const valideringsfel = valideraJobb({ titel, beskrivning, kategori, plats, adress, lon, dagScheman, antal_dagar: antalDagar });
    if (Object.keys(valideringsfel).some((k) => valideringsfel[k])) {
      setFel(valideringsfel);
      return;
    }
    setFel({});
    setVisaFörhandsgranskning(true);
  }

  async function skicka({ accepteraHögrePåslag = false } = {}) {
    const valideringsfel = valideraJobb({ titel, beskrivning, kategori, plats, adress, lon, dagScheman, antal_dagar: antalDagar });
    if (Object.keys(valideringsfel).some((k) => valideringsfel[k])) {
      setFel(valideringsfel);
      setVisaFörhandsgranskning(false);
      return;
    }

    setServerfel('');
    setLaddar(true);
    try {
      const skapat = await api.publicera({
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        adress: adress.trim(),
        lon: lon ? parseInt(lon) : undefined,
        typ: 'gig',
        kategori: kategori || undefined,
        antal_dagar: dagScheman.length || undefined,
        arbetstider: dagScheman.length > 0 ? JSON.stringify(dagScheman) : undefined,
        ob_tillagg: saniteraObTillagg(obTillagg),
        rast_minuter: rastMinuter ? parseInt(rastMinuter) : 0,
        behorighets_krav: behorighetsKrav,
        ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
      });
      // Visa publicerings-popupen med vägar vidare i stället för tyst redirect.
      setVisaFörhandsgranskning(false);
      setPubliceratJobb(skapat);
    } catch (f) {
      if (f?.kod === 'KRAVER_PLANVAL') {
        setVisaFörhandsgranskning(false);
        setVisaPlanval(true);
      } else {
        setServerfel(felText(f));
      }
    } finally {
      setLaddar(false);
    }
  }

  async function uppgradera() {
    setLaddarUppgradera(true);
    try {
      const { url } = await api.skapaCheckout();
      if (url) window.location.href = url;
    } catch (f) {
      setServerfel(felText(f));
      setLaddarUppgradera(false);
    }
  }

  // Prisförhandsvisning: brutto = timlön × planerade timmar + OB. Påslaget är företagets
  // prognospåslag (20/40 %) – exakt påslag fryses först vid godkännande.
  const lönNum = parseFloat(lon) || 0;
  const timmar = planeradeTimmar(dagScheman);
  const obBrutto = beräknaObBelopp(saniteraObTillagg(obTillagg), lönNum);
  const brutto = lönNum * (timmar || 0) + obBrutto;
  const visaPris = lönNum > 0 && timmar > 0;
  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="rubrik-l text-text">Publicera ett pass</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">
        Ett enstaka jobbpass. För längre uppdrag, använd{' '}
        <button type="button" onClick={() => router.push('/publicera/schema')} className="font-semibold text-primär hover:underline">
          schema
        </button>
        .
      </p>

      {serverfel && <Besked typ="fel">{serverfel}</Besked>}

      <div className="mt-6 flex flex-col gap-5">
        <Input
          etikett="Jobbtitel"
          value={titel}
          onChange={(e) => {
            setTitel(e.target.value);
            rensaFel('titel');
          }}
          placeholder="T.ex. 'Lagerarbetare', 'Serveringspersonal' eller 'Kassabiträde'"
          fel={fel.titel}
        />

        <Textfält
          etikett="Beskrivning"
          value={beskrivning}
          onChange={(e) => {
            setBeskrivning(e.target.value);
            rensaFel('beskrivning');
          }}
          placeholder="Beskriv arbetsuppgifterna och vad du söker hos kandidaten"
          fel={fel.beskrivning}
        />

        <BehörighetsKravRedigerare värde={behorighetsKrav} onÄndra={setBehorighetsKrav} />

        <StadInput
          värde={plats}
          onVälj={(v) => {
            setPlats(v);
            rensaFel('plats');
          }}
          placeholder="Välj stad där passet utförs"
          fel={fel.plats}
        />

        <AdressInput
          värde={adress}
          onÄndra={(v) => {
            setAdress(v);
            rensaFel('adress');
          }}
          stad={plats}
          placeholder="Ange den exakta arbetsplatsen dit personen ska komma"
          fel={fel.adress}
        />

        <KategoriVäljare
          värde={kategori}
          onVälj={(v) => {
            setKategori(v);
            rensaFel('kategori');
          }}
          platshållare="Välj den kategori som bäst beskriver arbetet"
          fel={fel.kategori}
        />

        <div>
          <Input
            etikett="Timlön (kr/tim)"
            type="number"
            inputMode="decimal"
            value={lon}
            onChange={(e) => {
              setLon(e.target.value);
              rensaFel('lon');
            }}
            placeholder="Ange bruttolön per timme i kronor"
            fel={fel.lon}
          />
        </div>

        {/* Antal dagar + dag-för-dag */}
        <div>
          <Input
            etikett="Antal dagar"
            type="number"
            inputMode="numeric"
            min={1}
            fel={fel.antal_dagar}
            value={antalDagar}
            onChange={(e) => hanteraAntalDagar(e.target.value)}
            placeholder="t.ex. 1"
          />
          {dagScheman.length > 1 && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[14px] text-text">
              <input type="checkbox" checked={sammaTider} onChange={toggleSammaTider} className="h-4 w-4 accent-[#1d4ed8]" />
              Samma tider varje dag
            </label>
          )}
          {dagScheman.length > 0 && (
            <div className="mt-3 space-y-3">
              {dagScheman.map((dag, i) => (
                <div key={i} className="rounded-sm border border-kant bg-yta-dämpad p-3">
                  <p className="mb-2 text-[13px] font-semibold text-text-dämpad">Dag {i + 1}</p>
                  <DatumVäljare värde={dag.datum} min={idag} onÄndra={(v) => uppdateraDag(i, 'datum', v)} />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TidVäljare etikett="Start" värde={dag.start} onÄndra={(v) => uppdateraDag(i, 'start', v)} />
                    <TidVäljare etikett="Slut" värde={dag.slut} onÄndra={(v) => uppdateraDag(i, 'slut', v)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <FältFel>{fel.schema}</FältFel>
        </div>

        <div>
          <Input
            etikett="Rast (min)"
            type="number"
            inputMode="numeric"
            min={0}
            step={5}
            value={rastMinuter}
            onChange={(e) => setRastMinuter(e.target.value)}
            placeholder="t.ex. 30"
          />
        </div>

        <OBTilläggRedigerare värde={obTillagg} onÄndra={setObTillagg} />

        {visaPris && (
          <div className="rounded-lg border border-kant bg-primär-mjuk p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-text">Er kostnad (ex. moms)</span>
              <span className="text-[15px] font-semibold text-primär">
                {formateraPris(beräknaFakturapris(lönNum, gällandePåslag))} kr/h
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px] text-text-dämpad">
              <span>Totalt för passet (ex. moms)</span>
              <span>{formateraPris(beräknaFakturapris(brutto, gällandePåslag))} kr</span>
            </div>
          </div>
        )}

        <Knapp variant="primär" full onClick={granska}>
          Publicera pass
        </Knapp>
      </div>

      {/* Förhandsgranskning innan passet publiceras. */}
      {visaFörhandsgranskning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => !laddar && setVisaFörhandsgranskning(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border border-kant bg-yta shadow-lyft">
            <h2 className="rubrik-m px-6 pt-6 text-center text-text">Förhandsgranska passet</h2>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[18px] font-semibold text-text">{titel.trim() || 'Namnlöst pass'}</p>

              <dl className="mt-3 flex flex-col gap-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-[14px] text-text-dämpad">Kategori</dt>
                  <dd className="text-right text-[15px] text-text">{kategori || '–'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[14px] text-text-dämpad">Stad</dt>
                  <dd className="text-right text-[15px] text-text">{plats.trim() || '–'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[14px] text-text-dämpad">Adress</dt>
                  <dd className="text-right text-[15px] text-text">{adress.trim() || '–'}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-kant pt-3">
                <p className="överlinje text-text-dämpad">Datum och tider</p>
                {dagScheman.length === 0 ? (
                  <p className="mt-1 text-[15px] text-text">–</p>
                ) : (
                  dagScheman.map((dag, i) => (
                    <p key={i} className="mt-1 text-[15px] text-text">{formatDagMedTid(dag) || `Dag ${i + 1}`}</p>
                  ))
                )}
              </div>

              <div className="mt-4 border-t border-kant pt-3">
                <p className="överlinje text-text-dämpad">Ersättning</p>
                <p className="mt-1 text-[15px] text-text">{lon ? `${lönNum} kr/tim` : '–'}</p>
                {obTillagg.map((ob, i) => (
                  <p key={i} className="mt-1 text-[15px] text-text">
                    OB {ob.start}–{ob.slut}: {ob.värde}
                    {ob.typ === 'procent' ? '%' : ' kr/tim'}
                  </p>
                ))}
              </div>

              <div className="mt-4 border-t border-kant pt-3">
                <p className="överlinje text-text-dämpad">Beskrivning</p>
                <p className="mt-1 whitespace-pre-wrap text-[15px] text-text">{beskrivning.trim() || '–'}</p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-kant p-4">
              <Knapp variant="kontur" full disabled={laddar} onClick={() => setVisaFörhandsgranskning(false)}>
                Redigera
              </Knapp>
              <Knapp variant="primär" full laddar={laddar} onClick={() => skicka()}>
                Publicera
              </Knapp>
            </div>
          </div>
        </div>
      )}

      {visaPlanval && (
        <PlanvalModal
          onStäng={() => setVisaPlanval(false)}
          laddarFortsätt={laddar}
          laddarUppgradera={laddarUppgradera}
          onFortsätt={() => {
            setVisaPlanval(false);
            skicka({ accepteraHögrePåslag: true });
          }}
          onUppgradera={uppgradera}
        />
      )}

      {/* Publicerings-popup med vägar vidare. */}
      {publiceratJobb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-lg border border-kant bg-yta p-6 shadow-lyft">
            <h2 className="rubrik-m text-center text-text">Pass publicerat! 🎉</h2>
            <div className="mt-6 flex flex-col gap-3">
              <Knapp variant="primär" full onClick={() => router.push(`/annonser/jobb/${publiceratJobb.id}/ansokningar`)}>
                Gå till passet
              </Knapp>
              <button
                type="button"
                onClick={() => router.push('/annonser')}
                className="py-1 text-[14px] font-semibold text-text-svag hover:text-text"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
