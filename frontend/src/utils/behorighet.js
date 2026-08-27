// Behörighetskrav – speglar backend/utils/behorighet.js. Ändra alltid på båda ställena,
// annars släpper formuläret igenom krav som servern avvisar, eller tvärtom: knappen låses
// upp i appen fast backend fortfarande anser att något saknas.

export const MAX_ANTAL_KRAV = 15;
export const MAX_LÄNGD_KRAV = 80;

// Trimmar, slänger tomma och deduplicerar med bevarad ordning. Tål både array och
// JSON-sträng – jsonb kommer tillbaka som array, men äldre rader kan bära text.
export function normaliseraKrav(krav) {
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

// Krav som ännu inte intygats. Jämförelse på trimmad exakt sträng, och borttagna krav ger
// aldrig utslag – därför itereras jobbets krav, inte de intygade.
export function saknadeKrav(behorighetsKrav, intygadeKrav) {
  const krav = normaliseraKrav(behorighetsKrav);
  if (!krav.length) return [];
  const intygade = new Set(normaliseraKrav(intygadeKrav));
  return krav.filter(k => !intygade.has(k));
}
