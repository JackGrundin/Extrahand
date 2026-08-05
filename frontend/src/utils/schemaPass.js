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

  const nya = [...valda]
    .filter(d => !datumMedPass.has(d))
    .map(datum => ({ id: nyttPassId(), datum, starttid: '', sluttid: '', kategori: null, ob_tillagg: [] }));

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
