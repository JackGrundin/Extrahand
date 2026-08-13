import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parsaArbetstider, formatPeriod } from '../utils/datumHelper';
import RollBrickor from './RollBrickor';

const STATUS = {
  godkänd:  { bg: '#dcfce7', text: '#16a34a', etikett: 'Bekräftat pass' },
  väntande: { bg: '#f3f4f6', text: '#6b7280', etikett: 'Väntar på svar' },
  avvisad:  { bg: '#fee2e2', text: '#dc2626', etikett: 'Nekad' },
};

export default function PassKort({ pass }) {
  const färg = STATUS[pass.status] ?? STATUS.väntande;
  const schema = parsaArbetstider(pass.arbetstider);
  const datum = schema ? schema.map(d => d.datum).filter(Boolean) : [];
  // Rollen ligger per dag i arbetstider för schemapass. Vanliga pass och scheman skapade
  // före rollen infördes saknar fältet – då renderas ingen bricka.
  const roller = [...new Set((schema ?? []).map(d => d.kategori).filter(Boolean))];

  return (
    <View style={styles.kort}>
      <View style={styles.huvud}>
        <Ionicons name="calendar-outline" size={18} color="#2563eb" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  kort: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#e0e7ff' },
  huvud: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rubrik: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  statusBricka: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  datumRad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  datumChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  datumChipText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  antal: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
});
