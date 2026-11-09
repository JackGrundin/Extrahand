'use client';

// Redigera ett publicerat pass. Speglar appens RedigeraJobbScreen och webbens
// publicera/jobb: samma fält, samma validering (valideraJobb), samma payload – men laddar
// befintlig data och sparar via PUT /jobb/:id. Redigering tillåts BARA innan någon godkänts;
// knappen i Mina annonser döljs då redan, och den här sidan är sista spärren klient-sidan
// (en godkänd person har redan tackat ja till villkoren annonsen beskriver).
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { api, felText } from '@/lib/api';
import { valideraJobb } from '@/utils/jobbValidering';
import { normaliseraKrav } from '@/utils/behorighet';
import { datumTillIso, parsaArbetstider, parsaObTillagg, planeradeTimmar } from '@/utils/datumHelper';
import { saniteraObTillagg } from '@/utils/ob';
import { beräknaFakturapris, formateraPris, PÅSLAG_PRO } from '@/utils/konstanter';

export default function RedigeraJobb() {
  const router = useRouter();
  const { id } = useParams();

  const [laddar, setLaddar] = useState(true);
  // Spärr: jobbet har redan en godkänd ansökan och får inte redigeras.
  const [spärrad, setSpärrad] = useState(false);
  const [laddfel, setLaddfel] = useState('');
  // Den ursprungliga typen bevaras (publiceringen hårdkodar 'gig', men vi rör aldrig typen här).
  const [typ, setTyp] = useState('gig');

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
  const [sparar, setSparar] = useState(false);

  // Dagens datum som undre gräns för datumväljarna (man flyttar inte pass till det förflutna).
  const idag = datumTillIso(new Date());

  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        // Hämta jobbet och dess ansökningar parallellt. En godkänd ansökan spärrar redigering.
        const [jobb, ansökningar] = await Promise.all([
          api.hämtaJobb(id),
          api.ansökningarFörJobb(id).catch(() => []),
        ]);
        if (avbruten) return;

        const harGodkänd = (Array.isArray(ansökningar) ? ansökningar : []).some(
          (a) => a.status === 'godkänd'
        );
        if (harGodkänd) {
          setSpärrad(true);
          return;
        }

        // Förifyll ur svaret (PascalCase från backend).
        setTitel(jobb.Titel ?? '');
        setBeskrivning(jobb.Beskrivning ?? '');
        setPlats(jobb.Plats ?? '');
        setAdress(jobb.adress ?? '');
        setLon(jobb.Lon != null ? String(Math.round(Number(jobb.Lon))) : '');
        setTyp(jobb.Typ || 'gig');
        setKategori(jobb.Kategori ?? '');
        setBehorighetsKrav(normaliseraKrav(jobb.behorighets_krav));
        setObTillagg(parsaObTillagg(jobb.ob_tillagg));
        const dagar = (parsaArbetstider(jobb.arbetstider) ?? [])
          .filter((d) => d?.datum)
          .map((d) => ({ datum: d.datum, start: d.start || '08:00', slut: d.slut || '17:00' }));
        setDagScheman(dagar);
        setAntalDagar(dagar.length ? String(dagar.length) : '');
      } catch (f) {
        if (!avbruten) setLaddfel(felText(f));
      } finally {
        if (!avbruten) setLaddar(false);
      }
    })();
    return () => {
      avbruten = true;
    };
  }, [id]);

  function rensaFel(nyckel) {
    setFel((prev) => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  function hanteraAntalDagar(val) {
    setAntalDagar(val);
    rensaFel('schema');
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

  async function skicka() {
    const valideringsfel = valideraJobb({ titel, beskrivning, kategori, plats, adress, lon, dagScheman });
    if (Object.keys(valideringsfel).some((k) => valideringsfel[k])) {
      setFel(valideringsfel);
      return;
    }

    setServerfel('');
    setSparar(true);
    try {
      await api.uppdateraJobb(id, {
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        adress: adress.trim(),
        lon: lon ? parseInt(lon) : undefined,
        typ,
        kategori: kategori || undefined,
        antal_dagar: dagScheman.length || undefined,
        arbetstider: dagScheman.length > 0 ? JSON.stringify(dagScheman) : undefined,
        ob_tillagg: saniteraObTillagg(obTillagg),
        behorighets_krav: behorighetsKrav,
      });
      router.push('/annonser');
    } catch (f) {
      setServerfel(felText(f));
      setSparar(false);
    }
  }

  if (laddar) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
      </div>
    );
  }

  if (spärrad) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="rubrik-l text-text">Redigera pass</h1>
        <div className="mt-6">
          <Besked typ="info">
            Det här passet är redan tillsatt och kan inte redigeras. En godkänd person har
            tackat ja till villkoren.
          </Besked>
        </div>
        <Link href="/annonser" className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline">
          ← Till Mina annonser
        </Link>
      </div>
    );
  }

  if (laddfel) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="rubrik-l text-text">Redigera pass</h1>
        <div className="mt-6">
          <Besked typ="fel">{laddfel}</Besked>
        </div>
        <Link href="/annonser" className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline">
          ← Till Mina annonser
        </Link>
      </div>
    );
  }

  // Prisförhandsvisning: brutto = timlön × planerade timmar, fakturabelopp med lägsta påslaget.
  const lönNum = parseFloat(lon) || 0;
  const timmar = planeradeTimmar(dagScheman);
  const brutto = lönNum * (timmar || 0);
  const visaPris = lönNum > 0 && timmar > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/annonser" className="text-[14px] font-semibold text-primär hover:underline">
        ← Mina annonser
      </Link>
      <h1 className="mt-2 rubrik-l text-text">Redigera pass</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">Ändra passet innan någon godkänts.</p>

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

        <KategoriVäljare
          värde={kategori}
          onVälj={(v) => {
            setKategori(v);
            rensaFel('kategori');
          }}
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
            placeholder="t.ex. 185"
            fel={fel.lon}
          />
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

        {visaPris && (
          <div className="rounded-lg border border-kant bg-primär-mjuk p-4">
            <p className="text-[14px] font-semibold text-text">Kostnad</p>
            <div className="mt-2 flex justify-between text-[14px] text-text-dämpad">
              <span>{formateraPris(lönNum)} kr/tim × {timmar} h (brutto)</span>
              <span className="font-semibold text-text">{formateraPris(brutto)} kr</span>
            </div>
            <div className="flex justify-between text-[14px] text-text-dämpad">
              <span>Fakturabelopp exkl. moms</span>
              <span className="font-semibold text-text">{formateraPris(beräknaFakturapris(brutto, PÅSLAG_PRO))} kr</span>
            </div>
          </div>
        )}

        <Knapp variant="primär" full laddar={sparar} onClick={skicka}>
          Spara ändringar
        </Knapp>
      </div>
    </div>
  );
}
