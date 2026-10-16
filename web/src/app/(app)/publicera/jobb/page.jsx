'use client';

// Publicera ett enstaka pass. Speglar appens PubliceraJobbScreen: samma fält, samma
// validering (valideraJobb), samma payload. Backend är sista försvaret och svarar
// KRAVER_PLANVAL (409) om gratiskontot förbrukat månadens två pass – då visas planvalet
// och publiceringen görs om med acceptera_hogre_paslag.
import { useEffect, useMemo, useState } from 'react';
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
import { beräknaFakturapris, formateraPris, PÅSLAG_GRATIS } from '@/utils/konstanter';
import { datumTillIso } from '@/utils/datumHelper';
import { saniteraObTillagg } from '@/utils/ob';

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
  const [kategori, setKategori] = useState('');

  const [fel, setFel] = useState({});
  const [serverfel, setServerfel] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [prenumeration, setPrenumeration] = useState(null);
  const [visaPlanval, setVisaPlanval] = useState(false);
  const [laddarUppgradera, setLaddarUppgradera] = useState(false);

  // Dagens datum som undre gräns för datumväljarna (man publicerar inte pass i det förflutna).
  const idag = datumTillIso(new Date());

  useEffect(() => {
    api.prenumerationStatus().then(setPrenumeration).catch(() => {});
  }, []);

  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;

  const fakturaPreview = useMemo(() => {
    const l = parseFloat(lon);
    if (!(l > 0)) return null;
    return beräknaFakturapris(l, gällandePåslag);
  }, [lon, gällandePåslag]);

  function rensaFel(nyckel) {
    setFel((prev) => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  function hanteraAntalDagar(val) {
    setAntalDagar(val);
    rensaFel('schema');
    const n = parseInt(val) || 0;
    setDagScheman((prev) => Array.from({ length: n }, (_, i) => prev[i] || { datum: '', start: '', slut: '' }));
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

  async function skicka({ accepteraHögrePåslag = false } = {}) {
    const valideringsfel = valideraJobb({ titel, beskrivning, kategori, plats, adress, lon, dagScheman });
    if (Object.keys(valideringsfel).some((k) => valideringsfel[k])) {
      setFel(valideringsfel);
      return;
    }

    setServerfel('');
    setLaddar(true);
    try {
      await api.publicera({
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
        behorighets_krav: behorighetsKrav,
        ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
      });
      router.push('/annonser');
    } catch (f) {
      if (f?.kod === 'KRAVER_PLANVAL') {
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
          placeholder="t.ex. Servitör – lunchpass"
          fel={fel.titel}
        />

        <Textfält
          etikett="Beskrivning"
          value={beskrivning}
          onChange={(e) => {
            setBeskrivning(e.target.value);
            rensaFel('beskrivning');
          }}
          placeholder="Beskriv tjänsten, krav och arbetsuppgifter…"
          fel={fel.beskrivning}
        />

        <BehörighetsKravRedigerare värde={behorighetsKrav} onÄndra={setBehorighetsKrav} />

        <StadInput
          värde={plats}
          onVälj={(v) => {
            setPlats(v);
            rensaFel('plats');
          }}
          fel={fel.plats}
        />

        <AdressInput
          värde={adress}
          onÄndra={(v) => {
            setAdress(v);
            rensaFel('adress');
          }}
          stad={plats}
          fel={fel.adress}
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
            placeholder="t.ex. 185"
            fel={fel.lon}
          />
          {fakturaPreview != null && (
            <p className="mt-1.5 text-[13px] text-text-dämpad">
              Ni faktureras{' '}
              <span className="font-semibold text-text">{formateraPris(fakturaPreview)} kr/tim</span>{' '}
              ({Math.round(gällandePåslag * 100)}% påslag).
            </p>
          )}
        </div>

        {/* Antal dagar + dag-för-dag */}
        <div>
          <Input
            etikett="Antal dagar"
            type="number"
            inputMode="numeric"
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

        <OBTilläggRedigerare värde={obTillagg} onÄndra={setObTillagg} />

        <KategoriVäljare
          värde={kategori}
          onVälj={(v) => {
            setKategori(v);
            rensaFel('kategori');
          }}
          fel={fel.kategori}
        />

        <Knapp variant="primär" full laddar={laddar} onClick={() => skicka()}>
          Publicera pass
        </Knapp>
      </div>

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
    </div>
  );
}
