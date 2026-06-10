import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
    setModalSynlig(true);
  }

  async function skickaRapport() {
    const timmar = parseFloat(timmarText.replace(',', '.'));
    if (!timmar || timmar <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt antal timmar');
      return;
    }
    setSparar(true);
    try {
      await api.skapaRapport({ ansokan_id: valtAnsokningId, timmar });
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
  const obTillagg = parsaObTillagg(jobb?.ob_tillagg);
  const obBelopp = beräknaObBelopp(obTillagg, timlön);
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

            {obTillagg.length > 0 && (
              <View style={styles.obSektion}>
                <Text style={styles.obRubrik}>OB-tillägg</Text>
                {obTillagg.map((ob, i) => {
                  const [sh = 0, sm = 0] = ob.start.split(':').map(Number);
                  const [eh = 0, em = 0] = ob.slut.split(':').map(Number);
                  const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                  const belopp = ob.typ === 'procent' ? h * timlön * (ob.värde / 100) : h * ob.värde;
                  return (
                    <View key={i} style={styles.obRad}>
                      <Text style={styles.obIntervall}>{ob.start}–{ob.slut} ({ob.typ === 'procent' ? `${ob.värde}%` : `${ob.värde} kr/h`})</Text>
                      <Text style={styles.obBelopp}>+{belopp.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {timmar > 0 && timlön > 0 && (
              <View style={styles.totalRad}>
                <Text style={styles.totalEtikett}>Totalt belopp{obBelopp > 0 ? ' (inkl. OB)' : ''}</Text>
                <Text style={styles.totalVärde}>{(timmar * timlön + obBelopp).toLocaleString('sv-SE')} kr</Text>
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
  obRad: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  obIntervall: { fontSize: 13, color: '#7c2d12' },
  obBelopp: { fontSize: 13, fontWeight: '700', color: '#c2410c' },
});
