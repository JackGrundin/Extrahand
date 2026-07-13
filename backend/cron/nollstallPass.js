// Cron-jobb som nollställer företagens pass-räknare den 1:a varje månad, så att
// alla får sina två gratispass med 20% påslag på nytt.
//
// Notera att detta INTE är säkerhetsnätet: databasfunktionen oka_pass_denna_manad
// jämför månadsstämpeln (pass_manad) vid varje publicering och nollställer räknaren
// lazily om månaden bytt. Så även om den här processen startats om över ett
// månadsskifte – vilket Railway gör vid varje deploy – kan ingen faktureras 40% i
// en ny månad. Cron-jobbet håller bara datan städad.

const { nollställAllaPass } = require('../db/prenumeration');
const { nuvarandeMånad } = require('../utils/manad');

const INTERVALL_MS = 60 * 60 * 1000; // en timme

// Nollställer om månaden bytt sedan förra kontrollen.
async function kollaMånadsskifte(senasteMånad) {
  const månad = nuvarandeMånad();
  if (månad === senasteMånad) return senasteMånad;

  await nollställAllaPass(månad);
  console.log('Pass-räknaren nollställd för', månad);
  return månad;
}

function startaNollställPass() {
  let senasteMånad = nuvarandeMånad();

  setInterval(async () => {
    try {
      senasteMånad = await kollaMånadsskifte(senasteMånad);
    } catch (fel) {
      console.error('Fel i nollställning av pass-räknare:', fel);
    }
  }, INTERVALL_MS);

  console.log('Cron för nollställning av pass-räknare startad (kontroll varje timme)');
}

module.exports = { startaNollställPass, kollaMånadsskifte };
