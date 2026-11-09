// Åldersberäkning och validering av födelsedatum. Backend är enda källan till sanning
// för uträknad ålder – frontend visar bara talet vi returnerar i profilsvaren.

// Räknar ut åldern i hela år från ett födelsedatum (ISO YYYY-MM-DD eller Date).
// Returnerar null om värdet saknas eller inte går att tolka. Justerar ned med ett år
// om årets födelsedag ännu inte har passerat.
function beräknaÅlder(fodelsedatum) {
  if (!fodelsedatum) return null;
  const född = new Date(`${String(fodelsedatum).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(född.getTime())) return null;

  const idag = new Date();
  let ålder = idag.getFullYear() - född.getFullYear();
  const harFyllt =
    idag.getMonth() > född.getMonth() ||
    (idag.getMonth() === född.getMonth() && idag.getDate() >= född.getDate());
  if (!harFyllt) ålder -= 1;

  return ålder;
}

// Validerar ett födelsedatum från klienten: måste vara ett reellt kalenderdatum
// (YYYY-MM-DD), inte i framtiden och inte orimligt långt bak (> 120 år). Round-trip
// genom Date avvisar påhittade datum som 2026-02-31, precis som webbens parsaIsoDatum.
function giltigtFödelsedatum(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return false;
  const [, år, mån, dag] = m;
  const d = new Date(`${år}-${mån}-${dag}T12:00:00`);
  if (
    d.getFullYear() !== Number(år) ||
    d.getMonth() + 1 !== Number(mån) ||
    d.getDate() !== Number(dag)
  ) {
    return false;
  }

  const idag = new Date();
  if (d > idag) return false; // inte i framtiden
  const ålder = beräknaÅlder(`${år}-${mån}-${dag}`);
  if (ålder == null || ålder > 120) return false;

  return true;
}

module.exports = { beräknaÅlder, giltigtFödelsedatum };
