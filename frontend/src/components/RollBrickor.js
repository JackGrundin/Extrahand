import { View, Text, StyleSheet } from 'react-native';
import { rollFärg } from '../utils/konstanter';

// Rollerna i ett schema som färgade brickor. Färgen kommer från rollFärg, samma som
// kalenderns prickar och förklaringsrad använder, så att ett schemakort och kalendern går
// att läsa ihop.
//
// Ett schema har ingen egen kategori längre – rollen sätts per pass. Saknar schemat roller
// helt (t.ex. ett gammalt schema, eller ett där företaget inte fyllt i något) visas en
// neutral "Schema"-bricka, så att kortet aldrig står helt utan innehållsmarkör.
export default function RollBrickor({ roller = [], max = 3, style }) {
  const lista = Array.isArray(roller) ? roller.filter(Boolean) : [];

  if (lista.length === 0) {
    return (
      <View style={[styles.rad, style]}>
        <View style={styles.schemaBricka}>
          <Text style={styles.schemaText}>Schema</Text>
        </View>
      </View>
    );
  }

  const visade = lista.slice(0, max);
  const fler = lista.length - visade.length;

  return (
    <View style={[styles.rad, style]}>
      {visade.map(roll => (
        <View key={roll} style={[styles.bricka, { backgroundColor: rollFärg(roll) + '1a', borderColor: rollFärg(roll) }]}>
          <View style={[styles.prick, { backgroundColor: rollFärg(roll) }]} />
          <Text style={[styles.text, { color: rollFärg(roll) }]} numberOfLines={1}>{roll}</Text>
        </View>
      ))}
      {fler > 0 && <Text style={styles.fler}>+{fler}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  bricka: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 130 },
  prick: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  fler: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  schemaBricka: { backgroundColor: '#eff6ff', borderRadius: 7, borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 7, paddingVertical: 3 },
  schemaText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
});
