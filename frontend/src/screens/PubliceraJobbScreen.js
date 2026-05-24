import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';

const TYPER = ['gig', 'sommarjobb'];
const KATEGORIER = [
  'Servitör', 'Kock', 'Diskare', 'Barista', 'Butiksbiträde', 'Kassör',
  'Lagerarbetare', 'Paketerare', 'Städare', 'Receptionist', 'Kontorsassistent',
  'IT-tekniker', 'Snickare', 'Hantlangare', 'Trädgårdsarbetare', 'Barnvakt',
  'Väktare', 'Chaufför', 'Eventpersonal', 'Handyman', 'Säljare', 'Vakt',
];

export default function PubliceraJobbScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [lon, setLon] = useState('');
  const [typ, setTyp] = useState('gig');
  const [kategori, setKategori] = useState('');
  const [antalDagar, setAntalDagar] = useState('');
  const [arbetstider, setArbetstider] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');

  const filtreradeKategorier = KATEGORIER.filter(k =>
    k.toLowerCase().includes(sokKategori.toLowerCase())
  );

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
        kategori: kategori || undefined,
        antal_dagar: antalDagar ? parseInt(antalDagar) : undefined,
        arbetstider: arbetstider.trim() || undefined,
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
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Jobbtitel *</Text>
          <TextInput
            style={styles.input}
            placeholder="t.ex. Sommarjobbare på café"
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
          <TextInput style={styles.input} placeholder="t.ex. Stockholm" value={plats} onChangeText={setPlats} />

          <Text style={styles.label}>Timlön (kr/tim)</Text>
          <TextInput style={styles.input} placeholder="t.ex. 160" value={lon} onChangeText={setLon} keyboardType="numeric" />
          {lon ? (() => {
            const timlön = parseFloat(lon) || 0;
            const faktureringspris = Math.round(timlön * 1.32 * 1.06 * 1.40);
            return timlön > 0 ? (
              <View style={styles.prisKalkyl}>
                <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{Math.round(timlön)} kr/h</Text></Text>
                <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{faktureringspris} kr/h</Text> (ex moms)</Text>
              </View>
            ) : null;
          })() : null}

          <Text style={styles.label}>Antal dagar</Text>
          <TextInput style={styles.input} placeholder="t.ex. 5" value={antalDagar} onChangeText={setAntalDagar} keyboardType="numeric" />

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
          <TouchableOpacity style={styles.väljarKnapp} onPress={() => setKategoriModalVisas(true)} activeOpacity={0.7}>
            <Text style={[styles.väljarText, !kategori && styles.väljarPlaceholder]}>
              {kategori || 'Välj kategori...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.knapp, laddar && styles.knappInaktiv]} onPress={hanteraPublicering} disabled={laddar}>
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Publicera jobb</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={kategoriModalVisas} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => { setKategoriModalVisas(false); setSokKategori(''); }}
          />
          <View style={styles.panel}>
            <View style={styles.handtag} />
            <Text style={styles.panelTitel}>Välj kategori</Text>
            <TextInput
              style={styles.sokInput}
              placeholder="Sök kategori..."
              value={sokKategori}
              onChangeText={setSokKategori}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filtreradeKategorier.length === 0 ? (
                <Text style={styles.ingaResultat}>Inga kategorier hittades</Text>
              ) : (
                filtreradeKategorier.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={styles.kategoriRad}
                    activeOpacity={0.7}
                    onPress={() => { setKategori(k); setKategoriModalVisas(false); setSokKategori(''); }}
                  >
                    <Text style={styles.kategoriRadText}>{k}</Text>
                    {kategori === k && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 120 },

  väljarKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  väljarText: { fontSize: 15, color: '#1a1a1a' },
  väljarPlaceholder: { color: '#aaa' },

  typVäljare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },

  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '80%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  panelTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },
});
