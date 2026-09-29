import AsyncStorage from '@react-native-async-storage/async-storage';

// De senaste städerna användaren sökt efter i jobblistan. Sparas i AsyncStorage så de
// överlever omstart och visas som snabbval under sökfältet.
const NYCKEL = 'fastgig.sokhistorik.stader';
const MAX = 5;

// Enkel modul-lyssnare så att JobbScreen kan uppdatera chipsen direkt efter ett val,
// utan att läsa om från disk. Samma mönster som anslutningslyssnaren i klient.js.
const lyssnare = new Set();

export function lyssnaPåSökhistorik(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

export async function hämtaStäder() {
  try {
    const rå = await AsyncStorage.getItem(NYCKEL);
    const lista = rå ? JSON.parse(rå) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// Lägger en stad överst, tar bort ev. tidigare förekomst (skiftlägesokänsligt så
// "Göteborg" inte dubbleras av "göteborg") och klipper till MAX. Returnerar den nya listan.
export async function läggTillStad(stad) {
  const rensad = (stad ?? '').trim();
  if (!rensad) return hämtaStäder();
  const nuvarande = await hämtaStäder();
  const utan = nuvarande.filter(s => s.toLowerCase() !== rensad.toLowerCase());
  const ny = [rensad, ...utan].slice(0, MAX);
  try {
    await AsyncStorage.setItem(NYCKEL, JSON.stringify(ny));
  } catch {
    // Kan inte spara – historiken är en bekvämlighet, inte kritisk. Fortsätt tyst.
  }
  for (const fn of lyssnare) fn(ny);
  return ny;
}
