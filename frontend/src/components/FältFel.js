import { Text, StyleSheet } from 'react-native';

// Röd felrad som visas under ett formulärfält. Renderar ingenting när text saknas,
// så den kan ligga kvar villkorslöst i JSX: <FältFel text={fel.titel} />.
export default function FältFel({ text }) {
  if (!text) return null;
  return <Text style={styles.felText}>{text}</Text>;
}

const styles = StyleSheet.create({
  felText: { color: '#dc2626', fontSize: 13, marginTop: 6, fontWeight: '500' },
});
