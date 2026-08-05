import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Förloppsindikator för det stegvisa schemaflödet. Avklarade steg går att trycka på för
// att hoppa tillbaka – framåt gör man bara via Nästa, eftersom varje steg har en egen
// grind som måste passeras.
export default function StegIndikator({ steg, antal, etiketter = [], onVäljSteg }) {
  return (
    <View style={styles.container}>
      <View style={styles.prickRad}>
        {Array.from({ length: antal }, (_, i) => {
          const nummer = i + 1;
          const avklarat = nummer < steg;
          const aktivt = nummer === steg;
          return (
            <View key={nummer} style={styles.segment}>
              <TouchableOpacity
                onPress={() => avklarat && onVäljSteg?.(nummer)}
                disabled={!avklarat}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <View style={[styles.prick, avklarat && styles.prickAvklarad, aktivt && styles.prickAktiv]}>
                  {avklarat
                    ? <Ionicons name="checkmark" size={13} color="#fff" />
                    : <Text style={[styles.prickText, aktivt && styles.prickTextAktiv]}>{nummer}</Text>}
                </View>
              </TouchableOpacity>
              {nummer < antal && <View style={[styles.linje, avklarat && styles.linjeAvklarad]} />}
            </View>
          );
        })}
      </View>
      <Text style={styles.etikett}>
        Steg {steg} av {antal}{etiketter[steg - 1] ? ` · ${etiketter[steg - 1]}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  prickRad: { flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  prick: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  prickAvklarad: { backgroundColor: '#16a34a' },
  prickAktiv: { backgroundColor: '#2563eb' },
  prickText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  prickTextAktiv: { color: '#fff' },
  linje: { flex: 1, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  linjeAvklarad: { backgroundColor: '#16a34a' },
  etikett: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginTop: 8 },
});
