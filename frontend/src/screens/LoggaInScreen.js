import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoggaInScreen({ navigation }) {
  const { loggaIn } = useAuth();
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [laddar, setLaddar] = useState(false);

  async function hanteraInloggning() {
    if (!email || !lösenord) {
      Alert.alert('Fel', 'Fyll i email och lösenord');
      return;
    }
    setLaddar(true);
    try {
      await loggaIn(email, lösenord);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.rubrik}>FastGig</Text>
      <Text style={styles.underrubrik}>Logga in</Text>

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

      <TouchableOpacity style={styles.knapp} onPress={hanteraInloggning} disabled={laddar}>
        {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Logga in</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Registrera')}>
        <Text style={styles.länk}>Inget konto? Registrera dig</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  rubrik: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#2563eb' },
  underrubrik: { fontSize: 18, textAlign: 'center', marginBottom: 32, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  länk: { textAlign: 'center', color: '#2563eb', fontSize: 15 },
});
