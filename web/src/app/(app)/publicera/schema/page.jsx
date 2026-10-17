'use client';

// Publicera schema – fyrstegsflöde med full paritet mot appens PubliceraSchemaScreen.
// Passlogiken ligger i @/utils/schemaPass (synkaPassMotDatum slår ihop valda datum med
// befintliga pass, nyttPassId ger stabila id, tillPayload strippar id:t). Steg 3 har
// EXAKT ETT urvalsläge åt gången: markerade-Set och öppetPassId får aldrig vara satta
// samtidigt. Markeringen rensas vid varje stegbyte.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Textfält from '@/components/ui/Textfält';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import FältFel from '@/components/ui/FältFel';
import StadInput from '@/components/app/StadInput';
import AdressInput from '@/components/app/AdressInput';
import DatumVäljare from '@/components/app/DatumVäljare';
import TidVäljare from '@/components/app/TidVäljare';
import OBTilläggRedigerare from '@/components/app/OBTilläggRedigerare';
import BehörighetsKravRedigerare from '@/components/app/BehörighetsKravRedigerare';
import LöneavdragRedigerare from '@/components/app/LöneavdragRedigerare';
import MånadsKalender from '@/components/app/MånadsKalender';
import MassPassPanel from '@/components/app/MassPassPanel';
import StegIndikator from '@/components/app/StegIndikator';
import PlanvalModal from '@/components/app/PlanvalModal';
import { api, felText } from '@/lib/api';
import { valideraSchema } from '@/utils/schemaValidering';
import { ärGiltigStad } from '@/utils/stad';
import {
  SCHEMATYPER,
  beräknaAvdragFörPass,
  beräknaAvdragTotalt,
  formateraPris,
} from '@/utils/konstanter';
import {
  nyttPassId,
  sorteraPass,
  synkaPassMotDatum,
  uppdateraFält,
  tillämpaPåMarkerade,
  hittaKrockar,
  harNolltid,
  ärKomplett,
  tillPayload,
} from '@/utils/schemaPass';
import { datumTillIso, datumIntervall, veckodagsIndex, veckodagsNamn, formatDagDatum } from '@/utils/datumHelper';
import { saniteraObTillagg } from '@/utils/ob';

const STEG = ['Grunduppgifter', 'Period & datum', 'Detaljer', 'Avdrag'];
const VECKODAGSKNAPPAR = [
  ['Mån', 0], ['Tis', 1], ['Ons', 2], ['Tor', 3], ['Fre', 4], ['Lör', 5], ['Sön', 6],
];

