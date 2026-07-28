import { ärGiltigStad } from '../components/StadInput';

// Validerar ett schemaformulär. Returnerar ett objekt med bara de fält som saknas,
// t.ex. { timlon: 'Ange en timlön', pass: '...' }. Tomt objekt = allt giltigt.
//
// Speglar backends valideraSchemaInput i routes/scheman.js – ändra alltid på båda
// ställena. Alla fält utom OB-tillägg är obligatoriska.
export function valideraSchema({ titel, beskrivning, kategori, plats, adress, timlon, startdatum, slutdatum, pass }) {
  const fel = {};

  if (!titel?.trim()) fel.titel = 'Ange en titel';
  if (!beskrivning?.trim()) fel.beskrivning = 'Ange en beskrivning';
  if (!kategori?.trim()) fel.kategori = 'Välj en kategori';
  if (!adress?.trim()) fel.adress = 'Ange en adress';

  if (!plats?.trim()) {
    fel.plats = 'Ange en stad';
  } else if (!ärGiltigStad(plats)) {
    fel.plats = 'Välj en stad från listan';
  }

  if (!(parseFloat(timlon) > 0)) fel.timlon = 'Ange en timlön';

  if (!startdatum) fel.period = 'Välj startdatum';
  else if (!slutdatum) fel.period = 'Välj slutdatum';
  else if (slutdatum < startdatum) fel.period = 'Slutdatum kan inte vara före startdatum';

  if (!Array.isArray(pass) || pass.length === 0) {
    fel.pass = 'Lägg till minst ett pass';
  } else if (!pass.every(p => p?.datum && p?.starttid && p?.sluttid)) {
    fel.pass = 'Alla pass måste ha datum och tider';
  } else if (startdatum && slutdatum && !pass.every(p => p.datum >= startdatum && p.datum <= slutdatum)) {
    fel.pass = 'Alla pass måste ligga inom perioden';
  }

  return fel;
}

// Genererar passlistan för en period utifrån valda veckodagar och tider. Utan den vore
// ett sommarschema med 40 pass omöjligt att mata in för hand.
//
// veckodagar: en Set eller array med 0=måndag ... 6=söndag.
export function genereraPass({ startdatum, slutdatum, veckodagar, starttid, sluttid }) {
  if (!startdatum || !slutdatum || slutdatum < startdatum) return [];
  const valda = new Set(veckodagar);
  if (valda.size === 0) return [];

  const pass = [];
  // Stega med UTC-datum så att sommartidsskiften inte kan hoppa över eller dubblera en dag.
  const [årS, månS, dagS] = startdatum.split('-').map(Number);
  const stopp = slutdatum;
  let d = new Date(Date.UTC(årS, månS - 1, dagS));

  while (d.toISOString().slice(0, 10) <= stopp) {
    // getUTCDay(): 0=söndag. Räkna om till 0=måndag.
    const veckodag = (d.getUTCDay() + 6) % 7;
    if (valda.has(veckodag)) {
      pass.push({ datum: d.toISOString().slice(0, 10), starttid, sluttid });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return pass;
}
