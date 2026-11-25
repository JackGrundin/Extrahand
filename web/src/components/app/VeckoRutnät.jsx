'use client';

// Veckorutnät för Schemaöversikt: en rad per bemannad person, en kolumn per dag (Mån–Sön)
// i vald vecka. Visar tider, roller, obesatta pass och en kostnadsrad (fakturakostnad).
// Växlas in via toggle i kalendersidan; månadsvyn är ett eget läge. Datan är hela pass-
// arrayen från GET /scheman/kalender – vi filtrerar till vald vecka här i frontend.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { rollFärg, beräknaFakturapris, påslagEller40, formateraPris } from '@/utils/konstanter';
import { datumTillIso, veckodagsNamn } from '@/utils/datumHelper';

const MÅNAD_KORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Måndagen i samma vecka som ett Date (ISO-vecka, måndag = veckostart). Kopierar datumet
// så anroparens objekt inte muteras, och nollar tiden så dygnsstegningen blir ren.
export function måndagIVeckan(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const vardag = (d.getDay() + 6) % 7; // 0 = måndag ... 6 = söndag
  d.setDate(d.getDate() - vardag);
  return d;
}

// ISO-8601-veckonummer (torsdagsregeln): veckan tillhör det år dess torsdag ligger i.
// date-fns finns inte i webben, så vi räknar själva.
function isoVeckonummer(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Flytta till veckans torsdag (ISO: mån=1 ... sön=7).
  const dag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dag + 3);
  const årsStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDagar = Math.round((d - årsStart) / 86400000);
  return Math.floor(diffDagar / 7) + 1;
}

// Timmar för ett pass. Sluttid <= starttid tolkas som över midnatt (+24 h), samma regel som
// planeradeTimmar i datumHelper.js och slutEpochFörPass i backend. 0 om tider saknas.
function passTimmar(p) {
  if (!p?.starttid || !p?.sluttid) return 0;
  const [sh = 0, sm = 0] = p.starttid.split(':').map(Number);
  const [eh = 0, em = 0] = p.sluttid.split(':').map(Number);
  const start = sh * 60 + sm;
  let slut = eh * 60 + em;
  if (slut <= start) slut += 24 * 60;
  return (slut - start) / 60;
}

// Fakturakostnad för ett pass: timlön × timmar × BRUTTO_KOEFFICIENT × (1 + påslag).
// Återanvänder beräknaFakturapris/påslagEller40 – ingen egen formel eller konstant.
function passKostnad(p) {
  const belopp = (Number(p.timlon) || 0) * passTimmar(p);
  if (!(belopp > 0)) return 0;
  return beräknaFakturapris(belopp, påslagEller40(p.paslag));
}

// Målet när man klickar ett pass, eller null om passet inte går att öppna. Schemapass öppnar
// schemat, enstaka godkända pass öppnar företagets jobbvy (samma mål som JobbKort länkar till).
function passLänk(p) {
  if (p.typ === 'schema' && p.schemaId) return `/annonser/schema/${p.schemaId}`;
  if (p.typ === 'pass' && p.jobbId) return `/annonser/jobb/${p.jobbId}/ansokningar`;
  return null;
}

// Två initialer ur ett namn, t.ex. 'Anna Berg' → 'AB'. Faller tillbaka på '?' för tomt namn.
function initialer(namn) {
  const delar = (namn || '').trim().split(/\s+/).filter(Boolean);
  if (!delar.length) return '?';
  const första = delar[0][0] || '';
  const sista = delar.length > 1 ? delar[delar.length - 1][0] || '' : '';
  return (första + sista).toUpperCase();
}

