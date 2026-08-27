import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ORD = ['', 'Dåligt', 'Okej', 'Bra', 'Mycket bra', 'Utmärkt'];

// Stjärnraden med tillhörande ord. Delas av BetygsattScreen (helskärm) och BetygModal
// (popupen efter ett avslutat pass) – två kopior av samma stjärnor hade garanterat glidit
// isär i storlek och färg.
export default function StjärnVal({ värde, onÄndra, storlek = 44 }) {
  return (
    <>
      <View style={styles.rad}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onÄndra(n)} style={styles.stjärna} activeOpacity={0.7}>
            <Ionicons
              name={n <= värde ? 'star' : 'star-outline'}
              size={storlek}
              color={n <= värde ? '#f59e0b' : '#d1d5db'}
            />
          </TouchableOpacity>
        ))}
      </View>
      {värde > 0 && <Text style={styles.ord}>{ORD[värde]}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  stjärna: { padding: 4 },
  ord: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#f59e0b', marginBottom: 8 },
});
