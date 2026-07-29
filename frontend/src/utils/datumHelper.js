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
  // Saknas sluttid antar vi dygnets slut så vi inte flaggar passet för tidigt.
  const slut = /^\d{1,2}:\d{2}$/.test(sista.slut ?? '') ? sista.slut.padStart(5, '0') : '23:59';
  return new Date(`${sista.datum}T${slut}:00`);
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