export default function PubliceraSchema() {
  const router = useRouter();
  const idag = datumTillIso(new Date());

  const [steg, setSteg] = useState(1);

  // Steg 1
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [behorighetsKrav, setBehorighetsKrav] = useState([]);
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [typ, setTyp] = useState('');
  const [timlon, setTimlon] = useState('');
  const [sistaAnsokningsdag, setSistaAnsokningsdag] = useState('');
  const [senastBesked, setSenastBesked] = useState('');
  // Privat schema syns inte i den öppna listan – bara för inbjudna (bjuds in via e-post
  // från schemadetaljen efter publicering).
  const [privat, setPrivat] = useState(false);

  // Steg 2
  const [startdatum, setStartdatum] = useState('');
  const [slutdatum, setSlutdatum] = useState('');
  const [valdaDatum, setValdaDatum] = useState(() => new Set());
  const [pass, setPass] = useState([]);

  // Steg 3 – exakt ett urvalsläge
  const [öppetPassId, setÖppetPassId] = useState(null);
  const [markerade, setMarkerade] = useState(() => new Set());

  // Steg 4
  const [avdrag, setAvdrag] = useState([]);

  const [fel, setFel] = useState({});
  const [serverfel, setServerfel] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [visaPlanval, setVisaPlanval] = useState(false);
  const [laddarUppgradera, setLaddarUppgradera] = useState(false);

  const krockar = useMemo(() => hittaKrockar(pass), [pass]);

  // ── Stegbyte: rensar ALLTID urvalet (både markering och öppet pass) ──────────
  function bytSteg(n) {
    setMarkerade(new Set());
    setÖppetPassId(null);
    setFel({});
    setServerfel('');
    setSteg(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  // ── Steg 2: datumval ─────────────────────────────────────────────────────────
  function sättPass(nyaValda, basPass) {
    setPass(synkaPassMotDatum(nyaValda, basPass));
  }

  function toggleDatum(datum) {
    const nya = new Set(valdaDatum);
    if (nya.has(datum)) nya.delete(datum);
    else nya.add(datum);
    setValdaDatum(nya);
    sättPass(nya, pass);
  }

  function genväg(typ) {
    if (typ === 'rensa') {
      setValdaDatum(new Set());
      setPass([]);
      return;
    }
    const alla = datumIntervall(startdatum, slutdatum);
    const matchar = (d) => {
      const vd = veckodagsIndex(d);
      if (typ === 'vardagar') return vd >= 0 && vd <= 4;
      if (typ === 'helger') return vd === 5 || vd === 6;
      return vd === typ; // enskild veckodag (0–6)
    };
    const nya = new Set(valdaDatum);
    for (const d of alla) if (matchar(d)) nya.add(d); // additivt
    setValdaDatum(nya);
    sättPass(nya, pass);
  }

  // ── Steg 3: passredigering ─────────────────────────────────────────────────────
  function radKlick(id) {
    // Finns redan en markering togglar radtrycket kryssrutan i stället för att fälla ut.
    if (markerade.size > 0) markeraPass(id);
    else öppnaPass(id);
  }

  function öppnaPass(id) {
    setMarkerade(new Set()); // öppna rensar markeringen
    setÖppetPassId((nuvarande) => (nuvarande === id ? null : id));
  }

  function markeraPass(id) {
    setÖppetPassId(null); // markera nollar öppet pass
    setMarkerade((prev) => {
      const ny = new Set(prev);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
  }

  function uppdateraPass(id, fält, värde) {
    setPass((prev) => uppdateraFält(prev, new Set([id]), fält, värde));
  }

  function tillämpaMass(utkast, opts) {
    setPass((prev) => tillämpaPåMarkerade(prev, markerade, utkast, opts));
  }

  function läggTillPassSammaDag(datum) {
    setPass((prev) =>
      sorteraPass([...prev, { id: nyttPassId(), datum, starttid: '', sluttid: '', kategori: null, ob_tillagg: [], rast_minuter: 0 }])
    );
  }

  function taBortPass(id) {
    setPass((prev) => {
      const borttaget = prev.find((p) => p.id === id);
      const kvar = prev.filter((p) => p.id !== id);
      // Blev dagen helt tom tas datumet ur valet så att en retur till steg 2 inte
      // återskapar ett tomt pass för en dag man medvetet tömde.
      if (borttaget && !kvar.some((p) => p.datum === borttaget.datum)) {
        setValdaDatum((vd) => {
          const ny = new Set(vd);
          ny.delete(borttaget.datum);
          return ny;
        });
      }
      return kvar;
    });
    setMarkerade((prev) => {
      const ny = new Set(prev);
      ny.delete(id);
      return ny;
    });
    if (öppetPassId === id) setÖppetPassId(null);
  }

  // ── Validering per steg ─────────────────────────────────────────────────────
  function valideraSteg(n) {
    const f = {};
    if (n === 1) {
      if (!titel.trim()) f.titel = 'Ange en titel';
      if (!beskrivning.trim()) f.beskrivning = 'Ange en beskrivning';
      if (!plats.trim()) f.plats = 'Ange en stad';
      else if (!ärGiltigStad(plats)) f.plats = 'Välj en stad från listan';
      if (!adress.trim()) f.adress = 'Ange en adress';
      if (!SCHEMATYPER.some((t) => t.värde === typ)) f.typ = 'Välj en schematyp';
      if (!(parseFloat(timlon) > 0)) f.timlon = 'Ange en timlön';
    } else if (n === 2) {
      if (pass.length === 0) f.pass = 'Välj minst ett datum';
    } else if (n === 3) {
      if (!pass.every(ärKomplett)) f.pass = 'Alla pass måste ha start- och sluttid';
      else if (pass.some(harNolltid)) f.pass = 'Ett pass har samma start- och sluttid';
      else if (krockar.size > 0) f.pass = 'Två pass har samma datum och starttid';
    }
    return f;
  }

  function gåVidare() {
    const f = valideraSteg(steg);
    if (Object.keys(f).length > 0) {
      setFel(f);
      return;
    }
    bytSteg(steg + 1);
  }

  // ── Publicering ─────────────────────────────────────────────────────────────
  async function publicera({ accepteraHögrePåslag = false } = {}) {
    const payloadPass = tillPayload(pass).map((p) => ({ ...p, ob_tillagg: saniteraObTillagg(p.ob_tillagg) }));
    const payloadAvdrag = avdrag
      .filter((a) => a.namn?.trim() && Number(a.belopp) > 0)
      .map((a) => ({ namn: a.namn.trim(), belopp: Number(a.belopp), typ: a.typ || 'per_dag' }));

    const valideringsfel = valideraSchema({ titel, beskrivning, plats, adress, typ, timlon, pass, avdrag });
    if (Object.keys(valideringsfel).some((k) => valideringsfel[k])) {
      setFel(valideringsfel);
      return;
    }

    setServerfel('');
    setLaddar(true);
    try {
      await api.skapaSchema({
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim(),
        adress: adress.trim(),
        typ,
        timlon: parseFloat(timlon),
        pass: payloadPass,
        avdrag: payloadAvdrag,
        behorighets_krav: behorighetsKrav,
        sista_ansokningsdag: sistaAnsokningsdag || null,
        senast_besked: senastBesked || null,
        privat,
        ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
      });
      router.push('/annonser');
    } catch (f) {
      if (f?.kod === 'KRAVER_PLANVAL') setVisaPlanval(true);
      else setServerfel(felText(f));
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

  // Passen grupperade per datum för steg 3.
  const perDatum = useMemo(() => {
    const grupper = new Map();
    for (const p of sorteraPass(pass)) {
      if (!grupper.has(p.datum)) grupper.set(p.datum, []);
      grupper.get(p.datum).push(p);
    }
    return [...grupper.entries()];
  }, [pass]);

  const avdragTotalt = beräknaAvdragTotalt(avdrag, pass.length);
  const avdragPerPass = beräknaAvdragFörPass(avdrag, pass.length);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 rubrik-l text-text">Publicera schema</h1>

      <StegIndikator steg={STEG} aktivt={steg} onHopp={(n) => bytSteg(n)} />

      {serverfel && <Besked typ="fel">{serverfel}</Besked>}

      {/* ── STEG 1 ───────────────────────────────────────────────────────────── */}
      {steg === 1 && (
        <div className="flex flex-col gap-5">
          <Input etikett="Titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="t.ex. Sommarpersonal 2026" fel={fel.titel} />
          <Textfält etikett="Beskrivning" value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} placeholder="Beskriv uppdraget, krav och arbetsuppgifter…" fel={fel.beskrivning} />
          <BehörighetsKravRedigerare värde={behorighetsKrav} onÄndra={setBehorighetsKrav} />
          <StadInput värde={plats} onVälj={setPlats} fel={fel.plats} />
          <AdressInput värde={adress} onÄndra={setAdress} stad={plats} fel={fel.adress} />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-text-dämpad">Schematyp</label>
            <div className="flex flex-wrap gap-2">
              {SCHEMATYPER.map((t) => (
                <button
                  key={t.värde}
                  type="button"
                  onClick={() => setTyp(t.värde)}
                  className={`rounded-pill border px-4 py-2 text-[14px] font-semibold transition-colors ${
                    typ === t.värde ? 'border-primär bg-primär-mjuk text-primär' : 'border-kant text-text-dämpad hover:border-kant-stark'
                  }`}
                >
                  {t.etikett}
                </button>
              ))}
            </div>
            <FältFel>{fel.typ}</FältFel>
          </div>

          <Input etikett="Timlön (kr/tim)" type="number" inputMode="decimal" value={timlon} onChange={(e) => setTimlon(e.target.value)} placeholder="t.ex. 165" fel={fel.timlon} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatumVäljare etikett="Sista ansökningsdag (valfritt)" värde={sistaAnsokningsdag} min={idag} onÄndra={setSistaAnsokningsdag} />
            <DatumVäljare etikett="Senast besked (valfritt)" värde={senastBesked} min={idag} onÄndra={setSenastBesked} />
          </div>

          {/* Privat schema: syns inte i öppna listan, bara för inbjudna. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-kant bg-yta-dämpad p-4">
            <input
              type="checkbox"
              checked={privat}
              onChange={(e) => setPrivat(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#1d4ed8]"
            />
            <span>
              <span className="block text-[15px] font-semibold text-text">Privat schema</span>
              <span className="mt-0.5 block text-[13px] text-text-dämpad">
                Syns inte i den öppna listan. Du bjuder in personer via e-post efter publicering.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* ── STEG 2 ───────────────────────────────────────────────────────────── */}
      {steg === 2 && (
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-text-dämpad">
            Välj period och klicka i de datum som ska ha pass. Perioden är bara ett filter för kalendern.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatumVäljare etikett="Från" värde={startdatum} min={idag} onÄndra={setStartdatum} />
            <DatumVäljare etikett="Till" värde={slutdatum} min={startdatum || idag} onÄndra={setSlutdatum} />
          </div>

          {startdatum && slutdatum && (
            <div className="flex flex-wrap gap-2">
              {VECKODAGSKNAPPAR.map(([namn, index]) => (
                <button key={namn} type="button" onClick={() => genväg(index)} className="rounded-pill border border-kant px-3 py-1.5 text-[13px] font-semibold text-text-dämpad hover:border-primär hover:text-primär">
                  {namn}
                </button>
              ))}
              <button type="button" onClick={() => genväg('vardagar')} className="rounded-pill border border-kant px-3 py-1.5 text-[13px] font-semibold text-text-dämpad hover:border-primär hover:text-primär">
                Vardagar
              </button>
              <button type="button" onClick={() => genväg('helger')} className="rounded-pill border border-kant px-3 py-1.5 text-[13px] font-semibold text-text-dämpad hover:border-primär hover:text-primär">
                Helger
              </button>
              <button type="button" onClick={() => genväg('rensa')} className="rounded-pill border border-kant px-3 py-1.5 text-[13px] font-semibold text-fel hover:bg-fel-mjuk">
                Rensa
              </button>
            </div>
          )}

          <MånadsKalender valdaDatum={valdaDatum} onToggle={toggleDatum} minDatum={startdatum || undefined} maxDatum={slutdatum || undefined} />
          <p className="text-[14px] font-semibold text-text">{pass.length} pass valda</p>
          <FältFel>{fel.pass}</FältFel>
        </div>
      )}

      {/* ── STEG 3 ───────────────────────────────────────────────────────────── */}
      {steg === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-dämpad">
            Fyll i tider och roll per pass. Tryck på ett pass för att redigera, eller använd kryssrutorna för att redigera flera samtidigt.
          </p>

          {markerade.size > 0 && (
            <MassPassPanel
              antalMarkerade={markerade.size}
              onTillämpa={(utkast, opts) => tillämpaMass(utkast, opts)}
              onAvmarkera={() => setMarkerade(new Set())}
            />
          )}

          {perDatum.map(([datum, dagensPass]) => (
            <div key={datum}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[13px] font-bold uppercase tracking-wider text-text-svag">
                  {veckodagsNamn(datum)} {formatDagDatum(datum)}
                </p>
                <button type="button" onClick={() => läggTillPassSammaDag(datum)} className="text-[13px] font-semibold text-primär hover:underline">
                  + Pass samma dag
                </button>
              </div>
              <div className="space-y-2">
                {dagensPass.map((p) => {
                  const öppen = öppetPassId === p.id;
                  const markerad = markerade.has(p.id);
                  const fellaktig = krockar.has(p.id) || harNolltid(p);
                  const komplett = ärKomplett(p) && !fellaktig;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-sm border bg-yta ${
                        fellaktig ? 'border-fel' : komplett ? 'border-framgång' : 'border-kant'
                      }`}
                    >
                      <div className="flex items-center gap-3 p-3">
                        {markerade.size > 0 && (
                          <input type="checkbox" checked={markerad} onChange={() => markeraPass(p.id)} className="h-4 w-4 accent-[#1d4ed8]" />
                        )}
                        <button type="button" onClick={() => radKlick(p.id)} className="flex flex-1 items-center justify-between text-left">
                          <span className="text-[15px] font-semibold text-text">
                            {p.starttid && p.sluttid ? `${p.starttid}–${p.sluttid}` : 'Ange tider'}
                            {p.kategori ? ` · ${p.kategori}` : ''}
                          </span>
                          <span className="text-[13px] text-text-svag">{öppen ? 'Stäng' : 'Redigera'}</span>
                        </button>
                        {!markerade.size && (
                          <button type="button" onClick={() => markeraPass(p.id)} aria-label="Markera" className="text-[13px] font-semibold text-text-svag hover:text-primär">
                            ☑
                          </button>
                        )}
                      </div>

                      {öppen && (
                        <div className="border-t border-kant p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <TidVäljare etikett="Starttid" värde={p.starttid} onÄndra={(v) => uppdateraPass(p.id, 'starttid', v)} />
                            <TidVäljare etikett="Sluttid" värde={p.sluttid} onÄndra={(v) => uppdateraPass(p.id, 'sluttid', v)} />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-semibold text-text-dämpad">Roll (valfritt)</label>
                              <input value={p.kategori ?? ''} onChange={(e) => uppdateraPass(p.id, 'kategori', e.target.value)} placeholder="t.ex. Liftvärd" className="w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär focus:bg-yta" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-semibold text-text-dämpad">Rast (min)</label>
                              <input type="number" min="0" value={p.rast_minuter ?? 0} onChange={(e) => uppdateraPass(p.id, 'rast_minuter', Number(e.target.value))} className="w-full rounded-sm border border-kant bg-yta-dämpad px-3.5 py-3 text-[15px] text-text outline-none focus:border-primär focus:bg-yta" />
                            </div>
                          </div>
                          <div className="mt-3">
                            <OBTilläggRedigerare värde={p.ob_tillagg} onÄndra={(v) => uppdateraPass(p.id, 'ob_tillagg', v)} kompakt />
                          </div>
                          <button type="button" onClick={() => taBortPass(p.id)} className="mt-3 text-[13px] font-semibold text-fel hover:underline">
                            Ta bort pass
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <FältFel>{fel.pass}</FältFel>
        </div>
      )}

      {/* ── STEG 4 ───────────────────────────────────────────────────────────── */}
      {steg === 4 && (
        <div className="flex flex-col gap-5">
          <LöneavdragRedigerare värde={avdrag} onÄndra={setAvdrag} />
          <FältFel>{fel.avdrag}</FältFel>

          {avdrag.length > 0 && (
            <div className="rounded-lg border border-kant bg-yta p-4">
              <p className="text-[14px] font-semibold text-text">Avdragsöversikt</p>
              <div className="mt-2 flex justify-between text-[14px] text-text-dämpad">
                <span>Per pass (snitt)</span>
                <span className="font-semibold text-text">{formateraPris(avdragPerPass)} kr</span>
              </div>
              <div className="flex justify-between text-[14px] text-text-dämpad">
                <span>Totalt över {pass.length} pass</span>
                <span className="font-semibold text-text">{formateraPris(avdragTotalt)} kr</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-kant bg-yta-dämpad p-4 text-[14px] text-text-dämpad">
            <p className="font-semibold text-text">Klart att publicera</p>
            <p className="mt-1">
              {pass.length} pass · {typ && SCHEMATYPER.find((t) => t.värde === typ)?.etikett} · {timlon} kr/tim
            </p>
          </div>
        </div>
      )}

      {/* ── Stegnavigering ───────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {steg > 1 ? (
          <Knapp variant="kontur" onClick={() => bytSteg(steg - 1)}>
            Tillbaka
          </Knapp>
        ) : (
          <span />
        )}
        {steg < 4 ? (
          <Knapp variant="primär" onClick={gåVidare}>
            Nästa
          </Knapp>
        ) : (
          <Knapp variant="primär" laddar={laddar} onClick={() => publicera()}>
            Publicera schema
          </Knapp>
        )}
      </div>

      {visaPlanval && (
        <PlanvalModal
          onStäng={() => setVisaPlanval(false)}
          laddarFortsätt={laddar}
          laddarUppgradera={laddarUppgradera}
          onFortsätt={() => {
            setVisaPlanval(false);
            publicera({ accepteraHögrePåslag: true });
          }}
          onUppgradera={uppgradera}
        />
      )}
    </div>
  );
}
