import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Delad chatt-/betygsknapp. Tidigare kopierades knappstilen till varje skärm och
// divergerade, vilket gjorde att knapparna blev ocentrerade eller full skärmbredd på
// olika ställen. All styling bor nu här – rätta på ett ställe, rätt överallt.
//
// Centreringen är AVSIKTLIGT förälder-oberoende: yttre View:n stretchar över hela
// förälderns bredd och centrerar sedan själva knappen. Det gör att knappen hamnar rätt
// oavsett om den placeras i en kolumn, en rad, eller en förälder med alignItems: 'center'.
export default function HandlingsKnapp({ text, onPress, variant = 'lank', ikon, style }) {
  const fylld = variant === 'fylld';
  return (
    <View style={[styles.yttre, style]}>
      <TouchableOpacity
        style={[styles.knapp, fylld ? styles.fylld : styles.lank]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {ikon && (
          <Ionicons name={ikon} size={18} color={fylld ? '#fff' : '#2563eb'} style={styles.ikon} />
        )}
        <Text style={[styles.text, fylld ? styles.textFylld : styles.textLank]}>{text}</Text>
      </TouchableOpacity>
    </View>
  );
}

const MAXBREDD = 400;

const styles = StyleSheet.create({
  // Stretchar över förälderns bredd och centrerar knappen. alignSelf: 'stretch' vinner
  // även över en förälder med alignItems: 'center', så centreringen är alltid konsekvent.
  yttre: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  knapp: {
    width: '100%',
    maxWidth: MAXBREDD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  lank: { backgroundColor: '#eff6ff' },
  fylld: { backgroundColor: '#2563eb' },
  ikon: { marginRight: 8 },
  text: { fontWeight: '600' },
  textLank: { color: '#2563eb', fontSize: 13 },
  textFylld: { color: '#fff', fontSize: 15 },
});
