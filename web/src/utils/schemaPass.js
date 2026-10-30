// Speglar frontend/src/utils/schemaPass.js i mobilappen – ändra alltid på båda ställena.
// Ren logik för schemapublicerings passlista. Ligger utanför skärmen så att den går att
// testa utan React Native, och för att reglerna här är de lättaste att få subtilt fel.

let räknare = 0;

// Stabilt lokalt id per pass. Steg 3 pekar ut det öppna passet med id, inte med index –
// annars fälls fel pass ut så fort ett pass tas bort eller listan sorteras om.
export function nyttPassId() {
  räknare += 1;
  return `p${räknare}`;
}

export function sorteraPass(pass) {
  return [...pass].sort((a, b) =>
    a.datum === b.datum
      ? (a.starttid || '').localeCompare(b.starttid || '')
      : a.datum.localeCompare(b.datum)
  );
}

// Slår ihop de valda datumen med befintliga pass.
//
// Regeln är hela poängen med att kunna gå tillbaka till datumsteget: datum som redan har
// pass behåller dem OFÖRÄNDRADE (ifyllda tider och roller får inte gå förlorade), nya datum
// får ett tomt pass, och pass vars datum avmarkerats faller bort. Att bygga om listan från
// grunden vid varje återbesök vore den närmast till hands liggande buggen.
//
// Ett datum kan ha flera pass (två roller samma dag) – alla behålls.
export function synkaPassMotDatum(valdaDatum, befintligaPass) {
  const valda = valdaDatum instanceof Set ? valdaDatum : new Set(valdaDatum);
  const kvar = befintligaPass.filter(p => valda.has(p.datum));
  const datumMedPass = new Set(kvar.map(p => p.datum));

  // Nya pass föds med förvalda tider 08:00–17:00 så företaget slipper öppna varje pass och
  // fylla i manuellt. Befintliga pass (kvar) rörs inte, så redan ifyllda tider bevaras.
  const nya = [...valda]
    .filter(d => !datumMedPass.has(d))
    .map(datum => ({ id: nyttPassId(), datum, starttid: '08:00', sluttid: '17:00', kategori: null, ob_tillagg: [], rast_minuter: 0 }));

  return sorteraPass([...kvar, ...nya]);
}

// Hur många pass synkaPassMotDatum SKULLE ge, utan att skapa dem. Samma regel: bevarade
// pass plus valda datum som ännu inte har något pass.
//
// Behövs eftersom antalet valda DATUM inte är antalet PASS – en dag kan ha två pass, så
// efter en tur till passteget och tillbaka skiljer sig talen åt.
//
// Räkna ALDRIG genom att anropa synkaPassMotDatum. Den kallar nyttPassId(), som räknar upp
// en modulnivåräknare, så ett anrop i en useMemo skulle bränna id vid varje omrendering.
export function antalPassEfterSynk(valdaDatum, befintligaPass) {
  const valda = valdaDatum instanceof Set ? valdaDatum : new Set(valdaDatum);
  const kvar = befintligaPass.filter(p => valda.has(p.datum));
  const datumMedPass = new Set(kvar.map(p => p.datum));
  return kvar.length + [...valda].filter(d => !datumMedPass.has(d)).length;
}

// Skriver ETT fält till ett eller flera pass. Övriga fält och övriga pass rörs inte.
// Används av inline-editorn, som alltid skriver till exakt ett pass.
//
// Kategorin trimmas INTE här. En trim i skrivvägen gör att markören hoppar så fort man
// skriver ett mellanslag mitt i ett rollnamn – tomt blir null först i tillPayload, och
// backend trimmar ändå (routes/scheman.js).
//
// OB djupkopieras. Delas arrayen mellan flera pass blir en senare redigering i ett av dem
// svår att resonera om, även om ObRedigerare i praktiken alltid returnerar en ny array.
export function uppdateraFält(pass, idn, fält, värde) {
  const mål = idn instanceof Set ? idn : new Set(idn);
  if (mål.size === 0) return pass;

  return pass.map(p => {
    if (!mål.has(p.id)) return p;
    if (fält === 'ob_tillagg') {
      return { ...p, ob_tillagg: (Array.isArray(värde) ? värde : []).map(o => ({ ...o })) };
    }
    return { ...p, [fält]: värde };
  });
}

