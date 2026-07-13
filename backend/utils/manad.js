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

module.exports = { nuvarandeMånad };
