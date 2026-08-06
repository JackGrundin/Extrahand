export const TYPER = ['gig', 'sommarjobb'];

// Schematyper. Lagrade värden är ASCII-slugar som resten av typvärdena i databasen
// ('gig', 'sommarjobb') – etiketten är det enda som visas för användaren.
// Speglas av GILTIGA_TYPER i backend/routes/scheman.js.
export const SCHEMATYPER = [
  { värde: 'sommarjobb',    etikett: 'Sommarjobb' },
  { värde: 'sasongsarbete', etikett: 'Säsongsarbete' },
  { värde: 'deltidsjobb',   etikett: 'Deltidsjobb' },
  { värde: 'periodsarbete', etikett: 'Periodsarbete' },
];

// Faller tillbaka på 'Schema' i stället för att visa råvärdet. Scheman som skapades när
// valideringen tillät 'gig', 'deltid', 'heltid' och 'uppdrag' kan bära de värdena.
export function schematypEtikett(värde) {
  return SCHEMATYPER.find(t => t.värde === värde)?.etikett ?? 'Schema';
}

// Jobbkategorier grupperade per bransch. Kategorisökningen (normalisera) gör listan
// lätt att navigera trots längden. Ordningen styr hur de visas i väljaren.
// OBS: ta inte bort befintliga kategorier utan att migrera Jobb.Kategori – annars
// tappar redan publicerade jobb sin kategori i filtret.
export const KATEGORIER = [
  // Restaurang
  'Servitör', 'Kock', 'Kockassistent', 'Kallskänka', 'Diskare', 'Bartender',
  'Hovmästare', 'Pizzabagare', 'Cateringpersonal',
  // Café & bageri
  'Barista', 'Cafébiträde', 'Bagare', 'Konditor',
  // Butik & handel
  'Butiksbiträde', 'Butikssäljare', 'Kassör', 'Visual merchandiser', 'Lagerbiträde',
  // Lager & logistik
  'Lagerarbetare', 'Truckförare', 'Orderplockare', 'Paketerare', 'Terminalarbetare',
  'Godsmottagare',
  // Kontor & administration
  'Kontorsassistent', 'Administratör', 'Receptionist', 'Kundtjänstmedarbetare',
  'Dataregistrerare',
  // IT & teknik
  'IT-tekniker', 'IT-support', 'Systemutvecklare', 'Webbutvecklare', 'Testare',
  // Bygg & anläggning
  'Snickare', 'Byggarbetare', 'Målare', 'Elektriker', 'VVS-montör', 'Betongarbetare',
  'Ställningsbyggare', 'Golvläggare', 'Plattsättare', 'Hantlangare', 'Anläggningsarbetare',
  // Städ & lokalvård
  'Städare', 'Lokalvårdare', 'Fönsterputsare', 'Flyttstädare',
  // Vård & omsorg
  'Undersköterska', 'Vårdbiträde', 'Personlig assistent', 'Sjuksköterska',
  'Stödassistent', 'Barnskötare',
  // Transport
  'Chaufför', 'Lastbilschaufför', 'Budbilsförare', 'Taxiförare', 'Distributionsförare',
  'Flyttarbetare',
  // Event & underhållning
  'Eventpersonal', 'Eventvärd', 'Scenarbetare', 'Riggare', 'Garderobiär', 'Biljettvärd',
  'Promotor',
  // Säkerhet
  'Väktare', 'Vakt', 'Ordningsvakt', 'Entrévärd', 'Parkeringsvakt',
  // Hotell
  'Hotellstädare', 'Frukostvärd', 'Concierge', 'Nattreceptionist', 'Portier',
  // Utbildning
  'Lärarvikarie', 'Elevassistent', 'Fritidsledare', 'Läxhjälpare', 'Förskolevikarie',
  // Sport & fritid
  'Personlig tränare', 'Gruppträningsinstruktör', 'Simlärare', 'Livräddare', 'Idrottsledare',
  // Trädgård & fastighet
  'Trädgårdsarbetare', 'Fastighetsskötare', 'Vaktmästare', 'Snöröjare',
  // Hushåll & övrigt
  'Barnvakt', 'Hundvakt', 'Handyman', 'Montör', 'Säljare', 'Telefonförsäljare', 'Fotograf',
];

