// Visas under faktureringspriset för företag som ligger på det högre priset: hur mycket
// billigare passet blivit med Pro. Allt uttrycks i kronor – påslaget i sig visas aldrig
// för kunden.
//
// Renderar ingenting för Pro-kunder eller när ingen timlön är ifylld (proBesparing
// returnerar då null).
import { Text, StyleSheet } from 'react-native';
import { proBesparing, formateraPris } from '../utils/konstanter';

export default function ProBesparing({ timlön, paslag, style }) {
  const besparing = proBesparing(timlön, paslag);
  if (!besparing) return null;

  return (
    <Text style={[styles.text, style]}>
      Med Pro hade ni betalat{' '}
      <Text style={styles.framhävd}>{formateraPris(besparing.proPris)} kr/h</Text> istället –
      spara <Text style={styles.framhävd}>{formateraPris(besparing.besparing)} kr/h</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, color: '#0369a1', lineHeight: 17, marginTop: 2 },
  framhävd: { fontWeight: '700', color: '#1d4ed8' },
});
