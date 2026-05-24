import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api/klient';

export default function RedigeraProfilScreen({ route, navigation }) {
  const profil = route.params?.profil ?? {};
  const ärFöretag = profil.typ === 'företag';

  const [cv, setCv] = useState(profil.cv ?? '');
  const [erfarenheter, setErfarenheter] = useState(profil.erfarenheter ?? '');
  const [kompetenser, setKompetenser] = useState(profil.kompetenser ?? '');
  const [intressen, setIntressen] = useState(profil.intressen ?? '');
  const [beskrivning, setBeskrivning] = useState(profil.beskrivning ?? '');
  const [bransch, setBransch] = useState(profil.bransch ?? '');
  const [stad, setStad] = useState(profil.stad ?? '');
  const [hemsida, setHemsida] = useState(profil.hemsida ?? '');
  const [laddar, setLaddar] = useState(false);

  async function spara() {
    setLaddar(true);
    try {
      await api.uppdateraProfil({
        cv: cv.trim() || null,
        erfarenheter: erfarenheter.trim() || null,
        kompetenser: kompetenser.trim() || null,
        intressen: intressen.trim() || null,
        beskrivning: beskrivning.trim() || null,
        bransch: bransch.trim() || null,
        stad: stad.trim() || null,
        hemsida: hemsida.trim() || null,
      });
      Alert.alert('Sparat!', 'Din profil har uppdaterats.', [
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

        {ärFöretag ? (
          <>
            <Text style={styles.label}>Beskrivning</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Berätta om företaget..."
              value={beskrivning}
              onChangeText={setBeskrivning}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.label}>Bransch</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Restaurang, Bygg, Städ"
              value={bransch}
              onChangeText={setBransch}
            />
            <Text style={styles.label}>Stad</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Stockholm"
              value={stad}
              onChangeText={setStad}
            />
            <Text style={styles.label}>Hemsida</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. www.foretaget.se"
              value={hemsida}
              onChangeText={setHemsida}
              autoCapitalize="none"
              keyboardType="url"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>CV / Om mig</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Berätta om dig själv..."
              value={cv}
              onChangeText={setCv}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.label}>Tidigare erfarenheter</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="t.ex. Jobbade som städare 2023..."
              value={erfarenheter}
              onChangeText={setErfarenheter}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.label}>Kompetenser</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Körkort, Snickeri, Matlagning"
              value={kompetenser}
              onChangeText={setKompetenser}
            />
            <Text style={styles.label}>Intressen</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Friluftsliv, Musik, Djur"
              value={intressen}
              onChangeText={setIntressen}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.knapp, laddar && styles.knappInaktiv]}
          onPress={spara}
          disabled={laddar}
        >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.knappText}>Spara profil</Text>
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
  textArea: { height: 110 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
