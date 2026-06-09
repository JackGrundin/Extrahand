import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../api/klient';

export default function VerifieraEmailScreen({ route, navigation }) {
  const { email } = route.params;
  const [skickar, setSkickar] = useState(false);

  async function skickaIgen() {
    setSkickar(true);
    try {
      await api.skickaVerifieringsmail(email);
      Alert.alert('Klart', 'Ett nytt verifieringsmail har skickats till ' + email);
    } catch {
      Alert.alert('Fel', 'Kunde inte skicka verifieringsmail. Försök igen.');
    } finally {
      setSkickar(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.ikon}>
        <Text style={styles.ikonText}>📧</Text>
      </View>

      <Text style={styles.rubrik}>Verifiera din e-post</Text>
      <Text style={styles.text}>
        Vi har skickat ett verifieringsmail till:
      </Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.text}>
        Klicka på länken i mailet för att aktivera ditt konto. Kolla även skräppost-mappen om du inte hittar det.
      </Text>

      <TouchableOpacity style={styles.resendKnapp} onPress={skickaIgen} disabled={skickar}>
        {skickar
          ? <ActivityIndicator color="#2563eb" />
          : <Text style={styles.resendText}>Skicka nytt verifieringsmail</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('LoggaIn')}>
        <Text style={styles.länk}>Gå till inloggning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff', alignItems: 'center' },
  ikon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ikonText: { fontSize: 36 },
  rubrik: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16, textAlign: 'center' },
  text: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  email: { fontSize: 15, fontWeight: '700', color: '#2563eb', marginBottom: 12, textAlign: 'center' },
  resendKnapp: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, marginTop: 24, marginBottom: 16, minWidth: 200, alignItems: 'center' },
  resendText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  länk: { color: '#888', fontSize: 14, textDecorationLine: 'underline' },
});
