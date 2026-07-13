import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { TYPER, KATEGORIER, beräknaFakturapris, formateraPris } from '../utils/konstanter';
import { useJobbPåslag } from '../utils/useJobbPåslag';
import { parsaObTillagg } from '../utils/datumHelper';
import TidVäljare from '../components/TidVäljare';

function parsaArbetstiderTider(arbetstider) {
  if (!arbetstider) return { start: '', slut: '' };
  try {
    const arr = Array.isArray(arbetstider) ? arbetstider : JSON.parse(arbetstider);
    if (Array.isArray(arr) && arr[0]?.start) return { start: arr[0].start || '', slut: arr[0].slut || '' };
  } catch {}
  const match = String(arbetstider).match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (match) return { start: match[1], slut: match[2] };
  return { start: '', slut: '' };
}

export default function RedigeraJobbScreen({ route, navigation }) {
  const { jobb } = route.params;
  const påslag = useJobbPåslag(jobb.paslag, true);

  const [titel, setTitel] = useState(jobb.Titel ?? '');
  const [beskrivning, setBeskrivning] = useState(jobb.Beskrivning ?? '');
  const [plats, setPlats] = useState(jobb.Plats ?? '');
  const [adress, setAdress] = useState(jobb.adress ?? '');
  const [lon, setLon] = useState(jobb.Lon ? String(jobb.Lon) : '');
  const [typ, setTyp] = useState(jobb.Typ ?? 'gig');
  const [kategori, setKategori] = useState(jobb.Kategori ?? '');
  const [antalDagar, setAntalDagar] = useState(jobb.antal_dagar ? String(jobb.antal_dagar) : '');
  const [arbetstiderStart, setArbetstiderStart] = useState(() => parsaArbetstiderTider(jobb.arbetstider).start);
  const [arbetstiderSlut, setArbetstiderSlut] = useState(() => parsaArbetstiderTider(jobb.arbetstider).slut);
  const [laddar, setLaddar] = useState(false);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');
  const [obTillagg, setObTillagg] = useState(() => parsaObTillagg(jobb.ob_tillagg));
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');

  function läggTillOb() {
    if (!obStart.trim() || !obSlut.trim() || !obVärde.trim()) {
      Alert.alert('Fel', 'Fyll i alla OB-fält');
      return;
    }
    const värde = parseFloat(obVärde);
    if (!värde || värde <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt OB-värde');
      return;
    }
    setObTillagg(prev => [...prev, { start: obStart.trim(), slut: obSlut.trim(), typ: obTyp, värde }]);
    setObStart('');
    setObSlut('');
    setObVärde('');
    setObFormVisas(false);
  }

  const filtreradeKategorier = KATEGORIER.filter(k =>
    k.toLowerCase().includes(sokKategori.toLowerCase())
  );

  async function hanteraSpara() {
    if (!titel.trim() || !beskrivning.trim()) {
      Alert.alert('Fel', 'Titel och beskrivning krävs');
      return;
    }
    if (!adress.trim()) {
      Alert.alert('Fel', 'Adress till arbetsplatsen krävs');
      return;
    }
    setLaddar(true);
    try {
      await api.uppdateraJobb(jobb.id, {
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        plats: plats.trim() || undefined,
        adress: adress.trim(),
        lon: lon ? parseInt(lon) : undefined,
        typ,
        kategori: kategori || undefined,
        antal_dagar: antalDagar ? parseInt(antalDagar) : undefined,
        arbetstider: arbetstiderStart && arbetstiderSlut ? `${arbetstiderStart}-${arbetstiderSlut}` : undefined,
        ob_tillagg: obTillagg,
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
    <>
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

          <Text style={styles.label}>Adress till arbetsplatsen *</Text>
          <TextInput
            style={styles.input}
            placeholder="t.ex. Storgatan 12, Stockholm"
            value={adress}
            onChangeText={setAdress}
            autoCorrect={false}
          />

          <Text style={styles.label}>Timlön (kr/tim)</Text>
          <TextInput style={styles.input} value={lon} onChangeText={setLon} keyboardType="numeric" />

          <Text style={styles.label}>Antal dagar</Text>
          <TextInput style={styles.input} value={antalDagar} onChangeText={setAntalDagar} keyboardType="numeric" />

          <Text style={styles.label}>Arbetstider</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={arbetstiderStart} onChange={setArbetstiderStart} />
            <Text style={{ fontSize: 16, color: '#9ca3af' }}>–</Text>
            <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={arbetstiderSlut} onChange={setArbetstiderSlut} />
          </View>

          <Text style={styles.label}>OB-tillägg (obekväm arbetstid)</Text>
          {obTillagg.map((ob, i) => (
            <View key={i} style={styles.obRad}>
              <Text style={styles.obRadText}>
                {ob.start}–{ob.slut}: {ob.värde}{ob.typ === 'procent' ? '%' : ' kr/h'}
                {lon ? (() => {
                  const [sh = 0, sm = 0] = ob.start.split(':').map(Number);
                  const [eh = 0, em = 0] = ob.slut.split(':').map(Number);
                  const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                  const timlön = parseFloat(lon) || 0;
                  const brutto = ob.typ === 'procent' ? h * timlön * (ob.värde / 100) : h * ob.värde;
                  const kostnad = beräknaFakturapris(brutto, påslag);
                  return kostnad > 0 ? ` = +${formateraPris(kostnad)} kr (er kostnad)` : '';
                })() : ''}
              </Text>
              <TouchableOpacity onPress={() => setObTillagg(prev => prev.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {obFormVisas ? (
            <View style={styles.obForm}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TidVäljare style={{ flex: 1 }} placeholder="18:00" value={obStart} onChange={setObStart} />
                <Text style={{ color: '#9ca3af', fontSize: 16 }}>–</Text>
                <TidVäljare style={{ flex: 1 }} placeholder="20:00" value={obSlut} onChange={setObSlut} />
              </View>
              <View style={styles.typVäljare}>
                {['procent', 'fast'].map(t => (
                  <TouchableOpacity key={t} style={[styles.typKnapp, obTyp === t && styles.typKnappAktiv]} onPress={() => setObTyp(t)}>
                    <Text style={[styles.typText, obTyp === t && styles.typTextAktiv]}>
                      {t === 'procent' ? 'Procent (%)' : 'Fast kr/h'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder={obTyp === 'procent' ? 'OB-procent (t.ex. 50)' : 'Extra kr/h (t.ex. 25)'}
                value={obVärde}
                onChangeText={setObVärde}
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={styles.obAvbryt} onPress={() => { setObFormVisas(false); setObStart(''); setObSlut(''); setObVärde(''); }}>
                  <Text style={{ fontSize: 14, color: '#666', fontWeight: '600' }}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.obLäggTillKnapp} onPress={läggTillOb}>
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>Lägg till</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.obAddKnapp} onPress={() => setObFormVisas(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color="#ea580c" />
              <Text style={styles.obAddText}>Lägg till OB-intervall</Text>
            </TouchableOpacity>
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

          <TouchableOpacity style={[styles.knapp, laddar && styles.knappInaktiv]} onPress={hanteraSpara} disabled={laddar}>
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Spara ändringar</Text>}
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
  obRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obRadText: { fontSize: 14, color: '#9a3412', flex: 1 },
  obForm: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obAvbryt: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, alignItems: 'center' },
  obLäggTillKnapp: { flex: 1, backgroundColor: '#ea580c', borderRadius: 10, padding: 12, alignItems: 'center' },
  obAddKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4 },
  obAddText: { fontSize: 14, color: '#ea580c', fontWeight: '600' },
});
