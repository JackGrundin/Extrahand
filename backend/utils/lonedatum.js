// Härleder NÄR en privatperson får sin lön för en godkänd tidrapport. Datumet lagras
// aldrig – det räknas fram ur godkännandetidpunkten och personens utbetalningsinställning
// varje gång rapporten visas. Svensk lokaltid genomgående (via tid.js), eftersom "den
// arbetsdag efter" och "den 25:e" är kalenderbegrepp i svensk tid, inte UTC.

const { idagStockholm, nästaDatum } = require('./tid');

// Veckodag för ett YYYY-MM-DD-datum: 0 = söndag, 6 = lördag. Datumet behandlas som ett
// rent kalenderdatum (ingen tidszon), så UTC räcker och ger samma veckodag överallt.
function veckodag(datum) {
  const [år, mån, dag] = datum.split('-').map(Number);
  return new Date(Date.UTC(år, mån - 1, dag)).getUTCDay();
}

// Lägger till en månad på ett YYYY-MM-DD och sätter dagen till den 25:e. Hanterar
// årsskifte (december → januari nästa år).
function denTjugofemteNästaMånad(datum) {
  let [år, mån] = datum.split('-').map(Number);
  mån += 1;
  if (mån > 12) { mån = 1; år += 1; }
  return `${år}-${String(mån).padStart(2, '0')}-25`;
}

// godkandAt: ISO-tidsstämpel (timestamptz) för när tidrapporten godkändes. Saknas den –
// gamla rader från före kolumnen fanns – används fallbackTidpunkt (rapportens created_at).
// installning: 'direkt' eller '25'. Returnerar ett YYYY-MM-DD, eller null om vi saknar
// både godkandAt och fallback.
function beräknaLönedatum(godkandAt, installning, fallbackTidpunkt = null) {
  const tidpunkt = godkandAt || fallbackTidpunkt;
  if (!tidpunkt) return null;

  // Det lokala (svenska) datumet för godkännandet – grunden för båda reglerna.
  const godkandDatum = idagStockholm(new Date(tidpunkt));

  if (installning === '25') {
    const dag = Number(godkandDatum.split('-')[2]);
    // Före den 25:e → den 25:e samma månad, annars (den 25:e eller senare) nästa månad.
    if (dag < 25) {
      const [år, mån] = godkandDatum.split('-');
      return `${år}-${mån}-25`;
    }
    return denTjugofemteNästaMånad(godkandDatum);
  }

  // 'direkt' (standard): nästa arbetsdag efter godkännandet. Landar dagen på en helg
  // flyttas den fram till måndag.
  let datum = nästaDatum(godkandDatum);
  while (veckodag(datum) === 0 || veckodag(datum) === 6) {
    datum = nästaDatum(datum);
  }
  return datum;
}

module.exports = { beräknaLönedatum };
