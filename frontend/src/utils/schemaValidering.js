import { ärGiltigStad } from '../components/StadInput';
import { SCHEMATYPER } from './konstanter';

// Validerar ett schemaformulär. Returnerar ett objekt med bara de fält som saknas,
// t.ex. { timlon: 'Ange en timlön', pass: '...' }. Tomt objekt = allt giltigt.
//
// Speglar backends valideraSchemaInput i routes/scheman.js – ändra alltid på båda ställena.
//
// Perioden valideras INTE längre: den härleds ur passens datum på servern. När pass läggs
// ett i taget finns ingen period att validera mot innan passen finns.
// Ingen huvudkategori valideras: rollen sätts per pass i stället, och schemats egen
// kategori nådde aldrig jobbfiltret ändå (schemajobb filtreras bort i db/jobb.js).
export function valideraSchema({ titel, beskrivning, plats, adress, typ, timlon, pass, avdrag }) {
  const fel = {};

  if (!titel?.trim()) fel.titel = 'Ange en titel';
  if (!beskrivning?.trim()) fel.beskrivning = 'Ange en beskrivning';
  if (!adress?.trim()) fel.adress = 'Ange en adress';
  if (!SCHEMATYPER.some(t => t.värde === typ)) fel.typ = 'Välj en schematyp';

  if (!plats?.trim()) {
    fel.plats = 'Ange en stad';
  } else if (!ärGiltigStad(plats)) {
    fel.plats = 'Välj en stad från listan';
  }

  if (!(parseFloat(timlon) > 0)) fel.timlon = 'Ange en timlön';

  if (!Array.isArray(pass) || pass.length === 0) {
    fel.pass = 'Lägg till minst ett pass';
  } else if (!pass.every(p => p?.datum && p?.starttid && p?.sluttid)) {
    fel.pass = 'Alla pass måste ha datum och tider';
  } else {
    // Samma datum OCH starttid två gånger skulle ge två tidrapporter för samma pass.
    // Olika starttid samma datum är tillåtet – det är så en dag med två roller ser ut.
    const nycklar = pass.map(p => `${p.datum} ${p.starttid}`);
    if (new Set(nycklar).size !== nycklar.length) fel.pass = 'Två pass har samma datum och starttid';
  }

  for (const a of (Array.isArray(avdrag) ? avdrag : [])) {
    if (!a?.namn?.trim()) { fel.avdrag = 'Varje avdrag måste ha ett namn'; break; }
    if (!(parseFloat(a.belopp) > 0)) { fel.avdrag = 'Varje avdrag måste ha ett belopp'; break; }
  }

  return fel;
}
