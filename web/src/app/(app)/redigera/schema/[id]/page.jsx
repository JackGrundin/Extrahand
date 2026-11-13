'use client';

// Redigera ett publicerat schema. Speglar appens RedigeraSchemaScreen: grunduppgifter sparas
// via PUT /scheman/:id medan pass och löneavdrag läggs till/tas bort direkt mot sina egna
// endpoints. Befintliga pass flyttas aldrig – ska ett pass flyttas tas det bort och läggs till
// på nytt (samma regel som backend). Redigering tillåts BARA innan någon godkänts; knappen i
// Mina annonser döljs då redan, och den här sidan är sista spärren klient-sidan.
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { api, felText } from '@/lib/api';
import { normaliseraKrav } from '@/utils/behorighet';
import { ärGiltigStad } from '@/utils/stad';
import { saniteraObTillagg } from '@/utils/ob';
import { datumTillIso, formatDagDatum, veckodagsNamn } from '@/utils/datumHelper';
import { SCHEMATYPER, formateraPris, beräknaAvdragFörPass } from '@/utils/konstanter';

const TOMT_PASS = { datum: '', starttid: '', sluttid: '', kategori: '', ob_tillagg: [], rast_minuter: '' };

export default function RedigeraSchema() {
  const router = useRouter();
  const { id } = useParams();

  const [schema, setSchema] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [laddfel, setLaddfel] = useState('');
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState({});

  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [typ, setTyp] = useState('');
  const [timlon, setTimlon] = useState('');
  const [behorighetsKrav, setBehorighetsKrav] = useState([]);
  const [sistaAnsokningsdag, setSistaAnsokningsdag] = useState('');
  const [senastBesked, setSenastBesked] = useState('');

  const [avdrag, setAvdrag] = useState([]);
  const [avdragFormVisas, setAvdragFormVisas] = useState(false);
  const [avdragNamn, setAvdragNamn] = useState('');
  const [avdragBelopp, setAvdragBelopp] = useState('');
  const [avdragTyp, setAvdragTyp] = useState('per_dag');

  const [passFormVisas, setPassFormVisas] = useState(false);
  const [nyttPass, setNyttPass] = useState(TOMT_PASS);

  const idag = datumTillIso(new Date());

  const hämta = useCallback(async () => {
    try {
      const data = await api.hämtaSchema(id);
      setSchema(data);
      setTitel(data.titel ?? '');
      setBeskrivning(data.beskrivning ?? '');
      setPlats(data.plats ?? '');
      setAdress(data.adress ?? '');
      setTyp(data.typ ?? '');
      setTimlon(data.timlon != null ? String(data.timlon) : '');
      setBehorighetsKrav(normaliseraKrav(data.behorighets_krav));
      setSistaAnsokningsdag(data.sista_ansokningsdag ?? '');
      setSenastBesked(data.senast_besked ?? '');
      setAvdrag(data.avdrag ?? []);
    } catch (f) {
      setLaddfel(felText(f));
    } finally {
      setLaddar(false);
    }
  }, [id]);

  useEffect(() => {
    hämta();
  }, [hämta]);

  function rensaFel(nyckel) {
    setFel((prev) => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  // ------------------------------------------------------------ Grunduppgifter

  async function sparaGrunduppgifter() {
    const nya = {};
    if (!titel.trim()) nya.titel = 'Titel krävs';
    if (!beskrivning.trim()) nya.beskrivning = 'Beskrivning krävs';
    // Staden måste väljas ur ortlistan – fri text splittrar stadsmatchningen i backend.
    if (!plats.trim()) nya.plats = 'Ange en stad';
    else if (!ärGiltigStad(plats)) nya.plats = 'Välj en stad från listan';
    if (!adress.trim()) nya.adress = 'Adress krävs';
    if (!SCHEMATYPER.some((t) => t.värde === typ)) nya.typ = 'Välj en schematyp';
    const lön = parseFloat(String(timlon).replace(',', '.'));
    if (!(lön > 0)) nya.timlon = 'Ange en timlön större än noll';
    if (Object.keys(nya).length) return setFel(nya);
    setFel({});

    setSparar(true);
    try {
      // Bara fälten här skickas. PUT rör inte fält som utelämnas, så kategorin står kvar orörd.
      await api.uppdateraSchema(id, {
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim(),
        adress: adress.trim(),
        typ,
        timlon: lön,
        behorighets_krav: behorighetsKrav,
        // Tom sträng nollar datumet på servern.
        sista_ansokningsdag: sistaAnsokningsdag || null,
        senast_besked: senastBesked || null,
      });
      await hämta();
    } catch (f) {
      setFel({ server: felText(f) });
    } finally {
      setSparar(false);
    }
  }

  // ------------------------------------------------------------ Löneavdrag

  async function sparaAvdrag() {
    const belopp = parseFloat(String(avdragBelopp).replace(',', '.'));
    if (!avdragNamn.trim()) return window.alert('Ge avdraget ett namn, t.ex. Boende.');
    if (!(belopp > 0)) return window.alert('Ange ett belopp större än noll.');

    setSparar(true);
    try {
      await api.skapaSchemaAvdrag(id, { namn: avdragNamn.trim(), belopp, typ: avdragTyp });
      setAvdragNamn('');
      setAvdragBelopp('');
      setAvdragTyp('per_dag');
      setAvdragFormVisas(false);
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setSparar(false);
    }
  }

  async function taBortAvdrag(a) {
    if (!window.confirm(`Ta bort löneavdraget "${a.namn}"?`)) return;
    setSparar(true);
    try {
      await api.taBortSchemaAvdrag(id, a.id);
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setSparar(false);
    }
  }

  // ------------------------------------------------------------ Pass

  async function läggTillPass() {
    if (!nyttPass.datum) return window.alert('Välj ett datum för passet.');
    if (!nyttPass.starttid || !nyttPass.sluttid) return window.alert('Fyll i både start- och sluttid.');
    if (nyttPass.starttid === nyttPass.sluttid) {
      return window.alert('Start- och sluttid kan inte vara samma – passet blir noll timmar.');
    }

    setSparar(true);
    try {
      const ob = saniteraObTillagg(nyttPass.ob_tillagg);
      await api.läggTillSchemaPass(id, [{
        datum: nyttPass.datum,
        starttid: nyttPass.starttid,
        sluttid: nyttPass.sluttid,
        // Tom roll blir null = ärv schemats värde, inte tom sträng. Rollen är fri text.
        kategori: nyttPass.kategori?.trim() || null,
        ob_tillagg: ob.length ? ob : null,
        rast_minuter: Number(nyttPass.rast_minuter) || 0,
      }]);
      setNyttPass(TOMT_PASS);
      setPassFormVisas(false);
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setSparar(false);
    }
  }

  async function taBortPass(p) {
    if (!window.confirm(`Ta bort passet ${veckodagsNamn(p.datum)} ${formatDagDatum(p.datum)}, ${p.starttid}–${p.sluttid}?`)) {
      return;
    }
    setSparar(true);
    try {
      await api.taBortSchemaPass(id, p.id);
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setSparar(false);
    }
  }

  // Markera ett kommande pass som inställt (sjukdom/frånvaro). Reversibelt – behåller
  // personen och ansökan, till skillnad från "Ta bort". Orsaken är frivillig.
  async function ställInPass(p) {
    const orsak = window.prompt('Orsak till att passet ställs in (frivilligt):', '');
    if (orsak === null) return; // Avbröt dialogen.
    setSparar(true);
    try {
      await api.ställInSchemaPass(id, p.id, orsak.trim());
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
      setSparar(false);
    }
  }

  async function återställPass(p) {
    setSparar(true);
    try {
      await api.återställSchemaPass(id, p.id);
      await hämta();
    } catch (f) {
      window.alert(felText(f));
    } finally {
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

  if (laddfel) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="rubrik-l text-text">Redigera schema</h1>
        <div className="mt-6"><Besked typ="fel">{laddfel}</Besked></div>
        <Link href="/annonser" className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline">
          ← Till Mina annonser
        </Link>
      </div>
    );
  }

  if (!schema) return null;

  // Är schemat tillsatt får det inte redigeras här – personen har tackat ja till villkoren.
  if (schema.anvandare_id != null) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="rubrik-l text-text">Redigera schema</h1>
        <div className="mt-6">
          <Besked typ="info">
            Schemat är redan tillsatt och kan inte redigeras.{' '}
            {schema.personNamn ? `${schema.personNamn} är godkänd.` : ''}
          </Besked>
        </div>
        <Link href="/annonser" className="mt-4 inline-block text-[14px] font-semibold text-primär hover:underline">
          ← Till Mina annonser
        </Link>
      </div>
    );
  }

  const kommandePass = (schema.pass ?? []).filter((p) => p.status === 'planerad');

  // Spara-knappen rör BARA grunduppgifterna – avdrag och pass sparas direkt när de ändras.
  // Jämförelserna normaliserar EXAKT som hämta() seedar, annars ser knappen ändrad ut direkt.
  const ärÄndrat =
    titel !== (schema.titel ?? '') ||
    beskrivning !== (schema.beskrivning ?? '') ||
    plats !== (schema.plats ?? '') ||
    adress !== (schema.adress ?? '') ||
    typ !== (schema.typ ?? '') ||
    timlon !== (schema.timlon != null ? String(schema.timlon) : '') ||
    sistaAnsokningsdag !== (schema.sista_ansokningsdag ?? '') ||
    senastBesked !== (schema.senast_besked ?? '') ||
    JSON.stringify(behorighetsKrav) !== JSON.stringify(normaliseraKrav(schema.behorighets_krav));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/annonser" className="text-[14px] font-semibold text-primär hover:underline">
        ← Mina annonser
      </Link>
      <h1 className="mt-2 rubrik-l text-text">Redigera schema</h1>
      <p className="mt-1 text-[15px] text-text-dämpad">Ändra schemat innan någon godkänts.</p>

      {fel.server && <Besked typ="fel">{fel.server}</Besked>}

      {/* ------------------------------------------------------- Grunduppgifter */}
      <div className="mt-6 flex flex-col gap-5">
        <Input
          etikett="Titel"
          value={titel}
          onChange={(e) => { setTitel(e.target.value); rensaFel('titel'); }}
          maxLength={80}
          fel={fel.titel}
        />

        <Textfält
          etikett="Beskrivning"
          value={beskrivning}
          onChange={(e) => { setBeskrivning(e.target.value); rensaFel('beskrivning'); }}
          fel={fel.beskrivning}
        />

        <BehörighetsKravRedigerare värde={behorighetsKrav} onÄndra={setBehorighetsKrav} />

        <StadInput
          värde={plats}
          onVälj={(v) => { setPlats(v); rensaFel('plats'); }}
          fel={fel.plats}
        />

        <AdressInput
          värde={adress}
          onÄndra={(v) => { setAdress(v); rensaFel('adress'); }}
          stad={plats}
          fel={fel.adress}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-text-dämpad">Schematyp</label>
          <div className="flex flex-wrap gap-2">
            {SCHEMATYPER.map((t) => (
              <button
                key={t.värde}
                type="button"
                onClick={() => { setTyp(t.värde); rensaFel('typ'); }}
                className={`rounded-pill border px-4 py-2 text-[14px] font-semibold transition-colors ${
                  typ === t.värde
                    ? 'border-primär bg-primär text-white'
                    : 'border-kant bg-yta text-text-dämpad hover:border-kant-stark'
                }`}
              >
                {t.etikett}
              </button>
            ))}
          </div>
          <FältFel>{fel.typ}</FältFel>
        </div>

        <Input
          etikett="Timlön (kr/tim)"
          type="number"
          inputMode="decimal"
          value={timlon}
          onChange={(e) => { setTimlon(e.target.value); rensaFel('timlon'); }}
          fel={fel.timlon}
        />

        <DatumVäljare
          etikett="Sista ansökningsdag (valfritt)"
          värde={sistaAnsokningsdag}
          onÄndra={setSistaAnsokningsdag}
        />

        <DatumVäljare
          etikett="Senast besked (valfritt)"
          värde={senastBesked}
          onÄndra={setSenastBesked}
        />

        <Knapp variant="primär" full laddar={sparar} onClick={sparaGrunduppgifter} disabled={!ärÄndrat}>
          Spara ändringar
        </Knapp>
      </div>

      {/* ------------------------------------------------------- Löneavdrag */}
      <div className="mt-10">
        <h2 className="rubrik-m text-text">Löneavdrag</h2>
        <p className="mt-1 text-[13px] text-text-svag">
          Dras från personens utbetalning – påverkar inte vad ni faktureras.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {avdrag.length === 0 && !avdragFormVisas && (
            <p className="text-[14px] italic text-text-svag">Inga löneavdrag.</p>
          )}
          {avdrag.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-sm border border-[#fecaca] bg-fel-mjuk p-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fel">{a.namn}</p>
                <p className="text-[12px] text-fel">
                  {Number(a.belopp).toLocaleString('sv-SE')} kr {a.typ === 'totalt' ? 'totalt för perioden' : 'per pass'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => taBortAvdrag(a)}
                disabled={sparar}
                className="shrink-0 text-[13px] font-semibold text-fel hover:underline disabled:opacity-60"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>

        {avdrag.length > 0 && kommandePass.length > 0 && (
          <p className="mt-2 text-[12px] text-fel">
            Dras från lönen: {formateraPris(beräknaAvdragFörPass(avdrag, schema.antalPass ?? kommandePass.length))} kr per pass.
            Fakturan till företaget påverkas inte.
          </p>
        )}

        {avdragFormVisas ? (
          <div className="mt-3 rounded-sm border border-[#fecaca] bg-fel-mjuk p-3">
            <input
              value={avdragNamn}
              onChange={(e) => setAvdragNamn(e.target.value)}
              placeholder="Namn, t.ex. Boende"
              maxLength={40}
              className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={avdragBelopp}
                onChange={(e) => setAvdragBelopp(e.target.value)}
                placeholder="Belopp (kr)"
                className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
              />
              <select
                value={avdragTyp}
                onChange={(e) => setAvdragTyp(e.target.value)}
                className="w-full rounded-sm border border-kant bg-yta px-3 py-3 text-[15px] text-text outline-none focus:border-primär"
              >
                <option value="per_dag">Per pass</option>
                <option value="totalt">Totalt (fördelas)</option>
              </select>
            </div>
            <p className="mt-2 text-[12px] text-fel">
              {avdragTyp === 'totalt' ? 'Fördelas jämnt över schemats pass.' : 'Dras per pass – två pass samma dag ger två avdrag.'}
              {' '}Gäller från nästa rapporterade pass; redan rapporterade påverkas inte.
            </p>
            <div className="mt-3 flex gap-2">
              <Knapp variant="kontur" onClick={() => setAvdragFormVisas(false)} disabled={sparar}>
                Avbryt
              </Knapp>
              <Knapp variant="primär" laddar={sparar} onClick={sparaAvdrag}>
                Lägg till
              </Knapp>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAvdragFormVisas(true)}
            disabled={sparar}
            className="mt-3 self-start rounded-sm border border-dashed border-kant-stark px-4 py-2 text-[14px] font-semibold text-fel hover:bg-fel-mjuk disabled:opacity-60"
          >
            + Lägg till löneavdrag
          </button>
        )}
      </div>

      {/* ------------------------------------------------------- Pass */}
      <div className="mt-10">
        <h2 className="rubrik-m text-text">Pass ({kommandePass.length})</h2>
        <p className="mt-1 text-[13px] text-text-svag">
          Datum och tider på befintliga pass går inte att ändra. Behöver ett pass flyttas: ta
          bort det och lägg till ett nytt.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {kommandePass.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-sm border border-kant bg-yta-dämpad p-3">
              <div className="w-20 shrink-0">
                <p className="text-[11px] font-semibold uppercase text-text-svag">{veckodagsNamn(p.datum)}</p>
                <p className="text-[13px] font-semibold text-text">{formatDagDatum(p.datum)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-text">{p.starttid} – {p.sluttid}</p>
                {p.kategori && <p className="text-[12px] text-text-dämpad">{p.kategori}</p>}
                {p.rast_minuter > 0 && <p className="text-[12px] text-text-svag">{p.rast_minuter} min rast</p>}
                {p.installt_at && (
                  <p className="text-[12px] font-semibold text-varning">
                    Inställt{p.installt_orsak ? ` · ${p.installt_orsak}` : ''}
                  </p>
                )}
              </div>
              {p.installt_at ? (
                <button
                  type="button"
                  onClick={() => återställPass(p)}
                  disabled={sparar}
                  className="shrink-0 text-[13px] font-semibold text-primär hover:underline disabled:opacity-60"
                >
                  Ångra
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => ställInPass(p)}
                  disabled={sparar}
                  className="shrink-0 text-[13px] font-semibold text-varning hover:underline disabled:opacity-60"
                >
                  Markera som inställt
                </button>
              )}
              <button
                type="button"
                onClick={() => taBortPass(p)}
                disabled={sparar}
                className="shrink-0 text-[13px] font-semibold text-fel hover:underline disabled:opacity-60"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>

        {passFormVisas ? (
          <div className="mt-3 rounded-sm border border-kant bg-primär-mjuk p-3">
            <DatumVäljare
              etikett="Datum"
              värde={nyttPass.datum}
              min={idag}
              onÄndra={(v) => setNyttPass((p) => ({ ...p, datum: v }))}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <TidVäljare etikett="Start" värde={nyttPass.starttid} onÄndra={(v) => setNyttPass((p) => ({ ...p, starttid: v }))} />
              <TidVäljare etikett="Slut" värde={nyttPass.sluttid} onÄndra={(v) => setNyttPass((p) => ({ ...p, sluttid: v }))} />
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-text-dämpad">Roll (valfritt)</label>
              <input
                value={nyttPass.kategori}
                onChange={(e) => setNyttPass((p) => ({ ...p, kategori: e.target.value }))}
                placeholder="t.ex. Liftvärd"
                maxLength={40}
                className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
              />
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-text-dämpad">Rast (minuter, valfritt)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={nyttPass.rast_minuter}
                onChange={(e) => setNyttPass((p) => ({ ...p, rast_minuter: e.target.value }))}
                placeholder="0"
                className="w-full rounded-sm border border-kant bg-yta px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-svag focus:border-primär"
              />
            </div>
            <div className="mt-3">
              <OBTilläggRedigerare värde={nyttPass.ob_tillagg} onÄndra={(v) => setNyttPass((p) => ({ ...p, ob_tillagg: v }))} />
            </div>
            <div className="mt-3 flex gap-2">
              <Knapp variant="kontur" onClick={() => { setPassFormVisas(false); setNyttPass(TOMT_PASS); }} disabled={sparar}>
                Avbryt
              </Knapp>
              <Knapp variant="primär" laddar={sparar} onClick={läggTillPass}>
                Lägg till pass
              </Knapp>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPassFormVisas(true)}
            disabled={sparar}
            className="mt-3 self-start rounded-sm border border-dashed border-kant-stark px-4 py-2 text-[14px] font-semibold text-primär hover:bg-primär-mjuk disabled:opacity-60"
          >
            + Lägg till pass
          </button>
        )}
      </div>

      <div className="h-16" />
    </div>
  );
}
