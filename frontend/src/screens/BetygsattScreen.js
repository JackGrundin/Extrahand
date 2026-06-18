import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useAuth } from '../context/AuthContext';

export default function BetygsattScreen({ route, navigation }) {
  const { ansokningId } = route.params;
  const { användare } = useAuth();
  // Företag betygsätter en person, privatperson betygsätter ett uppdrag
  const ärFöretag = användare?.typ === 'företag';
  const [stjarnor, setStjarnor] = useState(0);
  const [kommentar, setKommentar] = useState('');
  const [laddar, setLaddar] = useState(false);

  async function skickaBetyg() {
    if (stjarnor === 0) {
      Alert.alert('Välj betyg', 'Du måste välja minst en stjärna.');
      return;
    }
    setLaddar(true);
    try {
      await api.sättaBetyg(ansokningId, { stjarnor, kommentar: kommentar.trim() || undefined });
      Alert.alert('Tack!', 'Ditt betyg har sparats.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.rubrik}>{ärFöretag ? 'Betygsätt personen' : 'Betygsätt uppdraget'}</Text>
        <Text style={styles.beskrivning}>Hur upplevde du samarbetet?</Text>

        <View style={styles.stjärnRad}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setStjarnor(n)} style={styles.stjärna}>
              <Ionicons
                name={n <= stjarnor ? 'star' : 'star-outline'}
                size={44}
                color={n <= stjarnor ? '#f59e0b' : '#d1d5db'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {stjarnor > 0 && (
          <Text style={styles.betygText}>{['', 'Dåligt', 'Okej', 'Bra', 'Mycket bra', 'Utmärkt'][stjarnor]}</Text>
        )}

        <Text style={styles.label}>Kommentar (valfritt)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Berätta mer om din upplevelse..."
          value={kommentar}
          onChangeText={setKommentar}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.knapp, (stjarnor === 0 || laddar) && styles.knappInaktiv]}
          onPress={skickaBetyg}
          disabled={stjarnor === 0 || laddar}
        >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.knappText}>Skicka betyg</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  rubrik: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8, marginTop: 8 },
  beskrivning: { fontSize: 15, color: '#666', marginBottom: 32 },
  stjärnRad: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  stjärna: { padding: 4 },
  betygText: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#f59e0b', marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, height: 110, backgroundColor: '#fafafa', marginBottom: 28 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
