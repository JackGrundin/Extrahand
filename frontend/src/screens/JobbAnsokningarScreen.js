import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';
import { parsaObTillagg, beräknaObBelopp } from '../utils/datumHelper';

function StatusKnappar({ item, onUppdaterad, onAvsluta, navigation }) {
  const [sparar, setSparar] = useState(false);

  async function godkänn() {
    setSparar(true);
    try {
      await api.uppdateraStatus(item.id, 'godkänd');
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  async function återkalla() {
    setSparar(true);
    try {
      await api.uppdateraStatus(item.id, 'väntande');
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  if (item.status === 'godkänd') {
    return (
      <View style={styles.godkändContainer}>
        <View style={styles.godkändRad}>
          <View style={styles.godkändBadge}>
            <Text style={styles.godkändText}>Godkänd</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}>
            <Text style={styles.öppnaChattText}>Öppna chatt →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.godkändBottomRad}>
          <TouchableOpacity onPress={återkalla} disabled={sparar}>
            <Text style={styles.återkallaText}>Ta tillbaka godkännandet</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Betygsatt', { ansokningId: item.id })}>
            <Text style={styles.betygsättText}>Betygsätt →</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.avsluteKnapp} onPress={() => onAvsluta(item.id)}>
          <Text style={styles.avsluteKnappText}>Avsluta pass</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (item.status === 'avvisad') {
    return (
      <View style={styles.avvisadBadge}>
        <Text style={styles.avvisadText}>Nekad</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.godkännKnapp, sparar && { opacity: 0.5 }]}
      onPress={godkänn}
      disabled={sparar}
    >
      <Text style={styles.godkännKnappText}>Godkänn</Text>
    </TouchableOpacity>
  );
}

export default function JobbAnsokningarScreen({ route, navigation }) {
  const { jobbId } = route.params;
  const [ansökningar, setAnsökningar] = useState([]);
  const [avslutadeIds, setAvslutadeIds] = useState(new Set());
  const [jobb, setJobb] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [modalSynlig, setModalSynlig] = useState(false);
  const [valtAnsokningId, setValtAnsokningId] = useState(null);
  const [timmarText, setTimmarText] = useState('');
  const [sparar, setSparar] = useState(false);
  const [editerbartOb, setEditerbartOb] = useState([]);
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');

  async function hämta() {
    try {
      const [ansökningarData, jobbData] = await Promise.all([
        api.ansökningarFörJobb(jobbId),
        api.hämtaJobbId(jobbId),
      ]);
      setAnsökningar(ansökningarData);
      setJobb(jobbData);

      const godkända = ansökningarData.filter(a => a.status === 'godkänd');
      const rapporter = await Promise.all(godkända.map(a => api.hämtaTidrapport(a.id).catch(() => null)));
      const avslutade = new Set(godkända.filter((_, i) => rapporter[i] != null).map(a => a.id));
      setAvslutadeIds(avslutade);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  function öppnaAvsluta(ansokningId) {
    setValtAnsokningId(ansokningId);
    setTimmarText('');
    setEditerbartOb(parsaObTillagg(jobb?.ob_tillagg));
    setObFormVisas(false);
    setObStart(''); setObSlut(''); setObVärde(''); setObTyp('procent');
    setModalSynlig(true);
  }

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

  async function skickaRapport() {
    const timmar = parseFloat(timmarText.replace(',', '.'));
    if (!timmar || timmar <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt antal timmar');
      return;
    }
    setSparar(true);
    try {
      await api.skapaRapport({ ansokan_id: valtAnsokningId, timmar, ob_tillagg: editerbartOb });
      setModalSynlig(false);
      setAvslutadeIds(prev => new Set([...prev, valtAnsokningId]));
      Alert.alert('Skickat!', 'Tidrapporten har skickats till arbetstagaren för godkännande.');
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  const timlön = jobb?.Lon ?? 0;
  const timmar = parseFloat(timmarText.replace(',', '.')) || 0;
  const fakturaFaktor = 1.32 * 1.06 * 1.40;
  const obBrutto = beräknaObBelopp(editerbartOb, timlön);
  const obKostnad = obBrutto * fakturaFaktor;
  const aktivaAnsökningar = ansökningar.filter(a => !avslutadeIds.has(a.id));

  return (
    <>
      <FlatList
        style={styles.lista}
        data={aktivaAnsökningar}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga aktiva ansökningar</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.kort}
            onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.sokande_id, ansokningId: item.id })}
          >
            <View style={styles.kortHuvud}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.sökandeNamn ?? '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.sökandeTitel}>{item.sökandeNamn ?? 'Okänd sökande'}</Text>
                <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
              </View>
            </View>
            {item.meddelande ? (
              <Text style={styles.meddelande} numberOfLines={3}>{item.meddelande}</Text>
            ) : (
              <Text style={styles.ingetMeddelande}>Ingen ansökningstext</Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.sokande_id, ansokningId: item.id })} style={styles.profilLänkRad}>
              <Text style={styles.chattLänk}>Visa profil →</Text>
            </TouchableOpacity>
            <StatusKnappar item={item} onUppdaterad={hämta} onAvsluta={öppnaAvsluta} navigation={navigation} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalSynlig} transparent animationType="slide" onRequestClose={() => setModalSynlig(false)}>
        <KeyboardAvoidingView style={styles.modalBakgrund} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalKort}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalRubrik}>Avsluta pass</Text>

            {timlön > 0 && (
              <View style={styles.timlönRad}>
                <Text style={styles.timlönEtikett}>Timlön från annonsen</Text>
                <Text style={styles.timlönVärde}>{timlön.toLocaleString('sv-SE')} kr/tim</Text>
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
                const kostnad = brutto * fakturaFaktor;
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
                    <TextInput style={[styles.obTidInput]} placeholder="18:00" value={obStart} onChangeText={setObStart} keyboardType="numbers-and-punctuation" />
                    <Text style={styles.obStreck}>–</Text>
                    <TextInput style={[styles.obTidInput]} placeholder="20:00" value={obSlut} onChangeText={setObSlut} keyboardType="numbers-and-punctuation" />
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
                <Text style={styles.totalVärde}>{(timmar * timlön * fakturaFaktor + obKostnad).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</Text>
              </View>
            )}

            <View style={styles.modalKnappar}>
              <TouchableOpacity style={styles.avbrytKnapp} onPress={() => setModalSynlig(false)}>
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.skickaKnapp, sparar && { opacity: 0.5 }]} onPress={skickaRapport} disabled={sparar}>
                <Text style={styles.skickaText}>Skicka rapport</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  sökandeTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  datum: { fontSize: 13, color: '#999', marginTop: 2 },
  meddelande: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 10 },
  ingetMeddelande: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 10 },
  profilLänkRad: { marginBottom: 12 },
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  godkännKnapp: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  godkännKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  godkändContainer: { marginBottom: 12 },
  godkändRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  godkändBadge: { backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  godkändText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  öppnaChattText: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  godkändBottomRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  återkallaText: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'underline' },
  betygsättText: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  avsluteKnapp: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  avsluteKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  avvisadBadge: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12 },
  avvisadText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKort: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  timlönRad: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 16 },
  timlönEtikett: { fontSize: 14, color: '#065f46' },
  timlönVärde: { fontSize: 14, fontWeight: '700', color: '#065f46' },
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
  obTidInput: { flex: 1, borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 8, fontSize: 14, backgroundColor: '#fff', textAlign: 'center', letterSpacing: 0 },
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