// Skriver ett utkast till FLERA pass samtidigt – massredigeringen i steg 3.
//
// Bara ifyllda fält skrivs över. Det är hela poängen: markerar man tio pass och sätter bara
// rollen ska de tio passens redan ifyllda tider inte nollas. En naiv spread av utkastet
// hade raderat allt man inte råkade fylla i den här gången.
//
// rensaOb är ett eget flagg-argument eftersom en tom ob-lista i utkastet betyder "rör inte
// OB". Utan flaggan går det inte att TA BORT OB från flera pass på en gång.
export function tillämpaPåMarkerade(pass, idn, utkast, { rensaOb = false } = {}) {
  const mål = idn instanceof Set ? idn : new Set(idn);
  if (mål.size === 0) return pass;

  let resultat = pass;
  for (const fält of ['starttid', 'sluttid', 'kategori']) {
    const värde = utkast?.[fält];
    if (typeof värde === 'string' && värde.trim()) {
      resultat = uppdateraFält(resultat, mål, fält, värde);
    }
  }

  if (rensaOb) {
    resultat = uppdateraFält(resultat, mål, 'ob_tillagg', []);
  } else if (Array.isArray(utkast?.ob_tillagg) && utkast.ob_tillagg.length) {
    resultat = uppdateraFält(resultat, mål, 'ob_tillagg', utkast.ob_tillagg);
  }

  // Rast tillämpas bara när den faktiskt angetts. null = orörd (lämna passens rast som den
  // är); 0 betyder "ingen rast" och ska skrivas. Därför != null, inte en truthy-kontroll.
  if (utkast?.rast_minuter != null) {
    resultat = uppdateraFält(resultat, mål, 'rast_minuter', Number(utkast.rast_minuter));
  }

  // Sorteras om här och inte i uppdateraFält: en ny starttid kan flytta passet i listan,
  // och till skillnad från inline-editorn skriver den här vägen inte tecken för tecken –
  // ingen rad hoppar under fingret.
  return sorteraPass(resultat);
}

// Pass-id som krockar på datum + starttid. Backend och valideraSchema avvisar dubbletter,
// men felet skulle annars dyka upp först vid publicering som ett generiskt meddelande utan
// att peka ut raden.
//
// Krocken är lätt att råka skapa: har en dag två pass (Liftvärd 08–12, Garderob 18–23) och
// man fyller i samma starttid på båda.
export function hittaKrockar(pass) {
  const perNyckel = {};
  for (const p of pass) {
    if (!p.datum || !p.starttid) continue;
    (perNyckel[`${p.datum} ${p.starttid}`] ??= []).push(p.id);
  }
  return new Set(Object.values(perNyckel).filter(idn => idn.length > 1).flat());
}

// Ett pass med identisk start- och sluttid blir noll timmar långt och hoppas över av
// cron-jobbet. Pass över midnatt (22:00–06:00) är däremot fullt giltiga – se
// slutEpochFörPass i backend/utils/tid.js – så en enkel "slut måste vara efter start"
// vore en regression.
export function harNolltid(p) {
  return Boolean(p?.starttid && p?.sluttid && p.starttid === p.sluttid);
}

// Ett pass är komplett när det har både start- och sluttid. Rollen är frivillig.
export function ärKomplett(p) {
  return Boolean(p?.datum && p?.starttid && p?.sluttid);
}

// Passen som ska skickas till API:t – utan det lokala id:t, som backend inte känner till.
// Kategorin trimmas och tomma blir null först här, eftersom en trim under skrivandet
// får markören att hoppa. null betyder "ärv schemats kategori" (se passMedArv i backend).
export function tillPayload(pass) {
  return sorteraPass(pass).map(({ id, ...p }) => ({
    ...p,
    kategori: p.kategori?.trim() || null,
  }));
}

// ── Kalenderöversikt (schemaöversikt) ────────────────────────────────────────
// Portat från mobilappens MånadsKalender.js + SchemaKalenderScreen.js. Sorteringen i
// rollerFörDag och grupperaPerKategori MÅSTE vara identisk (namnlösa sist) – annars radar
// kalenderns prickar och dagslistan upp rollerna olika för samma dag.

import { rollFärg } from '@/utils/konstanter';

// Distinkta roller en given dag, med färg, om alla pass i rollen är genomförda (status
// 'rapporterad') och om någon av dem saknar person. Styr kalenderns tre prick-tillstånd.
export function rollerFörDag(pass) {
  const grupper = {};
  for (const p of pass) {
    const namn = p.kategori || null;
    (grupper[namn ?? ''] ??= { namn, färg: rollFärg(namn), pass: [] }).pass.push(p);
  }
  return Object.values(grupper)
    .sort((a, b) => {
      if (!a.namn) return 1;
      if (!b.namn) return -1;
      return a.namn.localeCompare(b.namn, 'sv');
    })
    .map((g) => ({
      ...g,
      alltGenomfört: g.pass.every((p) => p.status === 'rapporterad'),
      saknarPerson: g.pass.some((p) => p.personId == null),
    }));
}

// En dags pass grupperade per roll för dagslistan under kalendern. Samma sortering som
// rollerFörDag.
export function grupperaPerKategori(pass) {
  const grupper = {};
  for (const p of pass) {
    const kategori = p.kategori || null;
    (grupper[kategori ?? ''] ??= { kategori, pass: [] }).pass.push(p);
  }
  return Object.values(grupper).sort((a, b) => {
    if (!a.kategori) return 1;
    if (!b.kategori) return -1;
    return a.kategori.localeCompare(b.kategori, 'sv');
  });
}
