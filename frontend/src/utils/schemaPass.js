// Ren logik för schemapublicerings passlista. Ligger utanför skärmen så att den går att
// testa utan React Native, och för att reglerna här är de lättaste att få subtilt fel.

let räknare = 0;

// Stabilt lokalt id per pass. Markeringarna i steg 3 pekar på id, inte på index – annars
// följer kryssrutorna fel pass så fort ett pass tas bort eller listan sorteras om.
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

// Skriver standardvärdena till valda pass. Tomma fält i standarden lämnar passets
// befintliga värde orört, så man kan tillämpa bara tiderna utan att nolla rollerna.
//
// OB djupkopieras – delas arrayen mellan tjugo pass blir en redigering i ett av dem svår
// att resonera om, även om ObRedigerare i praktiken alltid returnerar en ny array.
export function tillämpaStandard(pass, standard, passIdn = null) {
  const mål = passIdn ? new Set(passIdn) : null;
  return pass.map(p => {
    if (mål && !mål.has(p.id)) return p;
    return {
      ...p,
      starttid: standard.starttid || p.starttid,
      sluttid: standard.sluttid || p.sluttid,
      kategori: standard.kategori?.trim() ? standard.kategori.trim() : p.kategori,
      ob_tillagg: standard.ob_tillagg?.length
        ? standard.ob_tillagg.map(o => ({ ...o }))
        : p.ob_tillagg,
    };
  });
}

// Pass-id som krockar på datum + starttid. Backend och valideraSchema avvisar dubbletter,
// men felet skulle annars dyka upp först vid publicering som ett generiskt meddelande utan
// att peka ut raden.
//
// Krocken är lätt att råka skapa: har en dag två pass (Liftvärd 08–12, Garderob 18–23) och
// man trycker "Tillämpa på alla" med starttid 08:00 får båda samma starttid.
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
export function tillPayload(pass) {
  return sorteraPass(pass).map(({ id, ...p }) => p);
}
