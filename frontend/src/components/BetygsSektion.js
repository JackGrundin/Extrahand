import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';
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
    <View style={styles.stjärnRad} accessible accessibilityLabel={`Betyg ${värde} av 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons key={n} name={n <= värde ? 'star' : 'star-outline'} size={storlek} color="#f59e0b" accessible={false} importantForAccessibility="no" />
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
      <Ionicons name="star" size={18} color="#f59e0b" accessible={false} importantForAccessibility="no" />
      <Text style={styles.snitt}>{betyg.snitt.toFixed(1)}</Text>
      <Text style={styles.antal}>({antalText(betyg.antal)})</Text>
    </View>
  );
}

// Ett recensionskort. Bruten ut så att listan och "Visa alla"-vyn renderar identiskt.
function Recension({ b }) {
  return (
    <View style={styles.kort}>
      <View style={styles.kortHuvud}>
        <Stjärnor värde={b.stjarnor} />
        <Text style={styles.datum}>{new Date(b.created_at).toLocaleDateString('sv-SE')}</Text>
      </View>
      {b.företagNamn && <Text style={styles.namn}>{b.företagNamn}</Text>}
      {b.kommentar && <Text style={styles.kommentar}>{b.kommentar}</Text>}
    </View>
  );
}

// Rubrikrad med snitt + antal, delad av listan och modalens header.
function RubrikRad({ rubrik, betyg }) {
  return (
    <View style={styles.rubrikRad}>
      <Text style={styles.rubrik}>{rubrik}</Text>
      <View style={styles.rubrikSnitt}>
        <Ionicons name="star" size={13} color="#f59e0b" accessible={false} importantForAccessibility="no" />
        <Text style={styles.rubrikSnittText}>{betyg.snitt.toFixed(1)}</Text>
        <Text style={styles.rubrikAntal}>· {antalText(betyg.antal)}</Text>
      </View>
    </View>
  );
}

// Antal recensioner som visas direkt på profilen innan "Visa alla" öppnas.
const MAX_SYNLIGA = 3;

// Lista med ett kort per recension. Visar bara de MAX_SYNLIGA senaste; finns fler öppnar
// "Visa alla"-knappen en fullskärmsmodal med hela listan (öppnar en ny vy utan att kräva
// en registrerad skärm i varje navigator). Returnerar null när inga betyg finns.
export function BetygsLista({ betyg, rubrik = 'Recensioner' }) {
  const [visaAlla, setVisaAlla] = useState(false);
  if (!betyg || betyg.antal === 0) return null;

  const synliga = betyg.betyg.slice(0, MAX_SYNLIGA);
  const harFler = betyg.betyg.length > MAX_SYNLIGA;

  return (
    <View style={styles.sektion}>
      <RubrikRad rubrik={rubrik} betyg={betyg} />
      {synliga.map((b, i) => <Recension key={i} b={b} />)}

      {harFler && (
        <TouchableOpacity
          style={styles.visaAllaKnapp}
          onPress={() => setVisaAlla(true)}
          accessibilityRole="button"
          accessibilityLabel={`Visa alla ${betyg.antal} recensioner`}
        >
          <Text style={styles.visaAllaText}>Visa alla {betyg.antal} recensioner</Text>
          <Ionicons name="chevron-forward" size={16} color="#2563eb" accessible={false} importantForAccessibility="no" />
        </TouchableOpacity>
      )}

      <Modal
        visible={visaAlla}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisaAlla(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitel}>{rubrik}</Text>
            <TouchableOpacity
              onPress={() => setVisaAlla(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Stäng"
            >
              <Ionicons name="close" size={26} color="#1a1a1a" accessible={false} importantForAccessibility="no" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSnitt}>
            <Ionicons name="star" size={16} color="#f59e0b" accessible={false} importantForAccessibility="no" />
            <Text style={styles.modalSnittText}>{betyg.snitt.toFixed(1)}</Text>
            <Text style={styles.modalSnittAntal}>· {antalText(betyg.antal)}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.modalLista}>
            {betyg.betyg.map((b, i) => <Recension key={i} b={b} />)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  visaAllaKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 2 },
  visaAllaText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  modalTitel: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modalSnitt: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalSnittText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalSnittAntal: { fontSize: 13, color: '#888' },
  modalLista: { padding: 20 },
});
