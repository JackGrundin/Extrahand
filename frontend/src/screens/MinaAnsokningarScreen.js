import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { ansökanStatusVisning } from '../utils/konstanter';
import { saknadeKrav } from '../utils/behorighet';
import { useRealtidsPing } from '../context/RealtidsContext';
import HandlingsKnapp from '../components/HandlingsKnapp';
import BehörighetsKrav from '../components/BehörighetsKrav';

export default function MinaAnsokningarScreen({ navigation }) {
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  // Ansökan vars nya krav ska bekräftas, plus vad som kryssats i modalen.
  const [bekräftar, setBekräftar] = useState(null);
  const [ikryssade, setIkryssade] = useState(() => new Set());
  const [sparar, setSparar] = useState(false);

  async function hämta() {
    try {
      const data = await api.minaAnsökningar();
      // Godkända ansökningar visas under "Mina pass" i stället.
      //
      // Schemats PASS-ansökningar hör inte hemma här alls: de skapas automatiskt vid
      // godkännandet, en per pass, och är inget personen själv har sökt. Så länge de är
      // godkända föll de bort av sig själva – men hoppar man av ett schema sätts de till
      // 'avvisad' och listan hade fyllts med ett rött kort per pass.
      setAnsökningar(data.filter(a => a.status !== 'godkänd' && a.schemaPassId == null));
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  // Realtid: uppdatera listan direkt när en ansökans status ändras (godkänd/avvisad/väntande)
  useRealtidsPing(() => { hämta(); });

  function ångra(id) {
    Alert.alert('Ångra ansökan', 'Vill du ta tillbaka din ansökan?', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ångra ansökan', style: 'destructive', onPress: async () => {
        try {
          await api.ångraAnsökan(id);
          setAnsökningar(prev => prev.filter(a => a.id !== id));
        } catch (fel) {
          Alert.alert('Fel', fel.message);
        }
      }},
    ]);
  }

  // Företaget har lagt till krav sedan ansökan skickades. Hela den aktuella listan kryssas
  // om, inte bara de nya: intygandet gäller alltid allt som står i annonsen just nu.
  function öppnaBekräftelse(ansökan) {
    setBekräftar(ansökan);
    setIkryssade(new Set());
  }

  async function skickaBekräftelse() {
    if (!bekräftar) return;
    setSparar(true);
    try {
      await api.intygaKrav(bekräftar.id, { intygade_krav: [...ikryssade] });
      setBekräftar(null);
      await hämta();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  const kvarAttKryssa = bekräftar
    ? saknadeKrav(bekräftar.behorighetsKrav, [...ikryssade]).length
    : 0;

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <>
    <FlatList
      style={styles.lista}
      data={ansökningar}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={
        <View style={styles.tomContainer}>
          <Text style={styles.tomText}>Du har inte sökt några jobb ännu</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.kort}>
          <View style={styles.kortHuvud}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobbTitel} numberOfLines={1}>
                {item.foretagNamn ?? 'Okänt företag'}
              </Text>
              <Text style={styles.foretagNamn} numberOfLines={1}>
                {item.jobbTitel ?? ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
              {(() => {
                const status = ansökanStatusVisning(item);
                if (!status) return null;
                return (
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{status.etikett}</Text>
                  </View>
                );
              })()}
            </View>
          </View>
          {item.meddelande ? (
            <Text style={styles.meddelande} numberOfLines={2}>{item.meddelande}</Text>
          ) : (
            <Text style={styles.ingetMeddelande}>Ingen ansökningsttext</Text>
          )}

          {/* Företaget har lagt till krav efter att ansökan skickades. Tills de bekräftas
              ser företaget "Kräver ny bekräftelse" på sitt sökandekort. */}
          {item.saknadeKrav?.length > 0 && (
            <View style={styles.kravVarning}>
              <View style={styles.kravVarningRad}>
                <Ionicons name="alert-circle" size={15} color="#b45309" />
                <Text style={styles.kravVarningRubrik}>Nya behörighetskrav</Text>
              </View>
              <Text style={styles.kravVarningText}>
                Bekräfta att du uppfyller kraven för att din ansökan ska förbli giltig.
              </Text>
              <TouchableOpacity style={styles.kravKnapp} onPress={() => öppnaBekräftelse(item)} activeOpacity={0.85}>
                <Text style={styles.kravKnappText}>Bekräfta nya krav</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.kortFot}>
            <HandlingsKnapp
              text="Öppna chatt →"
              onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
            />
            {item.status === 'väntande' && (
              <TouchableOpacity onPress={() => ångra(item.id)}>
                <Text style={styles.ångraLänk}>Ångra ansökan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />

    <Modal visible={!!bekräftar} transparent animationType="slide" onRequestClose={() => setBekräftar(null)}>
      <View style={styles.modalBakgrund}>
        <View style={styles.modalArk}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalRubrik}>Bekräfta behörighetskrav</Text>
            <Text style={styles.modalUnderrubrik}>{bekräftar?.jobbTitel ?? ''}</Text>

            <BehörighetsKrav
              krav={bekräftar?.behorighetsKrav}
              läge="intyga"
              ikryssade={ikryssade}
              onÄndra={setIkryssade}
            />

            <TouchableOpacity
              style={[styles.modalKnapp, (kvarAttKryssa > 0 || sparar) && styles.modalKnappInaktiv]}
              onPress={skickaBekräftelse}
              disabled={kvarAttKryssa > 0 || sparar}
              activeOpacity={0.85}
            >
              {sparar
                ? <ActivityIndicator color="#fff" />
                : (
                  <Text style={styles.modalKnappText}>
                    {kvarAttKryssa > 0 ? `${kvarAttKryssa} krav kvar att kryssa i` : 'Bekräfta'}
                  </Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBekräftar(null)} disabled={sparar} style={styles.avbrytRad} hitSlop={8}>
              <Text style={styles.avbrytText}>Avbryt</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  jobbTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  foretagNamn: { fontSize: 13, color: '#888', marginTop: 2 },
  datum: { fontSize: 13, color: '#999', marginLeft: 8 },
  kravVarning: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  kravVarningRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kravVarningRubrik: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  kravVarningText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  kravKnapp: { backgroundColor: '#b45309', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  kravKnappText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalArk: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 34, maxHeight: '85%' },
  modalRubrik: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  modalUnderrubrik: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  modalKnapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  modalKnappInaktiv: { backgroundColor: '#93c5fd' },
  modalKnappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  avbrytRad: { alignItems: 'center', marginTop: 14 },
  avbrytText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  meddelande: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 10 },
  ingetMeddelande: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 10 },
  kortFot: { alignItems: 'center', gap: 10 },
  chattKnapp: { alignSelf: 'center', width: '100%', maxWidth: 400, backgroundColor: '#eff6ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  chattKnappText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  ångraLänk: { fontSize: 13, color: '#dc2626', fontWeight: '500' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '600' },
  tomContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
});
