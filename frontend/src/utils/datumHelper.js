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
