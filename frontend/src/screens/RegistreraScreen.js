import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegistreraScreen({ navigation }) {
  const { registrera } = useAuth();
  const [namn, setNamn] = useState('');
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [typ, setTyp] = useState('privatperson');
  const [laddar, setLaddar] = useState(false);

  async function hanteraRegistrering() {
    if (!namn || !email || !lösenord) {
      Alert.alert('Fel', 'Fyll i alla fält');
      return;
    }
    setLaddar(true);
    try {
      await registrera(namn, email, lösenord, typ);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.rubrik}>Skapa konto</Text>

      <TextInput style={styles.input} placeholder="Namn" value={namn} onChangeText={setNamn} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Lösenord"
        value={lösenord}
        onChangeText={setLösenord}
        secureTextEntry
      />

      <Text style={styles.label}>Kontotyp</Text>
      <View style={styles.typVäljare}>
        {['privatperson', 'företag'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typKnapp, typ === t && styles.typKnappAktiv]}
            onPress={() => setTyp(t)}
          >
            <Text style={[styles.typText, typ === t && styles.typTextAktiv]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.knapp} onPress={hanteraRegistrering} disabled={laddar}>
        {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Skapa konto</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.länk}>Har du redan ett konto? Logga in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  rubrik: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 28, color: '#1a1a1a' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  label: { fontSize: 15, color: '#444', marginBottom: 8 },
  typVäljare: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#444', fontWeight: '500' },
  typTextAktiv: { color: '#fff' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  länk: { textAlign: 'center', color: '#2563eb', fontSize: 15 },
});
