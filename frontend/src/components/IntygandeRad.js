import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normaliseraKrav } from '../utils/behorighet';

// Företagets bild av vad en sökande intygat.
//
// Två delar: vad hen faktiskt kryssade i och när, och – om företaget lagt till krav sedan
// dess – vilka krav som ännu inte bekräftats.
//
// "Kräver ny bekräftelse" är HÄRLETT ur saknadeKrav, inte ett lagrat statusvärde. Brickan
// försvinner därmed av sig själv när personen bekräftar, utan något fält att hålla i synk.
export default function IntygandeRad({ ansökan, style }) {
  const intygade = normaliseraKrav(ansökan?.intygade_krav);
  const saknade = normaliseraKrav(ansökan?.saknadeKrav);

  // intygade_krav är NULL för ansökningar från före funktionen fanns. Utan krav att
  // bekräfta finns inget att visa.
  if (!intygade.length && !saknade.length) return null;

  const datum = ansökan?.intygat_at
    ? new Date(ansökan.intygat_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={style}>
      {intygade.length > 0 && (
        <View style={styles.rad}>
          <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
          <Text style={styles.intygatText}>
            Intygade {intygade.length} {intygade.length === 1 ? 'krav' : 'krav'}
            {datum ? ` · ${datum}` : ''}
          </Text>
        </View>
      )}

      {saknade.length > 0 && (
        <View style={styles.varning}>
          <View style={styles.rad}>
            <Ionicons name="alert-circle" size={13} color="#b45309" />
            <Text style={styles.varningRubrik}>Kräver ny bekräftelse</Text>
          </View>
          <Text style={styles.varningText}>{saknade.join(' · ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  intygatText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  varning: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 5, gap: 2 },
  varningRubrik: { fontSize: 12, color: '#b45309', fontWeight: '700' },
  varningText: { fontSize: 11, color: '#92400e' },
});
