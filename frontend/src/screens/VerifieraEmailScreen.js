import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

export default function VerifieraEmailScreen({ route, navigation }) {
  const { email } = route.params;
  const { sättAnvändare } = useAuth();
  const [kod, setKod] = useState('');
  const [verifierar, setVerifierar] = useState(false);
  const [skickar, setSkickar] = useState(false);
  const inputRef = useRef(null);

  async function hanteraVerifiering() {
    if (kod.length !== 6) {
      Alert.alert('Fel', 'Ange den 6-siffriga koden från mailet');
      return;
    }
    setVerifierar(true);
    try {
      const svar = await api.verifieraKod(email, kod);
      await AsyncStorage.setItem('token', svar.token);
      sättAnvändare(svar.användare);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setVerifierar(false);
    }
  }

  async function skickaIgen() {
    setSkickar(true);
    try {
      await api.skickaVerifieringsmail(email);
      Alert.alert('Klart', 'En ny kod har skickats till ' + email);
      setKod('');
    } catch {
      Alert.alert('Fel', 'Kunde inte skicka nytt mail. Försök igen.');
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
      <Text style={styles.text}>Vi har skickat en 6-siffrig kod till:</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.text}>Ange koden nedan för att aktivera ditt konto.</Text>

      <TextInput
        ref={inputRef}
        style={styles.kodInput}
        value={kod}
        onChangeText={(v) => setKod(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="000000"
        placeholderTextColor="#ccc"
        maxLength={6}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.knapp, kod.length !== 6 && styles.knappInaktiv]}
        onPress={hanteraVerifiering}
        disabled={verifierar || kod.length !== 6}
      >
        {verifierar
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.knappText}>Verifiera konto</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.resendKnapp} onPress={skickaIgen} disabled={skickar}>
        {skickar
          ? <ActivityIndicator color="#2563eb" size="small" />
          : <Text style={styles.resendText}>Skicka ny kod</Text>
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
  rubrik: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  text: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  email: { fontSize: 15, fontWeight: '700', color: '#2563eb', marginBottom: 8, textAlign: 'center' },
  kodInput: { fontSize: 36, fontWeight: '700', letterSpacing: 12, textAlign: 'center', borderWidth: 2, borderColor: '#2563eb', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24, marginTop: 20, marginBottom: 24, width: 220, color: '#1a1a1a' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginBottom: 12, width: '100%' },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  resendKnapp: { paddingVertical: 12, marginBottom: 16, minHeight: 40, alignItems: 'center' },
  resendText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  länk: { color: '#888', fontSize: 14, textDecorationLine: 'underline' },
});
