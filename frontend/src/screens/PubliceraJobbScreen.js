import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api/klient';

const TYPER = ['heltid', 'deltid', 'uppdrag'];

export default function PubliceraJobbScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [lon, setLon] = useState('');
  const [typ, setTyp] = useState('heltid');
  const [laddar, setLaddar] = useState(false);

  async function hanteraPublicering() {
    if (!titel.trim() || !beskrivning.trim()) {
      Alert.alert('Fel', 'Titel och beskrivning krävs');
      return;
    }

    setLaddar(true);
    try {
      await api.publicera({
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        lon: lon ? parseInt(lon) : undefined,
        typ,
      });

      Alert.alert('Klart!', 'Jobbet har publicerats.', [
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
        <Text style={styles.label}>Jobbtitel *</Text>
        <TextInput
          style={styles.input}
          placeholder="t.ex. Webbutvecklare"
          value={titel}
          onChangeText={setTitel}
        />

        <Text style={styles.label}>Beskrivning *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Beskriv tjänsten, krav och arbetsuppgifter..."
          value={beskrivning}
          onChangeText={setBeskrivning}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Plats</Text>
        <TextInput
          style={styles.input}
          placeholder="t.ex. Stockholm"
          value={plats}
          onChangeText={setPlats}
        />

        <Text style={styles.label}>Lön (kr/mån)</Text>
        <TextInput
          style={styles.input}
          placeholder="t.ex. 45000"
          value={lon}
          onChangeText={setLon}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Typ av tjänst *</Text>
        <View style={styles.typVäljare}>
          {TYPER.map((t) => (
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

        <TouchableOpacity
          style={[styles.knapp, laddar && styles.knappInaktiv]}
          onPress={hanteraPublicering}
          disabled={laddar}
        >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.knappText}>Publicera jobb</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 120 },
  typVäljare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
