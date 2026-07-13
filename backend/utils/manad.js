// Månadsstämpel i svensk lokaltid. Används både av pass-räknaren vid publicering
// och av cron-jobbet som nollställer den. Månadsskiftet ska följa svensk kalender,
// inte serverns UTC-tid – annars skulle räknaren nollställas en timme fel.

const STOCKHOLM = 'Europe/Stockholm';

// Returnerar innevarande månad som 'YYYY-MM' i svensk lokaltid.
function nuvarandeMånad(nu = new Date()) {
  const delar = {};
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: STOCKHOLM,
    year: 'numeric',
    month: '2-digit',
  });
  for (const d of dtf.formatToParts(nu)) delar[d.type] = d.value;
  return `${delar.year}-${delar.month}`;
}

// Returnerar tidpunkten då innevarande månad började (den 1:a kl. 00:00 svensk tid),
// som ISO-sträng. Används för att räkna hur många jobb ett företag publicerat i månaden.
function månadensStart(nu = new Date()) {
  const [år, månad] = nuvarandeMånad(nu).split('-').map(Number);

  // Gissa midnatt UTC och justera med Stockholms offset vid just den tidpunkten, så att
  // gränsen hamnar på svensk midnatt oavsett sommar- eller vintertid.
  const gissning = Date.UTC(år, månad - 1, 1);
  const lokalMidnatt = new Date(gissning);
  const offsetMs =
    new Date(lokalMidnatt.toLocaleString('en-US', { timeZone: 'UTC' })).getTime() -
    new Date(lokalMidnatt.toLocaleString('en-US', { timeZone: STOCKHOLM })).getTime();

  return new Date(gissning + offsetMs).toISOString();
}

module.exports = { nuvarandeMånad, månadensStart };
