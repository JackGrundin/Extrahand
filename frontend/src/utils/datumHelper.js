export function parsaArbetstider(arbetstider) {
  if (!arbetstider) return null;
  // Supabase kan returnera JSONB som redan parsat JS-objekt
  if (Array.isArray(arbetstider)) return arbetstider;
  if (typeof arbetstider !== 'string') return null;
  try {
    const parsed = JSON.parse(arbetstider);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
}

export function formatDagDatum(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

// Sammanfattar en lista ISO-datum som EN period, t.ex. '15 jun – 15 aug 2026'.
// Ett schema kan ha 60 pass, och att räkna upp de första datumen och lägga på
// "+55 till" säger mindre om uppdraget än var det börjar och slutar.
//
// Året skrivs bara ut en gång när perioden ligger inom samma år – '15 jun 2026 –
// 15 aug 2026' är brusigt. Sträcker den sig över ett årsskifte måste båda årtalen
// stå kvar, annars går det inte att läsa ut vilket år som är vilket.
//
// Utgår från MIN och MAX, inte från listans första och sista element: datumen kommer
// från arbetstider och är inte garanterat sorterade.
//
// Månadsnamnen kommer från MÅNAD_KORT och INTE från toLocaleDateString('sv-SE',
// { month: 'short' }), som resten av appen använder. Den ger korrekt svenska men
// ojämna former – 'juni' och 'juli' skrivs ut helt medan övriga får punkt – och
// '15 juni – 15 aug. 2026' blir rörigt i en period där de två månaderna står
// bredvid varandra. Tre bokstäver rakt igenom håller ihop.
const MÅNAD_KORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function formatPeriod(allaDatum) {
  const datum = (allaDatum ?? []).filter(Boolean);
  if (!datum.length) return null;

  const start = datum.reduce((a, b) => (a < b ? a : b));
  const slut = datum.reduce((a, b) => (a > b ? a : b));

  const dag = (iso) => new Date(iso + 'T12:00:00');
  const månad = (d) => MÅNAD_KORT[d.getMonth()];

  const s = dag(start);
  const e = dag(slut);

  if (start === slut) return `${s.getDate()} ${månad(s)} ${s.getFullYear()}`;

  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.getDate()} ${månad(s)} ${s.getFullYear()} – ${e.getDate()} ${månad(e)} ${e.getFullYear()}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${månad(e)} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${månad(s)} – ${e.getDate()} ${månad(e)} ${e.getFullYear()}`;
}

// Första arbetsdatumet (ISO) i ett arbetstider-schema, eller null om inga datum finns.
// Datumen är INTE garanterat sorterade – de speglas ur passlistan – så både
// månadsgrupperingen och sorteringen av kommande pass måste gå på det MINSTA datumet
// och aldrig på arrayens första element. Samma princip som formatPeriod ovan.
export function förstaArbetsdatum(arbetstider) {
  const datum = (parsaArbetstider(arbetstider) ?? []).map(d => d?.datum).filter(Boolean);
  return datum.length ? datum.reduce((a, b) => (a < b ? a : b)) : null;
}

// Ett Date från en datumväljare till 'YYYY-MM-DD' i LOKAL tid.
// toISOString() konverterar till UTC och ger fel dag för svenska datum valda före
// 02:00 på sommaren – ett pass den 3:e kan då sparas som den 2:a.
export function datumTillIso(date) {
  if (!date) return '';
  const år = date.getFullYear();
  const mån = String(date.getMonth() + 1).padStart(2, '0');
  const dag = String(date.getDate()).padStart(2, '0');
  return `${år}-${mån}-${dag}`;
}

// Dagen efter ett ISO-datum. Stegar i UTC så att sommartidsskiften inte kan hoppa över
// eller dubblera en dag. Används av "Kopiera föregående pass".
export function nästaDatumIso(isoStr) {
  if (!isoStr) return '';
  const [år, mån, dag] = isoStr.split('-').map(Number);
  const d = new Date(Date.UTC(år, mån - 1, dag));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Alla datum mellan två ISO-datum, båda ändarna inkluderade. Stegar i UTC precis som
// nästaDatumIso, så sommartidsskiften varken hoppar över eller dubblerar en dag.
// Bakvänd period ger tom lista i stället för att loopa i evighet.
//
// Matar både kalenderns avgränsning och veckodagsgenvägarna i schemapubliceringen.
export function datumIntervall(startIso, slutIso) {
  if (!startIso || !slutIso || slutIso < startIso) return [];

  const [år, mån, dag] = startIso.split('-').map(Number);
  const datum = [];
  const d = new Date(Date.UTC(år, mån - 1, dag));

  let iso = d.toISOString().slice(0, 10);
  while (iso <= slutIso) {
    datum.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    iso = d.toISOString().slice(0, 10);
  }
  return datum;
}

// Veckodag för ett ISO-datum som 0 = måndag ... 6 = söndag. Samma numrering som
// MånadsKalender använder när rutnätet byggs, så veckodagsgenvägarna och kolumnerna
// stämmer överens.
export function veckodagsIndex(isoStr) {
  if (!isoStr) return null;
  const [år, mån, dag] = isoStr.split('-').map(Number);
  return (new Date(Date.UTC(år, mån - 1, dag)).getUTCDay() + 6) % 7;
}

// Veckodagens korta namn för ett ISO-datum, t.ex. 'mån'. Används i schemats passlista.
export function veckodagsNamn(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short' });
}

// Sista sluttidpunkten för ett pass (Date), eller null om inga datum finns.
export function passSlutTidpunkt(arbetstider) {
  const schema = parsaArbetstider(arbetstider);
  if (!schema) return null;
  const dagar = schema.filter(d => d?.datum);
  if (dagar.length === 0) return null;
  // Sista arbetsdagen avgör när hela passet är slut.
  const sista = dagar.reduce((a, b) => (b.datum > a.datum ? b : a));
  const giltigTid = (t) => (/^\d{1,2}:\d{2}$/.test(t ?? '') ? t.padStart(5, '0') : null);
  const start = giltigTid(sista.start);
  // Saknas sluttid antar vi dygnets slut så vi inte flaggar passet för tidigt.
  const slut = giltigTid(sista.slut) ?? '23:59';
  // Sluttid <= starttid betyder att passet går över midnatt och slutar DAGEN EFTER –
  // exakt samma regel som slutEpochFörPass i backend/utils/tid.js, som styr när
  // auto-tidrapporten skapas. Utan den räknades 22:00–06:00 som avslutat 06:00 samma
  // dag, alltså 16 timmar innan passet ens börjat: passet låg under "Genomförda" hos
  // personen och gav "att avsluta"-badge hos företaget medan arbetet pågick.
  const slutDatum = start && slut <= start ? nästaDatumIso(sista.datum) : sista.datum;
  return new Date(`${slutDatum}T${slut}:00`);
}

// Första starttidpunkten för ett pass (Date), eller null om inga datum finns.
export function passStartTidpunkt(arbetstider) {
  const schema = parsaArbetstider(arbetstider);
  if (!schema) return null;
  const dagar = schema.filter(d => d?.datum);
  if (dagar.length === 0) return null;
  // Första arbetsdagen avgör när passet börjar.
  const första = dagar.reduce((a, b) => (b.datum < a.datum ? b : a));
  // Saknas starttid antar vi dygnets början.
  const start = /^\d{1,2}:\d{2}$/.test(första.start ?? '') ? första.start.padStart(5, '0') : '00:00';
  return new Date(`${första.datum}T${start}:00`);
}

// Passet har startat när första starttiden har passerat.
export function harStartat(arbetstider) {
  const start = passStartTidpunkt(arbetstider);
  return start != null && start.getTime() < Date.now();
}

// Ett pass behöver avslutas när sista sluttiden har passerat (tidrapport saknas fortfarande).
export function behöverAvslutas(arbetstider) {
  const slut = passSlutTidpunkt(arbetstider);
  return slut != null && slut.getTime() < Date.now();
}

export function parsaObTillagg(ob) {
  if (!ob) return [];
  if (Array.isArray(ob)) return ob;
  try { return JSON.parse(ob); } catch { return []; }
}

export function beräknaObBelopp(obTillagg, timlön) {
  if (!obTillagg || !obTillagg.length || !timlön) return 0;
  return obTillagg.reduce((sum, ob) => {
    const [startH = 0, startM = 0] = ob.start.split(':').map(Number);
    const [slutH = 0, slutM = 0] = ob.slut.split(':').map(Number);
    const timmar = (slutH * 60 + slutM - (startH * 60 + startM)) / 60;
    if (timmar <= 0) return sum;
    return sum + (ob.typ === 'procent' ? timmar * timlön * (ob.värde / 100) : timmar * ob.värde);
  }, 0);
}

export function formatBricka(allaDatum) {
  if (!allaDatum || allaDatum.length === 0) return null;
  if (allaDatum.length === 1) {
    const d = new Date(allaDatum[0] + 'T12:00:00');
    return { rader: [String(d.getDate()), d.toLocaleDateString('sv-SE', { month: 'short' })], stor: true };
  }
  const start = new Date(allaDatum[0] + 'T12:00:00');
  const slut = new Date(allaDatum[allaDatum.length - 1] + 'T12:00:00');
  const samMånad = start.getMonth() === slut.getMonth() && start.getFullYear() === slut.getFullYear();
  if (samMånad) {
    return { rader: [`${start.getDate()}–${slut.getDate()}`, start.toLocaleDateString('sv-SE', { month: 'short' })], stor: true };
  }
  return { rader: allaDatum.slice(0, 3).map(d => formatDagDatum(d)), stor: false };
}
