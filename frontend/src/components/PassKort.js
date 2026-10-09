import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parsaArbetstider, formatPeriod } from '../utils/datumHelper';
import RollBrickor from './RollBrickor';
import Kort from './Kort';
import { FÄRG, RADIE } from '../utils/tema';

const STATUS = {
  godkänd:  { bg: FÄRG.framgångMjuk, text: FÄRG.framgång, etikett: 'Bekräftat pass' },
  väntande: { bg: FÄRG.ytaDämpad, text: FÄRG.textDämpad, etikett: 'Väntar på svar' },
  avvisad:  { bg: FÄRG.felMjuk, text: FÄRG.fel, etikett: 'Nekad' },
};

export default function PassKort({ pass }) {
  const färg = STATUS[pass.status] ?? STATUS.väntande;
  const schema = parsaArbetstider(pass.arbetstider);
  const datum = schema ? schema.map(d => d.datum).filter(Boolean) : [];
  // Rollen ligger per dag i arbetstider för schemapass. Vanliga pass och scheman skapade
  // före rollen infördes saknar fältet – då renderas ingen bricka.
  const roller = [...new Set((schema ?? []).map(d => d.kategori).filter(Boolean))];

  return (
    <Kort style={styles.kort}>
      <View style={styles.huvud}>
        <Ionicons name="calendar-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
        <Text style={styles.rubrik} numberOfLines={1}>{pass.jobbTitel ?? 'Pass'}</Text>
        <View style={[styles.statusBricka, { backgroundColor: färg.bg }]}>
          <Text style={[styles.statusText, { color: färg.text }]}>{färg.etikett}</Text>
        </View>
      </View>

      {roller.length > 0 && <RollBrickor roller={roller} style={{ marginTop: 10 }} />}

      {/* Perioden i stället för en uppräkning av datumen. Antalet pass står kvar
          bredvid: det gick tidigare att läsa ur "+19 till", och utan siffran säger
          en period på två månader inget om hur mycket arbete den rymmer. */}
      {datum.length > 0 ? (
        <View style={styles.datumRad}>
          <View style={styles.datumChip}>
            <Text style={styles.datumChipText}>{formatPeriod(datum)}</Text>
          </View>
          {datum.length > 1 && (
            <Text style={styles.antal}>{datum.length} pass</Text>
          )}
        </View>
      ) : null}
    </Kort>
  );
}

const styles = StyleSheet.create({
  kort: { marginTop: 12 },
  huvud: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rubrik: { fontSize: 15, fontWeight: '700', color: FÄRG.text, flex: 1 },
  statusBricka: { borderRadius: RADIE.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  datumRad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  datumChip: { backgroundColor: FÄRG.primärMjuk, borderRadius: RADIE.sm, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: FÄRG.primärKant },
  datumChipText: { fontSize: 13, fontWeight: '700', color: FÄRG.primär },
  antal: { fontSize: 13, color: FÄRG.textDämpad, fontWeight: '600' },
});