// Gör en sträng gemen och accent-okänslig, så att kategorisökningen matchar
// oavsett diakriter ("vaktare" hittar "Väktare"). Delas av alla kategorifilter
// (jobblistan samt publicera/redigera jobb) så att sökningen beter sig likadant.
export function normalisera(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Faktureringspriset beror på företagets plan. Speglar backend/utils/pris.js –
// ändras formeln på ett ställe måste den ändras på båda.
//
//   timlön + timlön*0.32 + timlön*0.06 + ((timlön*1.32) + (timlön*1.32*0.06)) * påslag
//
// 20% gäller för Pro-kunder och gratiskontonas två första pass varje månad, därefter 40%.
export const PÅSLAG_PRO = 0.20;
export const PÅSLAG_GRATIS = 0.40;
export const PRO_PRIS_KR = 299;

// Beräknar vad företaget faktureras för ett bruttobelopp (timlön eller OB-belopp).
export function beräknaFakturapris(belopp, paslag = PÅSLAG_GRATIS) {
  return belopp * 1.38 + belopp * 1.32 * 1.06 * paslag;
}

// Jobb som publicerades före prenumerationssystemet saknar påslag och faktureras med 40%.
export function påslagEller40(paslag) {
  return paslag ?? PÅSLAG_GRATIS;
}

// Formaterar ett belopp som svensk valuta med två decimaler.
export function formateraPris(belopp) {
  return belopp.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Vad företaget hade betalat med Pro, och hur mycket de sparar. Returnerar null när de
// redan har det lägsta priset – då finns inget att erbjuda. Att jämföra påslagen här
// (i stället för att skicka runt en pro-flagga) räcker: en Pro-kund har alltid lägsta
// påslaget, så raden kan aldrig råka visas för dem.
export function proBesparing(belopp, paslag) {
  if (!(belopp > 0) || paslag <= PÅSLAG_PRO) return null;

  const proPris = beräknaFakturapris(belopp, PÅSLAG_PRO);
  const nuPris = beräknaFakturapris(belopp, paslag);
  return { proPris, besparing: nuPris - proPris };
}

// Färger för schemapassens roller. Rollerna är fri text och obegränsat många, så färgen
// härleds ur namnet i stället för att tilldelas – samma roll får då alltid samma färg i
// kalenderrutnätet, i förklaringsraden ovanför det och på schemakorten. Utan det går de
// vyerna inte att läsa ihop.
//
// Färgen är ALDRIG enda signalen: förklaringsraden och dagslistan har alltid rollnamnet i
// klartext, så kollisioner vid fler än åtta roller är ofarliga.
const ROLLPALETT = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#db2777', '#ca8a04', '#dc2626'];

// Grått för pass utan angiven roll.
export const ROLL_UTAN_NAMN = '#9ca3af';

export function rollFärg(namn) {
  const nyckel = normalisera(namn).trim();
  if (!nyckel) return ROLL_UTAN_NAMN;

  // FNV-1a med avslutande avalanche-steg. Behöver inte vara kryptografisk, men den måste
  // fördela sig jämnt över en palett på ÅTTA färger – och det gör inte en enkel
  // hash * 31-summa: 31 ≡ −1 (mod 8), så resultatet mod 8 beror bara på en alternerande
  // summa av tecknens koder och svenska rollnamn av liknande längd hamnar då på samma färg.
  // Avalanche-stegen sprider de höga bitarna ner i de låga, vilket är de som modulo läser.
  let h = 2166136261;
  for (let i = 0; i < nyckel.length; i++) {
    h ^= nyckel.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;

  return ROLLPALETT[Math.abs(h) % ROLLPALETT.length];
}

// Hur ett löneavdrag påverkar beloppen. Speglar beräknaBelopp i backend/utils/pris.js –
// ändra alltid på båda ställena.
//
// Avdraget påverkar INTE fakturan: företaget faktureras på bruttot precis som förut.
// Det reglerar bara vad personen får ut. Taket mot bruttot gör att ett stort avdrag på ett
// kort pass aldrig kan ge negativ utbetalning.
export function beräknaBelopp({ timmar = 0, timlon = 0, obBelopp = 0, avdragBelopp = 0 }) {
  const brutto = (Number(timmar) || 0) * (Number(timlon) || 0) + (Number(obBelopp) || 0);
  const avdrag = Math.min(Math.max(Number(avdragBelopp) || 0, 0), Math.max(brutto, 0));
  return { brutto, avdrag, utbetalning: brutto - avdrag };
}

// Fördelar ett schemas avdrag på ETT pass. per_dag ger hela beloppet, totalt fördelas jämnt.
// Används för förhandsvisningen i publiceringsformuläret; på en skapad tidrapport är
// beloppen redan frysta i kolumnen avdrag och ska läsas därifrån.
export function beräknaAvdragFörPass(avdrag, antalPass) {
  const pass = Math.max(Number(antalPass) || 0, 1);
  return (Array.isArray(avdrag) ? avdrag : []).reduce((sum, a) => {
    const belopp = Number(a?.belopp) || 0;
    // Kvoten avrundas INTE till hela ören – se backend/utils/pris.js. Avrundar man här blir
    // summan över passen inte det företaget skrev in: 5000 / 14 gånger 14 = 4999,96.
    return sum + (a?.typ === 'totalt' ? belopp / pass : belopp);
  }, 0);
}

// Vad avdragen summerar till över HELA schemat, räknat ur de inskrivna beloppen.
//
// Räkna aldrig ut totalen genom att multiplicera tillbaka avdraget per pass. Det var
// precis så "5000 kr" blev "4999,96 kr" i steg 4, och det blir fel igen så fort någon
// återinför en avrundning i fördelningen.
export function beräknaAvdragTotalt(avdrag, antalPass) {
  const pass = Math.max(Number(antalPass) || 0, 1);
  return (Array.isArray(avdrag) ? avdrag : []).reduce((sum, a) => {
    const belopp = Number(a?.belopp) || 0;
    return sum + (a?.typ === 'totalt' ? belopp : belopp * pass);
  }, 0);
}

// Summerar de frysta avdragen på en tidrapport.
export function summeraAvdrag(avdrag) {
  if (!Array.isArray(avdrag)) return 0;
  return avdrag.reduce((sum, a) => sum + (Number(a?.avdraget) || 0), 0);
}

export const STATUSFÄRGER_ANSÖKAN = {
  godkänd:  { bg: '#dcfce7', text: '#16a34a' },
  avvisad:  { bg: '#fee2e2', text: '#dc2626' },
  väntande: { bg: '#f3f4f6', text: '#6b7280' },
};

export const STATUSFÄRGER_TIDRAPPORT = {
  väntar:   { bg: '#fef9c3', text: '#854d0e', etikett: 'Väntar' },
  godkänd:  { bg: '#dcfce7', text: '#16a34a', etikett: 'Godkänd' },
  bestridd: { bg: '#fee2e2', text: '#dc2626', etikett: 'Bestridd' },
};
