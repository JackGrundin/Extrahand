export const TYPER = ['gig', 'sommarjobb'];
export const TYPER_FILTER = ['Alla', 'gig', 'sommarjobb'];

export const KATEGORIER = [
  'Servitör', 'Kock', 'Diskare', 'Barista', 'Butiksbiträde', 'Kassör',
  'Lagerarbetare', 'Paketerare', 'Städare', 'Receptionist', 'Kontorsassistent',
  'IT-tekniker', 'Snickare', 'Hantlangare', 'Trädgårdsarbetare', 'Barnvakt',
  'Väktare', 'Chaufför', 'Eventpersonal', 'Handyman', 'Säljare', 'Vakt',
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
