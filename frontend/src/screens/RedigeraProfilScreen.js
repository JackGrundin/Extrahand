import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { SVENSKA_ORTER } from '../utils/svenskaOrter';

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
  const [ortsForslag, setOrtsForslag] = useState([]);
  const [laddar, setLaddar] = useState(false);

  function hanteraStadInput(text) {
    setStad(text);
    if (text.length >= 2) {
      const träffar = SVENSKA_ORTER.filter(o =>
        o.toLowerCase().startsWith(text.toLowerCase())
      ).slice(0, 8);
      setOrtsForslag(träffar);
    } else {
      setOrtsForslag([]);
    }
  }

  function väljaOrt(ort) {
    setStad(ort);
    setOrtsForslag([]);
  }

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
            <Text style={styles.label}>Stad</Text>
            <Text style={styles.hjälptext}>
              Ange din stad för att få notiser om nya jobb nära dig.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Stockholm"
              value={stad}
              onChangeText={hanteraStadInput}
              autoCapitalize="words"
            />
            {ortsForslag.length > 0 && (
              <View style={styles.ortDropdown}>
                {ortsForslag.map(ort => (
                  <TouchableOpacity
                    key={ort}
                    style={styles.ortRad}
                    onPress={() => väljaOrt(ort)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={14} color="#6b7280" style={{ marginRight: 8 }} />
                    <Text style={styles.ortText}>{ort}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
  hjälptext: { fontSize: 12, color: '#6b7280', marginBottom: 8, marginTop: -2 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', letterSpacing: 0 },
  ortDropdown: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fff', marginTop: 4, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 3 },
  ortRad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  ortText: { fontSize: 15, color: '#1a1a1a' },
  textArea: { height: 110 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