// Avatar för en person: profilbild när den finns och laddar, annars en färgad initial-cirkel.
// Bakgrundsfärgen härleds ur personId (samma deterministiska palett som rollerna). Projektet
// använder annars next/image, men en vanlig <img> gör onerror-fallbacken enkel.
function Avatar({ personId, namn, profilbild }) {
  const [fel, setFel] = useState(false);
  if (profilbild && !fel) {
    return (
      <img
        src={profilbild}
        alt=""
        onError={() => setFel(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
      style={{ backgroundColor: rollFärg(String(personId)) }}
    >
      {initialer(namn)}
    </span>
  );
}

function dagRubrik(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}/${m}`;
}

// Etikett för veckonavigationen, t.ex. 'Mån 24 – Sön 30 nov 2025'. Håller ihop om veckan
// spänner över en månadsgräns ('29 nov – 5 dec 2025').
function veckoEtikett(veckodagar) {
  const första = new Date(veckodagar[0] + 'T12:00:00');
  const sista = new Date(veckodagar[6] + 'T12:00:00');
  const d = (date) => date.getDate();
  const år = sista.getFullYear();
  if (första.getMonth() === sista.getMonth()) {
    return `${d(första)} – ${d(sista)} ${MÅNAD_KORT[sista.getMonth()]} ${år}`;
  }
  return `${d(första)} ${MÅNAD_KORT[första.getMonth()]} – ${d(sista)} ${MÅNAD_KORT[sista.getMonth()]} ${år}`;
}

export default function VeckoRutnät({ pass, valdVecka, onBytVecka }) {
  const idagIso = datumTillIso(new Date());

  // De sju ISO-datumen i vald vecka (måndag → söndag).
  const veckodagar = useMemo(() => {
    const dagar = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(valdVecka.getFullYear(), valdVecka.getMonth(), valdVecka.getDate() + i);
      dagar.push(datumTillIso(d));
    }
    return dagar;
  }, [valdVecka]);

  const veckansPass = useMemo(() => {
    const iVeckan = new Set(veckodagar);
    return (pass || []).filter((p) => p.datum && iVeckan.has(p.datum));
  }, [pass, veckodagar]);

  // En rad per bemannad person, med passen grupperade per datum. Sorterade på namn.
  const personRader = useMemo(() => {
    const karta = new Map();
    for (const p of veckansPass) {
      if (p.personId == null) continue;
      if (!karta.has(p.personId)) {
        karta.set(p.personId, { personId: p.personId, personNamn: p.personNamn, personProfilbild: p.profilbild ?? null, passPerDatum: {} });
      }
      const rad = karta.get(p.personId);
      (rad.passPerDatum[p.datum] ??= []).push(p);
    }
    return [...karta.values()].sort((a, b) =>
      (a.personNamn || '').localeCompare(b.personNamn || '', 'sv')
    );
  }, [veckansPass]);

  // Obesatta pass grupperade per datum – matar "Öppna pass"-raden.
  const öppnaPerDatum = useMemo(() => {
    const karta = {};
    let antal = 0;
    for (const p of veckansPass) {
      if (p.personId != null) continue;
      (karta[p.datum] ??= []).push(p);
      antal += 1;
    }
    return { karta, antal };
  }, [veckansPass]);

  const bemannade = veckansPass.filter((p) => p.personId != null).length;
  const väntande = veckansPass.filter((p) => p.personId == null).length;

  // Kostnad per dag + veckototal, ur de bemannade passen (personraderna).
  const kostnadPerDatum = useMemo(() => {
    const karta = {};
    for (const rad of personRader) {
      for (const [datum, dagensPass] of Object.entries(rad.passPerDatum)) {
        karta[datum] = (karta[datum] || 0) + dagensPass.reduce((s, p) => s + passKostnad(p), 0);
      }
    }
    return karta;
  }, [personRader]);

  const veckoKostnad = Object.values(kostnadPerDatum).reduce((s, v) => s + v, 0);

  const bytVecka = (steg) => {
    const ny = new Date(valdVecka.getFullYear(), valdVecka.getMonth(), valdVecka.getDate() + steg * 7);
    onBytVecka(ny);
  };

  const cellBas = 'border border-kant p-1 align-top';
  const idagBg = 'bg-primär-mjuk';

  return (
    <div>
      {/* Veckonavigation */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => bytVecka(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-pill border border-kant text-text-dämpad transition-colors hover:bg-yta-dämpad"
          aria-label="Föregående vecka"
        >
          ←
        </button>
        <div className="flex items-center gap-2 text-center">
          <span className="text-[15px] font-bold text-text">{veckoEtikett(veckodagar)}</span>
          <span className="rounded-pill bg-primär-mjuk px-2.5 py-0.5 text-[12px] font-bold text-primär">
            V.{isoVeckonummer(valdVecka)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => bytVecka(1)}
          className="flex h-9 w-9 items-center justify-center rounded-pill border border-kant text-text-dämpad transition-colors hover:bg-yta-dämpad"
          aria-label="Nästa vecka"
        >
          →
        </button>
      </div>

      {/* Statistik-chips */}
      <div className="mb-4 flex flex-wrap gap-3">
        <span className="rounded-pill bg-framgång-mjuk px-3 py-1 text-[13px] font-bold text-framgång">
          {bemannade} {bemannade === 1 ? 'tillsatt pass' : 'tillsatta pass'}
        </span>
        <span className="rounded-pill bg-varning-mjuk px-3 py-1 text-[13px] font-bold text-varning-text">
          {väntande} {väntande === 1 ? 'öppet pass' : 'öppna pass'}
        </span>
      </div>

      {/* Rutnät */}
      <div className="overflow-x-auto rounded-lg border border-kant">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[180px] min-w-[180px] border border-kant bg-yta-dämpad p-2 text-left text-[12px] font-bold text-text-dämpad">
                Person
              </th>
              {veckodagar.map((iso) => (
                <th
                  key={iso}
                  className={`w-[120px] min-w-[120px] border border-kant p-2 text-center ${
                    iso === idagIso ? idagBg : 'bg-yta-dämpad'
                  }`}
                >
                  <span className="block text-[12px] font-bold capitalize text-text">{veckodagsNamn(iso)}</span>
                  <span className="block text-[11px] text-text-dämpad">{dagRubrik(iso)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personRader.length === 0 && öppnaPerDatum.antal === 0 ? (
              <tr>
                <td colSpan={8} className="border border-kant p-8 text-center text-[14px] text-text-dämpad">
                  Inga pass den här veckan.
                </td>
              </tr>
            ) : (
              <>
                {personRader.map((rad) => {
                  const timmar = Object.values(rad.passPerDatum)
                    .flat()
                    .reduce((s, p) => s + passTimmar(p), 0);
                  const kostnad = Object.values(rad.passPerDatum)
                    .flat()
                    .reduce((s, p) => s + passKostnad(p), 0);
                  return (
                    <tr key={rad.personId}>
                      <td className="sticky left-0 z-10 h-16 border border-kant bg-yta p-2">
                        <div className="flex items-center gap-2">
                          <Avatar personId={rad.personId} namn={rad.personNamn} profilbild={rad.personProfilbild} />
                          <div className="min-w-0">
                            <Link
                              href={`/sokande/${rad.personId}`}
                              className="block truncate text-[13px] font-semibold text-text hover:text-primär"
                            >
                              {rad.personNamn || 'Okänd'}
                            </Link>
                            <span className="block text-[11px] text-text-dämpad">
                              {Math.round(timmar * 10) / 10} h · {formateraPris(kostnad)} kr
                            </span>
                          </div>
                        </div>
                      </td>
                      {veckodagar.map((iso) => {
                        const dagensPass = rad.passPerDatum[iso] || [];
                        return (
                          // Ingen egen padding/bakgrund – passblocken fyller hela cellen. h-16 ger
                          // en jämn minhöjd; flera pass delar cellen vertikalt via flex-1.
                          <td key={iso} className={`h-16 border border-kant p-0 ${iso === idagIso ? idagBg : ''}`}>
                            {dagensPass.length === 0 ? (
                              <div className="flex h-full items-center p-1">
                                <div className="h-8 w-full rounded-sm bg-yta-dämpad opacity-40" />
                              </div>
                            ) : (
                              <div className="flex h-full flex-col">
                                {dagensPass.map((p, i) => {
                                  const block = (
                                    <div
                                      className="flex h-full flex-col justify-center overflow-hidden px-1.5 py-0.5 text-white"
                                      style={{ backgroundColor: rollFärg(p.kategori) }}
                                    >
                                      <span className="block text-[11px] font-bold leading-tight">
                                        {p.starttid && p.sluttid ? `${p.starttid}–${p.sluttid}` : 'Tid ej satt'}
                                      </span>
                                      {p.kategori && (
                                        <span className="block truncate text-[10px] leading-tight opacity-90">
                                          {p.kategori}
                                        </span>
                                      )}
                                    </div>
                                  );
                                  const href = passLänk(p);
                                  return href ? (
                                    <Link
                                      key={i}
                                      href={href}
                                      className="block flex-1 transition-opacity hover:opacity-80"
                                    >
                                      {block}
                                    </Link>
                                  ) : (
                                    <div key={i} className="flex-1">
                                      {block}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Öppna pass */}
                {öppnaPerDatum.antal > 0 && (
                  <tr>
                    <td className="sticky left-0 z-10 border border-kant bg-yta p-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-kant text-[13px] font-bold text-text-dämpad">
                          ?
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[13px] font-semibold text-text">Öppna pass</span>
                          <span className="block text-[11px] text-text-dämpad">
                            {öppnaPerDatum.antal} {öppnaPerDatum.antal === 1 ? 'obesatt' : 'obesatta'}
                          </span>
                        </div>
                      </div>
                    </td>
                    {veckodagar.map((iso) => {
                      const dagensPass = öppnaPerDatum.karta[iso] || [];
                      return (
                        <td key={iso} className={`${cellBas} ${iso === idagIso ? idagBg : 'bg-yta'}`}>
                          <div className="flex flex-col gap-1">
                            {dagensPass.length === 0 ? (
                              <div className="h-8 rounded-sm bg-yta-dämpad opacity-40" />
                            ) : (
                              dagensPass.map((p, i) => {
                                const ruta = (
                                  <div className="rounded-sm border border-dashed border-kant px-1.5 py-1 text-text-dämpad">
                                    <span className="block text-[11px] font-bold leading-tight">
                                      {p.starttid && p.sluttid ? `${p.starttid}–${p.sluttid}` : 'Tid ej satt'}
                                    </span>
                                    <span className="block text-[10px] leading-tight">Sökes</span>
                                  </div>
                                );
                                const href = passLänk(p);
                                return href ? (
                                  <Link
                                    key={i}
                                    href={href}
                                    className="block transition-opacity hover:opacity-80"
                                  >
                                    {ruta}
                                  </Link>
                                ) : (
                                  <div key={i}>{ruta}</div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* Kostnadsrad */}
                <tr>
                  <td className="sticky left-0 z-10 border border-kant bg-yta-dämpad p-2 text-[13px] font-bold text-text">
                    Kostnad
                  </td>
                  {veckodagar.map((iso) => (
                    <td
                      key={iso}
                      className={`border border-kant p-2 text-center text-[12px] font-semibold text-text ${
                        iso === idagIso ? idagBg : 'bg-yta-dämpad'
                      }`}
                    >
                      {kostnadPerDatum[iso] ? `${formateraPris(kostnadPerDatum[iso])} kr` : '–'}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
          {veckoKostnad > 0 && (
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 border border-kant bg-yta-dämpad p-2 text-right text-[12px] font-bold text-text-dämpad">
                  Veckototal
                </td>
                <td colSpan={7} className="border border-kant bg-yta-dämpad p-2 text-right text-[14px] font-bold text-text">
                  {formateraPris(veckoKostnad)} kr
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
