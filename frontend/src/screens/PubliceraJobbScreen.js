import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { TYPER, KATEGORIER } from '../utils/konstanter';
import { SVENSKA_ORTER } from '../utils/svenskaOrter';

function formatDatum(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr + 'T12:00:00');
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

export default function PubliceraJobbScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [lon, setLon] = useState('');
  const [typ, setTyp] = useState('gig');
  const [kategori, setKategori] = useState('');
  const [antalDagar, setAntalDagar] = useState('');
  const [dagScheman, setDagScheman] = useState([]);
  const [sammaTider, setSammaTider] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [ortsForslag, setOrtsForslag] = useState([]);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');
  const [dagPickerIndex, setDagPickerIndex] = useState(null);
  const [tempDatum, setTempDatum] = useState(new Date());

  function hanteraAntalDagar(val) {
    setAntalDagar(val);
    const n = parseInt(val) || 0;
    setDagScheman(prev =>
      Array.from({ length: n }, (_, i) => prev[i] || { datum: '', start: '', slut: '' })
    );
    if (n <= 1) setSammaTider(false);
  }

  function uppdateraDag(index, fält, värde) {
    setDagScheman(prev => {
      if (sammaTider && fält !== 'datum') {
        return prev.map(dag => ({ ...dag, [fält]: värde }));
      }
      const ny = [...prev];
      ny[index] = { ...ny[index], [fält]: värde };
      return ny;
    });
  }

  function öppnaPicker(index) {
    const dag = dagScheman[index];
    setTempDatum(dag.datum ? new Date(dag.datum + 'T12:00:00') : new Date());
    setDagPickerIndex(index);
  }

  function sparaDatum(index, date) {
    uppdateraDag(index, 'datum', date.toISOString().split('T')[0]);
  }

  function bekräftaDatum() {
    if (dagPickerIndex !== null) sparaDatum(dagPickerIndex, tempDatum);
    setDagPickerIndex(null);
  }

  function toggleSammaTider() {
    const nästa = !sammaTider;
    setSammaTider(nästa);
    if (nästa && dagScheman.length > 0) {
      const { start, slut } = dagScheman[0];
      setDagScheman(prev => prev.map(dag => ({ ...dag, start, slut })));
    }
  }

  function hanteraPlatsInput(text) {
    setPlats(text);
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
    setPlats(ort);
    setOrtsForslag([]);
  }

  const filtreradeKategorier = KATEGORIER.filter(k =>
    k.toLowerCase().includes(sokKategori.toLowerCase())
  );

  async function hanteraPublicering() {
    if (!titel.trim() || !beskrivning.trim()) {
      Alert.alert('Fel', 'Titel och beskrivning krävs');
      return;
    }
    if (!adress.trim()) {
      Alert.alert('Fel', 'Adress till arbetsplatsen krävs');
      return;
    }
    if (dagScheman.length === 0 || !dagScheman.some(d => d.datum)) {
      Alert.alert('Fel', 'Du måste ange datum för passet');
      return;
    }
    setLaddar(true);
    try {
      const arbetstider = dagScheman.length > 0
        ? JSON.stringify(dagScheman)
        : undefined;
      await api.publicera({
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        adress: adress.trim(),
        lon: lon ? parseInt(lon) : undefined,
        typ,
        kategori: kategori || undefined,
        antal_dagar: antalDagar ? parseInt(antalDagar) : undefined,
        arbetstider,
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
          <TextInput
            style={styles.input}
            placeholder="t.ex. Stockholm"
            value={plats}
            onChangeText={hanteraPlatsInput}
            autoCorrect={false}
          />
          <Text style={styles.label}>Adress till arbetsplatsen *</Text>
          <TextInput
            style={styles.input}
            placeholder="t.ex. Storgatan 12, Stockholm"
            value={adress}
            onChangeText={setAdress}
            autoCorrect={false}
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

          <Text style={styles.label}>Timlön (kr/tim)</Text>
          <TextInput style={styles.input} placeholder="t.ex. 160" value={lon} onChangeText={setLon} keyboardType="numeric" />
          {lon ? (() => {
            const timlön = parseFloat(lon) || 0;
            const faktureringspris = (timlön * 1.32 * 1.06 * 1.40).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return timlön > 0 ? (
              <View style={styles.prisKalkyl}>
                <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{timlön} kr/h</Text></Text>
                <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{faktureringspris} kr/h</Text> (exkl. moms)</Text>
              </View>
            ) : null;
          })() : null}

          <Text style={styles.label}>Antal dagar</Text>
          <TextInput style={styles.input} placeholder="t.ex. 5" value={antalDagar} onChangeText={hanteraAntalDagar} keyboardType="numeric" />

          {dagScheman.length > 0 && (
            <View style={styles.dagSektion}>
              {dagScheman.length > 1 && (
                <TouchableOpacity style={styles.kryssRad} onPress={toggleSammaTider} activeOpacity={0.7}>
                  <View style={[styles.kryssRuta, sammaTider && styles.kryssRutaAktiv]}>
                    {sammaTider && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.kryssText}>Samma tider varje dag</Text>
                </TouchableOpacity>
              )}
              {dagScheman.map((dag, i) => (
                <View key={i} style={styles.dagRad}>
                  <Text style={styles.dagEtikett}>Dag {i + 1}</Text>
                  <View style={styles.dagFält}>
                    <TouchableOpacity
                      style={[styles.input, styles.datumKnapp]}
                      onPress={() => öppnaPicker(i)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar-outline" size={16} color={dag.datum ? '#1a1a1a' : '#aaa'} />
                      <Text style={[styles.datumText, !dag.datum && styles.datumPlaceholder]}>
                        {dag.datum ? formatDatum(dag.datum) : 'Datum'}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.tidInput]}
                      placeholder="08:00"
                      value={dag.start}
                      onChangeText={v => uppdateraDag(i, 'start', v)}
                    />
                    <Text style={styles.tidStreck}>–</Text>
                    <TextInput
                      style={[styles.input, styles.tidInput]}
                      placeholder="17:00"
                      value={dag.slut}
                      onChangeText={v => uppdateraDag(i, 'slut', v)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

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

      {/* Datumväljare – Android (native dialog) */}
      {Platform.OS === 'android' && dagPickerIndex !== null && (
        <DateTimePicker
          value={tempDatum}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, date) => {
            setDagPickerIndex(null);
            if (date) sparaDatum(dagPickerIndex, date);
          }}
        />
      )}

      {/* Datumväljare – iOS (modal med spinner) */}
      <Modal visible={Platform.OS === 'ios' && dagPickerIndex !== null} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerPanel}>
            <View style={styles.pickerRubrikRad}>
              <TouchableOpacity onPress={() => setDagPickerIndex(null)}>
                <Text style={styles.pickerAvbryt}>Avbryt</Text>
              </TouchableOpacity>
              <Text style={styles.pickerRubrik}>Välj datum</Text>
              <TouchableOpacity onPress={bekräftaDatum}>
                <Text style={styles.pickerKlar}>Klar</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDatum}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_, date) => date && setTempDatum(date)}
              locale="sv-SE"
            />
          </View>
        </View>
      </Modal>

      {/* Kategoriväljare */}
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
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', letterSpacing: 0 },
  textArea: { height: 120 },

  väljarKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  väljarText: { fontSize: 15, color: '#1a1a1a' },
  väljarPlaceholder: { color: '#aaa' },

  typVäljare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },

  ortDropdown: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fff', marginTop: -8, marginBottom: 4, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 3 },
  ortRad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  ortText: { fontSize: 15, color: '#1a1a1a' },
  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  dagSektion: { marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, backgroundColor: '#fafafa' },
  kryssRad: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  kryssRuta: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  kryssRutaAktiv: { backgroundColor: '#2563eb' },
  kryssText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dagRad: { marginBottom: 12 },
  dagEtikett: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  dagFält: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumKnapp: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumText: { fontSize: 15, color: '#1a1a1a' },
  datumPlaceholder: { color: '#aaa' },
  tidInput: { flex: 1, textAlign: 'center' },
  tidStreck: { fontSize: 16, color: '#9ca3af' },

  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerRubrikRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  pickerAvbryt: { fontSize: 16, color: '#9ca3af' },
  pickerKlar: { fontSize: 16, color: '#2563eb', fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '80%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  panelTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },
});
