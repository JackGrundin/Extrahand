// Behörighetskrav: formella krav företaget ställer på den som söker, som fri text.
//
// Ren logik utan databasberoenden, samma roll som valideraObTillagg i utils/pris.js har för
// OB. Reglerna bor på ETT ställe eftersom de används från fyra håll: ansökningsspärren,
// återbekräftelsen, företagets sökandekort och privatpersonens varning i Mina ansökningar.

const MAX_ANTAL_KRAV = 15;
const MAX_LÄNGD_KRAV = 80;

// Trimmar, slänger tomma och deduplicerar. Ordningen bevaras – företaget skriver kraven i
// den ordning de tänker på dem, och listan läses av en människa.
//
// Tål både array och JSON-sträng: jsonb kommer tillbaka som array från PostgREST, men samma
// funktion används på klientdata som kan vara vad som helst.
function normaliseraKrav(krav) {
  let lista = krav;
  if (typeof lista === 'string') {
    try { lista = JSON.parse(lista); } catch { return []; }
  }
  if (!Array.isArray(lista)) return [];

  const sedda = new Set();
  const resultat = [];
  for (const rad of lista) {
    if (typeof rad !== 'string') continue;
    const text = rad.trim();
    if (!text || sedda.has(text)) continue;
    sedda.add(text);
    resultat.push(text);
  }
  return resultat;
}

// Returnerar ett felmeddelande eller null. Backend är sista försvaret – formuläret
// blockerar redan samma saker, men ingenting hindrar ett anrop utanför appen.
function valideraBehorighetsKrav(krav) {
  if (krav == null) return null;
  if (typeof krav === 'string') return 'Behörighetskrav måste vara en lista';
  if (!Array.isArray(krav)) return 'Behörighetskrav måste vara en lista';
  if (krav.length > MAX_ANTAL_KRAV) return `Högst ${MAX_ANTAL_KRAV} behörighetskrav`;

  for (const rad of krav) {
    if (typeof rad !== 'string') return 'Varje behörighetskrav måste vara text';
    if (rad.trim().length > MAX_LÄNGD_KRAV) return `Ett behörighetskrav får vara högst ${MAX_LÄNGD_KRAV} tecken`;
  }
  return null;
}

// Krav som ännu inte intygats – funktionens hjärna.
//
// Jämförelsen sker på TRIMMAD EXAKT STRÄNG. Skriver företaget om ett krav räknas det som
// nytt och måste bekräftas på nytt; det är rätt riktning att fela åt när texten är det enda
// som beskriver kravet.
//
// Borttagna krav ger aldrig utslag: man ska inte behöva bekräfta något som inte längre
// gäller. Därför itereras jobbets krav, inte de intygade.
function saknadeKrav(behorighetsKrav, intygadeKrav) {
  const krav = normaliseraKrav(behorighetsKrav);
  if (!krav.length) return [];
  const intygade = new Set(normaliseraKrav(intygadeKrav));
  return krav.filter(k => !intygade.has(k));
}

module.exports = {
  MAX_ANTAL_KRAV,
  MAX_LÄNGD_KRAV,
  normaliseraKrav,
  valideraBehorighetsKrav,
  saknadeKrav,
};
