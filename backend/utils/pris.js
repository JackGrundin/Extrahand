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

// Summerar OB-tilläggen till ett kronbelopp för ett pass. Varje tillägg är ett
// tidsintervall (start–slut) med antingen en procentsats av timlönen eller ett fast
// kronbelopp per timme. Speglas i frontend/src/utils/datumHelper.js (beräknaObBelopp)
// – ändra alltid på båda ställena.
function beräknaObBelopp(obTillagg, timlön) {
  if (!Array.isArray(obTillagg) || !obTillagg.length || !timlön) return 0;
  return obTillagg.reduce((sum, ob) => {
    const [startH = 0, startM = 0] = ob.start.split(':').map(Number);
    const [slutH = 0, slutM = 0] = ob.slut.split(':').map(Number);
    const timmar = (slutH * 60 + slutM - (startH * 60 + startM)) / 60;
    if (timmar <= 0) return sum;
    return sum + (ob.typ === 'procent' ? timmar * timlön * (ob.värde / 100) : timmar * ob.värde);
  }, 0);
}

// Enda källan till sanning för hur ett löneavdrag påverkar beloppen.
//
// Avdraget påverkar INTE fakturan: företaget faktureras på bruttot precis som förut
// (beräknaFakturapris rörs inte). Avdraget reglerar bara vad personen får ut. Vill man
// i stället låta avdraget minska fakturan är det HÄR det ändras – ingen annanstans.
//
// Taket mot bruttot är inte kosmetika: ett totalt-avdrag på 6 000 kr fördelat över 20 pass
// är 300 kr, och ett tvåtimmarspass på 150 kr/h ger 300 kr brutto. Utan klampningen skulle
// minsta avvikelse ge negativ utbetalning.
//
// Speglas i frontend/src/utils/konstanter.js – ändra alltid på båda ställena.
function beräknaBelopp({ timmar = 0, timlon = 0, obBelopp = 0, avdragBelopp = 0 }) {
  const brutto = (Number(timmar) || 0) * (Number(timlon) || 0) + (Number(obBelopp) || 0);
  const avdrag = Math.min(Math.max(Number(avdragBelopp) || 0, 0), Math.max(brutto, 0));
  return { brutto, avdrag, utbetalning: brutto - avdrag };
}

// Löser upp ett schemas avdrag till konkreta belopp för EN tidrapport.
//   per_dag -> hela beloppet på varje rapporterat pass
//   totalt  -> beloppet fördelat jämnt över schemats pass
// Returnerar raderna som ska FRYSAS på tidrapporten (med det belopp som faktiskt drogs)
// samt summan. antalPass klampas till minst 1 så att division med noll är omöjlig.
function beräknaAvdragFörPass(avdrag, antalPass) {
  const pass = Math.max(Number(antalPass) || 0, 1);
  const rader = (Array.isArray(avdrag) ? avdrag : []).map(a => {
    const belopp = Number(a?.belopp) || 0;
    // Kvoten avrundas INTE till hela ören. Avrundar man här blir summan över passen inte
    // det företaget skrev in: 5000 / 14 = 357,142857 -> 357,14, gånger 14 = 4999,96.
    // avdrag_belopp är numeric utan angiven precision, så databasen avrundar inte heller.
    const avdraget = a?.typ === 'totalt' ? belopp / pass : belopp;
    return {
      avdrag_id: a?.id ?? null,
      namn: a?.namn ?? 'Avdrag',
      typ: a?.typ === 'totalt' ? 'totalt' : 'per_dag',
      belopp,
      ...(a?.typ === 'totalt' ? { antalPass: pass } : {}),
      avdraget,
    };
  });
  return { rader, summa: rader.reduce((sum, r) => sum + r.avdraget, 0) };
}

// Summerar de frysta avdragen på en tidrapport.
function summeraAvdrag(avdrag) {
  if (!Array.isArray(avdrag)) return 0;
  return avdrag.reduce((sum, a) => sum + (Number(a?.avdraget) || 0), 0);
}

const TID_MÖNSTER = /^\d{1,2}:\d{2}$/;

// Formkontroll av OB-tillägg innan de sparas. Returnerar felsträng eller null.
//
// Utan den här kan ett trasigt intervall låsa cron/schemaTidrapport.js i en evig
// omförsöksloop: beräknaObBelopp gör ob.start.split(':') och kastar om start saknas,
// cron-jobbet fångar felet och sätter tillbaka passet till 'planerad', och försöket görs
// om var femte minut för alltid. OB kommer rått från klienten, så kontrollen måste ske här.
function valideraObTillagg(obTillagg) {
  if (obTillagg == null) return null;
  if (!Array.isArray(obTillagg)) return 'OB-tillägg måste vara en lista';

  for (const ob of obTillagg) {
    if (!ob || typeof ob !== 'object') return 'Ogiltigt OB-tillägg';
    if (!TID_MÖNSTER.test(String(ob.start ?? ''))) return 'OB-tillägg måste ha en starttid (HH:MM)';
    if (!TID_MÖNSTER.test(String(ob.slut ?? ''))) return 'OB-tillägg måste ha en sluttid (HH:MM)';
    if (!['procent', 'fast'].includes(ob.typ)) return 'OB-tillägg måste vara procent eller fast';
    if (!(Number(ob.värde) > 0)) return 'OB-tillägg måste ha ett värde större än noll';

    const [startH, startM] = String(ob.start).split(':').map(Number);
    const [slutH, slutM] = String(ob.slut).split(':').map(Number);
    if (startH > 23 || slutH > 23 || startM > 59 || slutM > 59) return 'Ogiltig tid i OB-tillägg';
    if (slutH * 60 + slutM <= startH * 60 + startM) return 'OB-tilläggets sluttid måste vara efter starttiden';
  }
  return null;
}

module.exports = {
  PÅSLAG_PRO,
  PÅSLAG_GRATIS,
  GRATIS_PASS_PER_MANAD,
  beräknaFakturapris,
  påslagEller40,
  beräknaObBelopp,
  beräknaBelopp,
  beräknaAvdragFörPass,
  summeraAvdrag,
  valideraObTillagg,
};
