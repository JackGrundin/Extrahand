// Enda källan till sanning för faktureringspriset. Formeln beror på företagets plan:
//
//   timlön + timlön*0.32 + timlön*0.06 + ((timlön*1.32) + (timlön*1.32*0.06)) * påslag
//
// dvs. bruttolön + sociala avgifter (32%) + semesterersättning (6%), och därefter
// vårt påslag ovanpå (timlön * 1.32 * 1.06).
//
// Påslaget är 20% för Pro-kunder och för gratiskontonas två första pass varje månad,
// därefter 40%. Påslaget fryses när jobbet publiceras (se db/migrations/prenumeration.sql).

const PÅSLAG_PRO = 0.20;
const PÅSLAG_GRATIS = 0.40;
const GRATIS_PASS_PER_MANAD = 2;

// Beräknar vad företaget faktureras för ett givet bruttobelopp (timlön eller
// OB-belopp). Med påslag 0.20 blir faktorn 1.65984, med 0.40 blir den 1.93968.
function beräknaFakturapris(belopp, paslag = PÅSLAG_GRATIS) {
  return belopp * 1.38 + belopp * 1.32 * 1.06 * paslag;
}

// Jobb och tidrapporter som skapades före prenumerationssystemet saknar påslag.
// De faktureras med 40%, vilket ligger närmast det pris som gällde tidigare.
function påslagEller40(paslag) {
  return paslag ?? PÅSLAG_GRATIS;
}

module.exports = {
  PÅSLAG_PRO,
  PÅSLAG_GRATIS,
  GRATIS_PASS_PER_MANAD,
  beräknaFakturapris,
  påslagEller40,
};
