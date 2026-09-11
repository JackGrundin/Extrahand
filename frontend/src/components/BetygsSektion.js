import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Delad betygsvy. Datan kommer från api.hämtaBetyg(id) som ger
// { snitt, antal, betyg: [{ stjarnor, kommentar, created_at, företagNamn }] }.
// företagNamn är namnet på den som SATTE betyget (företag när en privatperson betygsätts,
// privatperson när ett företag betygsätts) – etiketten är därför generisk.
//
// Två delar exporteras separat så att sammanfattningen kan sitta högt upp (under namnet) och
// listan längre ner i profilskärmarna, precis som layouten ser ut idag.

// Fem stjärnor, fyllda upp till `värde`.
export function Stjärnor({ värde = 0, storlek = 14 }) {
  return (
    <View style={styles.stjärnRad}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons key={n} name={n <= värde ? 'star' : 'star-outline'} size={storlek} color="#f59e0b" />
      ))}
    </View>
  );
}

function antalText(antal) {
  return `${antal} ${antal === 1 ? 'recension' : 'recensioner'}`;
}

// Kompakt sammanfattning: ⭐ snitt (N recensioner). Visar "Inga betyg ännu" när inga finns.
export function BetygsSammanfattning({ betyg }) {
  if (!betyg || betyg.antal === 0) {
    return <Text style={styles.inget}>Inga betyg ännu</Text>;
  }
  return (
    <View style={styles.sammanfattning}>
      <Ionicons name="star" size={18} color="#f59e0b" />
      <Text style={styles.snitt}>{betyg.snitt.toFixed(1)}</Text>
      <Text style={styles.antal}>({antalText(betyg.antal)})</Text>
    </View>
  );
}

// Lista med ett kort per recension. Returnerar null när inga betyg finns.
export function BetygsLista({ betyg, rubrik = 'Recensioner' }) {
  if (!betyg || betyg.antal === 0) return null;
  return (
    <View style={styles.sektion}>
      <View style={styles.rubrikRad}>
        <Text style={styles.rubrik}>{rubrik}</Text>
        <View style={styles.rubrikSnitt}>
          <Ionicons name="star" size={13} color="#f59e0b" />
          <Text style={styles.rubrikSnittText}>{betyg.snitt.toFixed(1)}</Text>
          <Text style={styles.rubrikAntal}>· {antalText(betyg.antal)}</Text>
        </View>
      </View>
      {betyg.betyg.map((b, i) => (
        <View key={i} style={styles.kort}>
          <View style={styles.kortHuvud}>
            <Stjärnor värde={b.stjarnor} />
            <Text style={styles.datum}>{new Date(b.created_at).toLocaleDateString('sv-SE')}</Text>
          </View>
          {b.företagNamn && <Text style={styles.namn}>{b.företagNamn}</Text>}
          {b.kommentar && <Text style={styles.kommentar}>{b.kommentar}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stjärnRad: { flexDirection: 'row', gap: 2 },
  inget: { fontSize: 14, color: '#aaa', marginBottom: 12 },
  sammanfattning: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  snitt: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  antal: { fontSize: 14, color: '#888' },
  sektion: { width: '100%', marginTop: 8 },
  rubrikRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  rubrikSnitt: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rubrikSnittText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  rubrikAntal: { fontSize: 12, color: '#aaa' },
  kort: { backgroundColor: '#fafafa', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  kortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  datum: { fontSize: 12, color: '#aaa' },
  namn: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  kommentar: { fontSize: 14, color: '#444', lineHeight: 20 },
});
