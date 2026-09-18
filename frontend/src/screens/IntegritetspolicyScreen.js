import { ScrollView, StyleSheet, Text, View } from 'react-native';

// Ett avsnitt i policyn: en rubrik följd av ett eller flera textstycken.
// Punktlistor skickas in som stycken som börjar med "- " och renderas indragna.
function Avsnitt({ rubrik, stycken }) {
  return (
    <View style={styles.avsnitt}>
      {rubrik ? <Text style={styles.avsnittsRubrik}>{rubrik}</Text> : null}
      {stycken.map((stycke, index) => {
        const ärPunkt = stycke.startsWith('- ');
        const ärUnderrubrik = stycke.startsWith('# ');
        if (ärUnderrubrik) {
          return (
            <Text key={index} style={styles.underrubrik}>
              {stycke.slice(2)}
            </Text>
          );
        }
        if (ärPunkt) {
          return (
            <View key={index} style={styles.punktRad}>
              <Text style={styles.punkt}>•</Text>
              <Text style={styles.punktText}>{stycke.slice(2)}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={styles.brödtext}>
            {stycke}
          </Text>
        );
      })}
    </View>
  );
}

// Hela policyn som strukturerad data – enklare att läsa och underhålla än en
// enda textklump. Underrubriker inleds med "# " och punkter med "- ".
const AVSNITT = [
  {
    rubrik: '1. Om oss',
    stycken: [
      'FastGig AB tillhandahåller en digital plattform som kopplar samman företag och privatpersoner för kortare jobbpass och längre uppdrag. Denna integritetspolicy förklarar hur vi samlar in, använder och skyddar dina personuppgifter.',
    ],
  },
  {
    rubrik: '2. Personuppgiftsansvarig',
    stycken: [
      'FastGig AB',
      '[Adress]',
      '[Organisationsnummer]',
      'kontakt@fastgig.se',
    ],
  },
  {
    rubrik: '3. Vilka uppgifter vi samlar in',
    stycken: [
      '# För privatpersoner:',
      '- Namn, e-postadress och telefonnummer',
      '- Profilbild',
      '- CV, erfarenheter och kompetenser',
      '- Platsdata (stad) för jobbnotiser',
      '- Betyg och recensioner',
      '# För företag:',
      '- Företagsnamn och organisationsnummer',
      '- Kontaktuppgifter och adress',
      '- Hemsida och beskrivning',
      '# Automatiskt insamlade uppgifter:',
      '- Tidrapporter och jobbhistorik',
      '- Chattmeddelanden',
      '- Enhetstoken för push-notifikationer',
    ],
  },
  {
    rubrik: '4. Varför vi behandlar dina uppgifter',
    stycken: [
      'Vi behandlar dina personuppgifter för att:',
      '- Tillhandahålla och förbättra tjänsten',
      '- Matcha företag och privatpersoner',
      '- Skicka jobbnotiser baserat på din plats',
      '- Hantera betalningar och fakturering via Invoicery Business AB',
      '- Skicka push-notifikationer om jobberbjudanden och uppdateringar',
      '- Uppfylla lagkrav',
      'Rättslig grund: avtal, berättigat intresse och samtycke.',
    ],
  },
  {
    rubrik: '5. Delning av uppgifter',
    stycken: [
      'Vi delar dina uppgifter med:',
      '- Invoicery Business AB – hanterar anställningsavtal och löneadministration',
      '- Supabase – databaslagring (EU)',
      '- Railway – serverhosting (EU)',
      '- Resend – e-posttjänst',
      '- Stripe – betalningshantering',
      'Vi säljer aldrig dina personuppgifter till tredje part.',
    ],
  },
  {
    rubrik: '6. Lagring och säkerhet',
    stycken: [
      'Dina uppgifter lagras i EU. Vi använder kryptering och säkra anslutningar. Tidrapporter och fakturaunderlag sparas i 7 år enligt bokföringslagen.',
    ],
  },
  {
    rubrik: '7. Dina rättigheter',
    stycken: [
      'Du har rätt att:',
      '- Få tillgång till dina personuppgifter',
      '- Rätta felaktiga uppgifter',
      '- Radera ditt konto (via appen under Profil → Ta bort konto)',
      '- Invända mot behandling',
      '- Dataportabilitet',
      '- Lämna in klagomål till Integritetsskyddsmyndigheten (IMY)',
    ],
  },
  {
    rubrik: '8. Cookies och spårning',
    stycken: [
      'Appen använder ingen spårning eller annonsering av tredje part.',
    ],
  },
  {
    rubrik: '9. Barn',
    stycken: ['FastGig riktar sig inte till personer under 18 år.'],
  },
  {
    rubrik: '10. Ändringar',
    stycken: [
      'Vi meddelar dig vid väsentliga ändringar via appen eller e-post.',
    ],
  },
  {
    rubrik: '11. Kontakt',
    stycken: ['kontakt@fastgig.se'],
  },
];

// Statisk skärm som visar FastGigs integritetspolicy. Delas av både företag
// och privatpersoner (nås från profilen) samt av registreringssidan.
export default function IntegritetspolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.innehåll}>
      <Text style={styles.rubrik}>Integritetspolicy för FastGig</Text>
      <Text style={styles.uppdaterad}>Senast uppdaterad: 2026-09-18</Text>

      {AVSNITT.map((avsnitt) => (
        <Avsnitt key={avsnitt.rubrik} rubrik={avsnitt.rubrik} stycken={avsnitt.stycken} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  innehåll: { padding: 24, paddingBottom: 48 },
  rubrik: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  uppdaterad: { fontSize: 13, color: '#888', marginBottom: 24 },
  avsnitt: { marginBottom: 20 },
  avsnittsRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  underrubrik: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 8, marginBottom: 4 },
  brödtext: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 6 },
  punktRad: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  punkt: { fontSize: 15, color: '#333', lineHeight: 22, marginRight: 8 },
  punktText: { flex: 1, fontSize: 15, color: '#333', lineHeight: 22 },
});
