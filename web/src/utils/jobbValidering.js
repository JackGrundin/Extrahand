// Speglar frontend/src/utils/jobbValidering.js i mobilappen – ändra alltid på båda ställena.
// Enda skillnaden mot appen: ärGiltigStad importeras från @/utils/stad i stället för från
// StadInput-komponenten (på webben vill validatorn inte dra in en komponent).
import { ärGiltigStad } from '@/utils/stad';

// Dagens datum som 'YYYY-MM-DD' i LOKAL tid. toISOString() ger UTC-dagen och skulle
// felaktigt flagga dagens pass som passerat strax efter midnatt.
function idagLokalt() {
  const d = new Date();
  const mån = String(d.getMonth() + 1).padStart(2, '0');
  const dag = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mån}-${dag}`;
}

// Validerar ett jobbformulär. Returnerar ett objekt med bara de fält som saknas,
// t.ex. { lon: 'Ange en timlön', schema: '...' }. Tomt objekt = allt giltigt.
//
// Reglerna bor här så att publicerings- och redigeringsformuläret inte kan divergera.
// Alla fält utom OB-tillägg är obligatoriska.
//
// kräverStadFrånLista: publiceringsformuläret använder StadInput och kräver en stad ur
// listan; redigeringsformuläret har ett vanligt textfält och kräver bara att det inte är
// tomt.
// kräverSchema: publiceringen har dag-för-dag-schema (dagScheman). Redigeringen har platta
// tidfält och validerar dem separat, så den anropar utan schema.
export function valideraJobb(
  { titel, beskrivning, kategori, plats, adress, lon, dagScheman, antal_dagar },
  { kräverStadFrånLista = true, kräverSchema = true } = {}
) {
  const fel = {};

  if (!titel?.trim()) fel.titel = 'Ange en jobbtitel';
  if (!beskrivning?.trim()) fel.beskrivning = 'Ange en beskrivning';
  if (!kategori?.trim()) fel.kategori = 'Välj en kategori';
  if (!adress?.trim()) fel.adress = 'Ange en adress';

  if (!plats?.trim()) {
    fel.plats = 'Ange en stad';
  } else if (kräverStadFrånLista && !ärGiltigStad(plats)) {
    fel.plats = 'Välj en stad från listan';
  }

  if (!(parseFloat(lon) > 0)) fel.lon = 'Ange en timlön';

  if (kräverSchema) {
    // Antal dagar måste vara minst 1. 0/negativt ger tom dagScheman, så kontrollera det
    // först och hoppa över komplett-felet nedan – annars dubbelfel på samma sak.
    if (antal_dagar != null && antal_dagar !== '' && Number(antal_dagar) < 1) {
      fel.antal_dagar = 'Antal dagar måste vara minst 1';
    } else {
      // Varje dag måste ha datum, starttid och sluttid – inte bara någon av dagarna.
      const komplett = Array.isArray(dagScheman)
        && dagScheman.length > 0
        && dagScheman.every(d => d?.datum && d?.start && d?.slut);
      if (!komplett) {
        fel.schema = 'Fyll i datum och tider för alla dagar';
      } else if (dagScheman.some(d => d.datum < idagLokalt())) {
        // Backend är sista försvaret (routes/jobb.js), men UI ska också blockera – på webben
        // är min på <input type=date> bara rådgivande och går att kringgå med fritext.
        fel.schema = 'Datum kan inte vara i det förflutna';
      }
    }
  }

  return fel;
}
