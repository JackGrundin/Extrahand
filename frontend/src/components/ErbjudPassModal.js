import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import TidVäljare from './TidVäljare';

function formatDatum(date) {
  if (!date) return null;
  return date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

const FAKTURAFAKTOR = 1.32 * 1.06 * 1.40;

export default function ErbjudPassModal({ visible, onClose, onSkicka, skickar }) {
  const [datum, setDatum] = useState(null);
  const [datumPickerVisas, setDatumPickerVisas] = useState(false);
  const [tempDatum, setTempDatum] = useState(new Date());
  const [starttid, setStarttid] = useState('');
  const [sluttid, setSluttid] = useState('');
  const [timlon, setTimlon] = useState('');
  const [obTillagg, setObTillagg] = useState([]);
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');

  // Nollställ formuläret varje gång modalen stängs
  useEffect(() => {
    if (!visible) {
      setDatum(null);
      setStarttid('');
      setSluttid('');
      setTimlon('');
      setObTillagg([]);
      setObFormVisas(false);
      setObStart(''); setObSlut(''); setObVärde(''); setObTyp('procent');
    }
  }, [visible]);

  function stäng() {
    onClose();
  }

  function öppnaDatum() {
    setTempDatum(datum ? new Date(datum + 'T12:00:00') : new Date());
    setDatumPickerVisas(true);
  }

  function bekräftaDatum() {
    setDatum(tempDatum.toISOString().split('T')[0]);
    setDatumPickerVisas(false);
  }

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
    setObStart(''); setObSlut(''); setObVärde('');
    setObFormVisas(false);
  }

  function skicka() {
    if (!datum) { Alert.alert('Fel', 'Välj ett datum'); return; }
    if (!starttid || !sluttid) { Alert.alert('Fel', 'Ange start- och sluttid'); return; }
    const lön = parseFloat(timlon);
    if (!lön || lön <= 0) { Alert.alert('Fel', 'Ange en giltig timlön'); return; }
    onSkicka({
      datum,
      starttid,
      sluttid,
      timlon: lön,
      ob_tillagg: obTillagg,
    });
  }

  const lön = parseFloat(timlon) || 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={stäng} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.bakgrund} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.handtag} />
            <Text style={styles.rubrik}>Erbjud pass</Text>

            <Text style={styles.label}>Datum</Text>
            <TouchableOpacity style={styles.datumKnapp} onPress={öppnaDatum} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={datum ? '#1a1a1a' : '#aaa'} />
              <Text style={[styles.datumText, !datum && styles.placeholder]}>
                {datum ? formatDatum(new Date(datum + 'T12:00:00')) : 'Välj datum'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Arbetstid</Text>
            <View style={styles.tidRad}>
              <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={starttid} onChange={setStarttid} />
              <Text style={styles.streck}>–</Text>
              <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={sluttid} onChange={setSluttid} />
            </View>

            <Text style={styles.label}>Timlön (kr/tim)</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. 160"
              value={timlon}
              onChangeText={setTimlon}
              keyboardType="numeric"
            />

            <Text style={styles.label}>OB-tillägg (obekväm arbetstid)</Text>
            {obTillagg.map((ob, i) => (
              <View key={i} style={styles.obRad}>
                <Text style={styles.obRadText}>
                  {ob.start}–{ob.slut}: {ob.värde}{ob.typ === 'procent' ? '%' : ' kr/h'}
                </Text>
                <TouchableOpacity onPress={() => setObTillagg(prev => prev.filter((_, j) => j !== i))}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {obFormVisas ? (
              <View style={styles.obForm}>
                <View style={styles.tidRad}>
                  <TidVäljare style={{ flex: 1 }} placeholder="18:00" value={obStart} onChange={setObStart} />
                  <Text style={styles.streck}>–</Text>
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
                <View style={styles.obFormKnappar}>
                  <TouchableOpacity style={styles.obAvbryt} onPress={() => { setObFormVisas(false); setObStart(''); setObSlut(''); setObVärde(''); }}>
                    <Text style={styles.obAvbrytText}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.obLäggTillKnapp} onPress={läggTillOb}>
                    <Text style={styles.obLäggTillText}>Lägg till</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.obAddKnapp} onPress={() => setObFormVisas(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color="#ea580c" />
                <Text style={styles.obAddText}>Lägg till OB-intervall</Text>
              </TouchableOpacity>
            )}

            {lön > 0 && (
              <View style={styles.prisKalkyl}>
                <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{lön} kr/h</Text></Text>
                <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{(lön * FAKTURAFAKTOR).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h</Text> (exkl. moms)</Text>
              </View>
            )}

            <View style={styles.knappRad}>
              <TouchableOpacity style={styles.avbrytKnapp} onPress={stäng} disabled={skickar}>
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.skickaKnapp, skickar && { opacity: 0.5 }]} onPress={skicka} disabled={skickar}>
                {skickar ? <ActivityIndicator color="#fff" /> : <Text style={styles.skickaText}>Skicka förfrågan</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Datumväljare – Android */}
      {Platform.OS === 'android' && datumPickerVisas && (
        <DateTimePicker
          value={tempDatum}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, date) => {
            setDatumPickerVisas(false);
            if (date) setDatum(date.toISOString().split('T')[0]);
          }}
        />
      )}

      {/* Datumväljare – iOS (spinner) */}
      <Modal visible={Platform.OS === 'ios' && datumPickerVisas} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerPanel}>
            <View style={styles.pickerRubrikRad}>
              <TouchableOpacity onPress={() => setDatumPickerVisas(false)}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  bakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  rubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', letterSpacing: 0 },
  datumKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  datumText: { fontSize: 15, color: '#1a1a1a' },
  placeholder: { color: '#aaa' },
  tidRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streck: { fontSize: 16, color: '#9ca3af' },
  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 16, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },
  typVäljare: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },
  obRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obRadText: { fontSize: 14, color: '#9a3412', flex: 1 },
  obForm: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obFormKnappar: { flexDirection: 'row', gap: 10, marginTop: 8 },
  obAvbryt: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, alignItems: 'center' },
  obAvbrytText: { fontSize: 14, color: '#666', fontWeight: '600' },
  obLäggTillKnapp: { flex: 1, backgroundColor: '#ea580c', borderRadius: 10, padding: 12, alignItems: 'center' },
  obLäggTillText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  obAddKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  obAddText: { fontSize: 14, color: '#ea580c', fontWeight: '600' },
  knappRad: { flexDirection: 'row', gap: 12, marginTop: 20 },
  avbrytKnapp: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, alignItems: 'center' },
  avbrytText: { fontSize: 15, color: '#666', fontWeight: '600' },
  skickaKnapp: { flex: 2, backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  skickaText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerRubrikRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  pickerAvbryt: { fontSize: 16, color: '#9ca3af' },
  pickerKlar: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
});
