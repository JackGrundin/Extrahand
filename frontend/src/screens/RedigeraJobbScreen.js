import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api/klient';

const TYPER = ['gig', 'sommarjobb'];
const KATEGORIER = ['Café', 'Restaurang', 'Butik', 'Lager', 'Kontor', 'IT', 'Snickare', 'Städ', 'Övrigt'];

export default function RedigeraJobbScreen({ route, navigation }) {
  const { jobb } = route.params;

  const [titel, setTitel] = useState(jobb.Titel ?? '');
  const [beskrivning, setBeskrivning] = useState(jobb.Beskrivning ?? '');
  const [plats, setPlats] = useState(jobb.Plats ?? '');
  const [lon, setLon] = useState(jobb.Lon ? String(jobb.Lon) : '');
  const [typ, setTyp] = useState(jobb.Typ ?? 'gig');
  const [kategori, setKategori] = useState(jobb.Kategori ?? '');
  const [antalDagar, setAntalDagar] = useState(jobb.antal_dagar ? String(jobb.antal_dagar) : '');
  const [arbetstider, setArbetstider] = useState(jobb.arbetstider ?? '');
  const [laddar, setLaddar] = useState(false);

  async function hanteraSpara() {
    if (!titel.trim() || !beskrivning.trim()) {
      Alert.alert('Fel', 'Titel och beskrivning krävs');
      return;
    }
    setLaddar(true);
    try {
      await api.uppdateraJobb(jobb.id, {
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        lon: lon ? parseInt(lon) : undefined,
        typ,
        kategori: kategori || undefined,
        antal_dagar: antalDagar ? parseInt(antalDagar) : undefined,
        arbetstider: arbetstider.trim() || undefined,
      });
      Alert.alert('Sparat!', 'Annonsen har uppdaterats.', [
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
        <TextInput style={styles.input} value={titel} onChangeText={setTitel} />

        <Text style={styles.label}>Beskrivning *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={beskrivning}
          onChangeText={setBeskrivning}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Plats</Text>
        <TextInput style={styles.input} value={plats} onChangeText={setPlats} />

        <Text style={styles.label}>Timlön (kr/tim)</Text>
        <TextInput style={styles.input} value={lon} onChangeText={setLon} keyboardType="numeric" />

        <Text style={styles.label}>Antal dagar</Text>
        <TextInput style={styles.input} value={antalDagar} onChangeText={setAntalDagar} keyboardType="numeric" />

        <Text style={styles.label}>Arbetstider</Text>
        <TextInput style={styles.input} placeholder="t.ex. 08:00-17:00" value={arbetstider} onChangeText={setArbetstider} />

        <Text style={styles.label}>Typ *</Text>
        <View style={styles.typVäljare}>
          {TYPER.map((t) => (
            <TouchableOpacity key={t} style={[styles.typKnapp, typ === t && styles.typKnappAktiv]} onPress={() => setTyp(t)}>
              <Text style={[styles.typText, typ === t && styles.typTextAktiv]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Kategori</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kategoriRad}>
          {KATEGORIER.map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.kategoriKnapp, kategori === k && styles.kategoriKnappAktiv]}
              onPress={() => setKategori(kategori === k ? '' : k)}
            >
              <Text style={[styles.kategoriText, kategori === k && styles.kategoriTextAktiv]}>{k}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={[styles.knapp, laddar && styles.knappInaktiv]} onPress={hanteraSpara} disabled={laddar}>
          {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Spara ändringar</Text>}
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
  kategoriRad: { gap: 8, paddingBottom: 4 },
  kategoriKnapp: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  kategoriKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  kategoriText: { fontSize: 13, color: '#555', fontWeight: '500' },
  kategoriTextAktiv: { color: '#fff' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
