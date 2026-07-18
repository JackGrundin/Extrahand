import { ärGiltigStad } from '../components/StadInput';

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
  { titel, beskrivning, kategori, plats, adress, lon, dagScheman },
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
    // Varje dag måste ha datum, starttid och sluttid – inte bara någon av dagarna.
    const komplett = Array.isArray(dagScheman)
      && dagScheman.length > 0
      && dagScheman.every(d => d?.datum && d?.start && d?.slut);
    if (!komplett) fel.schema = 'Fyll i datum och tider för alla dagar';
  }

  return fel;
}
