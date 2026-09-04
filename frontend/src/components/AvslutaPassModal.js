import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parsaObTillagg, beräknaObBelopp } from '../utils/datumHelper';
import { beräknaFakturapris, påslagEller40, formateraPris } from '../utils/konstanter';
import TidVäljare from './TidVäljare';

// Formulär för att skicka en tidrapport (avsluta pass eller skicka en korrigerad rapport).
// Samma formulär och design används både från "Avsluta pass" och från chatten, så att en
// korrigerad tidrapport ser ut och fungerar exakt som en vanlig tidrapport.
// paslag är jobbets frysta påslag – utelämnat blir det 40 % (pass från före prenumerationerna).
export default function AvslutaPassModal({ visible, onClose, timlön = 0, paslag, initialObTillagg = [], sparar = false, onSkicka, rubrik = 'Avsluta pass', planeradeTimmar = null }) {
  const [timmarText, setTimmarText] = useState('');
  const [editerbartOb, setEditerbartOb] = useState([]);
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');

  // Återställ formuläret varje gång rutan öppnas och förfyll OB-tilläggen.
  useEffect(() => {
    if (visible) {
      setTimmarText('');
      setEditerbartOb(parsaObTillagg(initialObTillagg));
      setObFormVisas(false);
      setObStart(''); setObSlut(''); setObVärde(''); setObTyp('procent');
    }
  }, [visible]);

  function läggTillObIModal() {
    if (!obStart.trim() || !obSlut.trim() || !obVärde.trim()) {
      Alert.alert('Fel', 'Fyll i alla OB-fält');
      return;
    }
    const värde = parseFloat(obVärde);
    if (!värde || värde <= 0) { Alert.alert('Fel', 'Ange ett giltigt OB-värde'); return; }
    setEditerbartOb(prev => [...prev, { start: obStart.trim(), slut: obSlut.trim(), typ: obTyp, värde }]);
    setObStart(''); setObSlut(''); setObVärde('');
    setObFormVisas(false);
  }

  function skicka() {
    const timmar = parseFloat(timmarText.replace(',', '.'));
    if (!timmar || timmar <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt antal timmar');
      return;
    }
    onSkicka({ timmar, ob_tillagg: editerbartOb });
  }

  const timmar = parseFloat(timmarText.replace(',', '.')) || 0;
  const obBrutto = beräknaObBelopp(editerbartOb, timlön);
  const obKostnad = beräknaFakturapris(obBrutto, påslagEller40(paslag));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBakgrund} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalKort}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalRubrik}>{rubrik}</Text>

            {timlön > 0 && (
              <View style={styles.timlönRad}>
                <Text style={styles.timlönEtikett}>Timlön från annonsen</Text>
                <Text style={styles.timlönVärde}>{timlön.toLocaleString('sv-SE')} kr/tim</Text>
              </View>
            )}

            {planeradeTimmar > 0 && (
              <View style={styles.planeradeRad}>
                <Text style={styles.planeradeEtikett}>Planerade timmar</Text>
                <Text style={styles.planeradeVärde}>{planeradeTimmar.toLocaleString('sv-SE')} h</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Antal jobbade timmar</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="t.ex. 4.5"
              value={timmarText}
              onChangeText={setTimmarText}
              keyboardType="decimal-pad"
              autoFocus
            />

            <View style={styles.obSektion}>
              <Text style={styles.obRubrik}>OB-tillägg (redigerbara)</Text>
              {editerbartOb.map((ob, i) => {
                const [sh = 0, sm = 0] = ob.start.split(':').map(Number);
                const [eh = 0, em = 0] = ob.slut.split(':').map(Number);
                const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                const brutto = ob.typ === 'procent' ? h * timlön * (ob.värde / 100) : h * ob.värde;
                const kostnad = beräknaFakturapris(brutto, påslagEller40(paslag));
                return (
                  <View key={i} style={styles.obRad}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.obIntervall}>{ob.start}–{ob.slut} ({ob.typ === 'procent' ? `${ob.värde}%` : `${ob.värde} kr/h`})</Text>
                      <Text style={styles.obBelopp}>+{kostnad.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr (er kostnad)</Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditerbartOb(prev => prev.filter((_, j) => j !== i))} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {obFormVisas ? (
                <View style={styles.obForm}>
                  <View style={styles.obFormTider}>
                    <TidVäljare
                      style={{ flex: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 8, backgroundColor: '#fff' }}
                      placeholder="18:00"
                      value={obStart}
                      onChange={setObStart}
                    />
                    <Text style={styles.obStreck}>–</Text>
                    <TidVäljare
                      style={{ flex: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 8, backgroundColor: '#fff' }}
                      placeholder="20:00"
                      value={obSlut}
                      onChange={setObSlut}
                    />
                  </View>
                  <View style={styles.obTypRad}>
                    {['procent', 'fast'].map(t => (
                      <TouchableOpacity key={t} style={[styles.obTypKnapp, obTyp === t && styles.obTypKnappAktiv]} onPress={() => setObTyp(t)}>
                        <Text style={[styles.obTypText, obTyp === t && styles.obTypTextAktiv]}>{t === 'procent' ? '% OB' : 'kr/h'}</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput
                      style={styles.obVärdeInput}
                      placeholder={obTyp === 'procent' ? 'Procent' : 'kr/h'}
                      value={obVärde}
                      onChangeText={setObVärde}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.obFormKnappar}>
                    <TouchableOpacity style={styles.obAvbrytKnapp} onPress={() => { setObFormVisas(false); setObStart(''); setObSlut(''); setObVärde(''); }}>
                      <Text style={styles.obAvbrytText}>Avbryt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.obLäggTillKnapp} onPress={läggTillObIModal}>
                      <Text style={styles.obLäggTillText}>Lägg till</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.obAddKnapp} onPress={() => setObFormVisas(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={16} color="#ea580c" />
                  <Text style={styles.obAddText}>Lägg till OB-intervall</Text>
                </TouchableOpacity>
              )}
            </View>

            {timmar > 0 && timlön > 0 && (
              <View style={styles.totalRad}>
                <Text style={styles.totalEtikett}>Er totalkostnad{obKostnad > 0 ? ' (inkl. OB)' : ''}</Text>
                <Text style={styles.totalVärde}>{formateraPris(beräknaFakturapris(timmar * timlön, påslagEller40(paslag)) + obKostnad)} kr</Text>
              </View>
            )}

            <View style={styles.modalKnappar}>
              <TouchableOpacity style={styles.avbrytKnapp} onPress={onClose}>
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.skickaKnapp, sparar && { opacity: 0.5 }]} onPress={skicka} disabled={sparar}>
                <Text style={styles.skickaText}>Skicka rapport</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKort: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  timlönRad: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 16 },
  timlönEtikett: { fontSize: 14, color: '#065f46' },
  timlönVärde: { fontSize: 14, fontWeight: '700', color: '#065f46' },
  planeradeRad: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 16 },
  planeradeEtikett: { fontSize: 14, color: '#1e40af' },
  planeradeVärde: { fontSize: 14, fontWeight: '700', color: '#1e40af' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 18, backgroundColor: '#fafafa', marginBottom: 16, textAlign: 'center', letterSpacing: 0 },
  totalRad: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 20 },
  totalEtikett: { fontSize: 14, color: '#1e40af' },
  totalVärde: { fontSize: 16, fontWeight: '700', color: '#1e40af' },
  modalKnappar: { flexDirection: 'row', gap: 12 },
  avbrytKnapp: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center' },
  avbrytText: { fontSize: 15, color: '#666', fontWeight: '600' },
  skickaKnapp: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  skickaText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  obSektion: { backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrik: { fontSize: 13, fontWeight: '700', color: '#9a3412', marginBottom: 6 },
  obRad: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#fde8c8' },
  obIntervall: { fontSize: 13, color: '#7c2d12', fontWeight: '600' },
  obBelopp: { fontSize: 12, color: '#c2410c' },
  obForm: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fde8c8' },
  obFormTider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  obStreck: { color: '#9ca3af', fontSize: 14 },
  obTypRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  obTypKnapp: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff' },
  obTypKnappAktiv: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  obTypText: { fontSize: 13, color: '#9a3412', fontWeight: '600' },
  obTypTextAktiv: { color: '#fff' },
  obVärdeInput: { flex: 1, borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 8, fontSize: 14, backgroundColor: '#fff', letterSpacing: 0 },
  obFormKnappar: { flexDirection: 'row', gap: 8 },
  obAvbrytKnapp: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, alignItems: 'center' },
  obAvbrytText: { fontSize: 13, color: '#666', fontWeight: '600' },
  obLäggTillKnapp: { flex: 1, backgroundColor: '#ea580c', borderRadius: 8, padding: 10, alignItems: 'center' },
  obLäggTillText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  obAddKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, marginTop: 4 },
  obAddText: { fontSize: 13, color: '#ea580c', fontWeight: '600' },
});
