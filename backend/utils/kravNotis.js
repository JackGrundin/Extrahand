const { hämtaAnsökningarFörJobb } = require('../db/ansokningar');
const { hämtaPushToken } = require('../db/användare');
const { skickaNotifikation } = require('./pushNotifikation');
const { normaliseraKrav } = require('./behorighet');

// Notifierar dem som redan sökt när företaget LÄGGER TILL ett behörighetskrav.
//
// Deras intygande är fryst på ansökan och täcker bara de krav som fanns då. Utan besked
// skulle ansökan tyst hamna i läget "kräver ny bekräftelse" på företagets skärm, utan att
// personen fick veta varför – och utan att kunna göra något åt det.
//
// Att TA BORT ett krav notifierar aldrig: färre krav kan inte göra en ansökan ogiltig.
//
// Delas av PUT /api/jobb/:id och PUT /api/scheman/:id. Ett schemas ansökningar ligger på
// dess annons-jobb, så båda anropar med ett jobb-id.
//
// Anropas efter res.json och sväljer sina egna fel: en trasig push får aldrig fälla en
// redigering som redan är sparad.
async function notifieraOmNyaKrav(jobbId, titel, tidigareKrav, nyaKrav) {
  try {
    const tidigare = new Set(normaliseraKrav(tidigareKrav));
    const tillkomna = normaliseraKrav(nyaKrav).filter(k => !tidigare.has(k));
    if (!tillkomna.length || !jobbId) return;

    const ansökningar = await hämtaAnsökningarFörJobb(jobbId);
    // Avvisade och avhoppade berörs inte – de har ingen ansökan kvar att hålla giltig.
    const berörda = ansökningar.filter(a => a.status !== 'avvisad' && a.sokande_id != null);

    for (const a of berörda) {
      const token = await hämtaPushToken(a.sokande_id);
      await skickaNotifikation(
        token,
        'Kraven har uppdaterats',
        `Kraven för "${titel ?? 'uppdraget'}" har uppdaterats. Gå in och bekräfta att du uppfyller de nya kraven för att din ansökan ska förbli giltig.`
      );
    }
  } catch (fel) {
    console.error('Kunde inte notifiera om nya behörighetskrav:', fel);
  }
}

module.exports = { notifieraOmNyaKrav };
