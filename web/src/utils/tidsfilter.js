// Tidsfilter för adminvyerna (Tidrapporter + Fakturering). Webb-only – speglas inte
// med appen. Alla intervall är "fram till nu", så bara den undre gränsen (from)
// varierar och skickas till backend som ?from=YYYY-MM-DD. 'totalt' → ingen gräns.
import { datumTillIso } from './datumHelper';

// Pill-knapparnas ordning och etiketter. Första = standard.
export const TIDSFILTER = [
  { nyckel: 'denna-manad', etikett: 'Denna månad' },
  { nyckel: '3-manader', etikett: 'Senaste 3 månader' },
  { nyckel: '6-manader', etikett: 'Senaste 6 månader' },
  { nyckel: 'detta-ar', etikett: 'Detta år' },
  { nyckel: 'totalt', etikett: 'Totalt' },
];

export const STANDARD_TIDSFILTER = TIDSFILTER[0].nyckel;

// Delad localStorage-nyckel så valet följer med mellan de två admin-flikarna.
export const TIDSFILTER_NYCKEL = 'fastgig.admin.tidsfilter';

// Etiketten för ett nyckelvärde (fallback till standardetiketten för okända värden).
export function tidsfilterEtikett(nyckel) {
  return (TIDSFILTER.find(t => t.nyckel === nyckel) || TIDSFILTER[0]).etikett;
}

// Undre datumgräns (YYYY-MM-DD) för ett valt filter, eller null för 'totalt'.
// Månad/år är kalenderankrade, 3/6 månader är rullande från dagens datum.
export function tidsfilterFrån(nyckel, nu = new Date()) {
  switch (nyckel) {
    case 'denna-manad':
      return datumTillIso(new Date(nu.getFullYear(), nu.getMonth(), 1));
    case '3-manader':
      return datumTillIso(new Date(nu.getFullYear(), nu.getMonth() - 3, nu.getDate()));
    case '6-manader':
      return datumTillIso(new Date(nu.getFullYear(), nu.getMonth() - 6, nu.getDate()));
    case 'detta-ar':
      return datumTillIso(new Date(nu.getFullYear(), 0, 1));
    case 'totalt':
      return null;
    default:
      return datumTillIso(new Date(nu.getFullYear(), nu.getMonth(), 1));
  }
}
