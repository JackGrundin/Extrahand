import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Delat tomt tillstånd för alla listor. Ersätter fyra ad hoc-stilar (tom, tomText,
// ingaJobb …) som glidit isär i marginal och färg. En rubrik alltid, ikon och undertext
// valfria. Undertexten bär det hjälpsamma – t.ex. "prova en annan stad" – och skärmen
// väljer den kontextuellt (filter aktivt vs helt tom lista).
//
// Ikonen är dekorativ: rubriken/undertexten läses av skärmläsaren, ikonen döljs (samma
// a11y-mönster som resten av appen).
export default function TomtTillstånd({ ikon, rubrik, text, style }) {
  return (
    <View style={[styles.behållare, style]}>
      {ikon && (
        <Ionicons
          name={ikon}
          size={44}
          color="#d1d5db"
          style={styles.ikon}
          accessible={false}
          importantForAccessibility="no"
        />
      )}
      <Text style={styles.rubrik}>{rubrik}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  behållare: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  ikon: { marginBottom: 14 },
  rubrik: { fontSize: 16, fontWeight: '700', color: '#4b5563', textAlign: 'center' },
  text: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
