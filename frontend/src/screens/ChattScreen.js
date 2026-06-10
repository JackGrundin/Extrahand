import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { STATUSFÄRGER_TIDRAPPORT } from '../utils/konstanter';
import { parsaArbetstider, formatDagDatum } from '../utils/datumHelper';

function TidrapportKort({ rapport, ärPrivatperson, onUppdaterad }) {
  const [sparar, setSparar] = useState(false);

  async function hantera(status) {
    setSparar(true);
    try {
      await api.uppdateraTidrapportStatus(rapport.id, status);
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  const färg = STATUSFÄRGER_TIDRAPPORT[rapport.status] ?? STATUSFÄRGER_TIDRAPPORT.väntar;

  return (
    <View style={styles.rapportKort}>
      <View style={styles.rapportHuvud}>
        <Ionicons name="document-text-outline" size={18} color="#2563eb" />
        <Text style={styles.rapportRubrik}>Tidrapport</Text>
        <View style={[styles.statusBricka, { backgroundColor: färg.bg }]}>
          <Text style={[styles.statusText, { color: färg.text }]}>{färg.etikett}</Text>
        </View>
      </View>

      <View style={styles.rapportRader}>
        <View style={styles.rapportRad}>
          <Text style={styles.rapportEtikett}>Datum</Text>
          <Text style={styles.rapportVärde}>{new Date(rapport.datum).toLocaleDateString('sv-SE')}</Text>
        </View>
        <View style={styles.rapportRad}>
          <Text style={styles.rapportEtikett}>Timmar</Text>
          <Text style={styles.rapportVärde}>{rapport.timmar} tim</Text>
        </View>
        <View style={styles.rapportRad}>
          <Text style={styles.rapportEtikett}>Timlön</Text>
          <Text style={styles.rapportVärde}>{rapport.timlon?.toLocaleString('sv-SE')} kr/tim</Text>
        </View>
        <View style={[styles.rapportRad, styles.totalRad]}>
          <Text style={styles.totalEtikett}>Totalt</Text>
          <Text style={styles.totalVärde}>{rapport.totalt_belopp?.toLocaleString('sv-SE')} kr</Text>
        </View>
      </View>

      {ärPrivatperson && rapport.status === 'väntar' && (
        <View style={styles.rapportKnappar}>
          <TouchableOpacity
            style={[styles.bestridKnapp, sparar && { opacity: 0.5 }]}
            onPress={() => hantera('bestridd')}
            disabled={sparar}
          >
            <Text style={styles.bestridText}>Bestrid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.godkännKnapp, sparar && { opacity: 0.5 }]}
            onPress={() => hantera('godkänd')}
            disabled={sparar}
          >
            <Text style={styles.godkännText}>Godkänn</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ChattScreen({ route, navigation }) {
  const { ansokningId } = route.params;

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Betygsatt', { ansokningId })}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="star-outline" size={22} color="#f59e0b" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, ansokningId]);

  const { användare } = useAuth();
  const { markeraLäst } = useNotifikationer();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const [meddelanden, setMeddelanden] = useState([]);
  const [tidrapport, setTidrapport] = useState(null);
  const [passInfo, setPassInfo] = useState(null);
  const [text, setText] = useState('');
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [skickar, setSkickar] = useState(false);
  const listRef = useRef(null);

  async function hämta() {
    const [msgResult, rapportResult, passResult] = await Promise.allSettled([
      api.hämtaMeddelanden(ansokningId),
      api.hämtaTidrapport(ansokningId),
      api.hämtaAnsökanDetaljer(ansokningId),
    ]);
    if (msgResult.status === 'fulfilled') setMeddelanden(msgResult.value);
    if (rapportResult.status === 'fulfilled') setTidrapport(rapportResult.value);
    if (passResult.status === 'fulfilled') setPassInfo(passResult.value);
    setLaddar(false);
    setUppdaterar(false);
  }

  useFocusEffect(useCallback(() => {
    hämta();
    markeraLäst(ansokningId);
  }, []));

  async function skicka() {
    if (!text.trim() || skickar) return;
    setSkickar(true);
    try {
      const nytt = await api.skicka(ansokningId, { innehall: text.trim() });
      setMeddelanden((prev) => [...prev, nytt]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (fel) {
      console.error(fel);
    } finally {
      setSkickar(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  const dagScheman = parsaArbetstider(passInfo?.arbetstider);
  const allaDatum = dagScheman ? dagScheman.map(d => d.datum).filter(Boolean) : [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {(passInfo?.jobbTitel || allaDatum.length > 0) && (
        <View style={styles.passStrip}>
          {passInfo?.jobbTitel && (
            <Text style={styles.passTitel} numberOfLines={1}>{passInfo.jobbTitel}</Text>
          )}
          {allaDatum.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datumRad} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              <Ionicons name="calendar" size={14} color="#2563eb" style={{ marginRight: 2 }} />
              {allaDatum.map((d, i) => (
                <View key={i} style={styles.datumChip}>
                  <Text style={styles.datumChipText}>{formatDagDatum(d)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          {allaDatum.length === 0 && passInfo?.antalDagar != null && (
            <View style={styles.datumRad}>
              <View style={styles.datumChip}>
                <Text style={styles.datumChipText}>{passInfo.antalDagar} dag{passInfo.antalDagar !== 1 ? 'ar' : ''}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={meddelanden}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.meddelandeLista}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga meddelanden ännu. Säg hej!</Text>}
        ListFooterComponent={
          tidrapport ? (
            <TidrapportKort
              rapport={tidrapport}
              ärPrivatperson={ärPrivatperson}
              onUppdaterad={hämta}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const ärMitt = item.avsandare_id === användare?.id;
          return (
            <View style={[styles.bubbla, ärMitt ? styles.mittBubbla : styles.deras]}>
              <Text style={[styles.bubblaText, ärMitt && styles.mittText]}>{item.innehall}</Text>
              <Text style={[styles.tid, ärMitt && styles.mittTid]}>
                {new Date(item.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inmatning}>
        <TextInput
          style={styles.input}
          placeholder="Skriv ett meddelande..."
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={[styles.skickaKnapp, !text.trim() && styles.inaktiv]} onPress={skicka} disabled={!text.trim() || skickar}>
          <Text style={styles.skickaText}>Skicka</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  passStrip: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  passTitel: { fontSize: 13, fontWeight: '700', color: '#2563eb', marginBottom: 6 },
  datumRad: { flexDirection: 'row' },
  datumChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  datumChipText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  meddelandeLista: { padding: 16, gap: 8 },
  bubbla: { maxWidth: '75%', padding: 12, borderRadius: 16, backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  mittBubbla: { alignSelf: 'flex-end', backgroundColor: '#2563eb', borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  deras: {},
  bubblaText: { fontSize: 15, color: '#1a1a1a', lineHeight: 21 },
  mittText: { color: '#fff' },
  tid: { fontSize: 11, color: '#aaa', marginTop: 4 },
  mittTid: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  tom: { textAlign: 'center', color: '#999', marginTop: 40 },
  inmatning: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, maxHeight: 100, letterSpacing: 0 },
  skickaKnapp: { backgroundColor: '#2563eb', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  inaktiv: { backgroundColor: '#c7d2fe' },
  skickaText: { color: '#fff', fontWeight: '600' },
  rapportKort: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#e0e7ff' },
  rapportHuvud: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  rapportRubrik: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  statusBricka: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  rapportRader: { gap: 8, marginBottom: 14 },
  rapportRad: { flexDirection: 'row', justifyContent: 'space-between' },
  rapportEtikett: { fontSize: 14, color: '#888' },
  rapportVärde: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  totalRad: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 4 },
  totalEtikett: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  totalVärde: { fontSize: 15, fontWeight: '700', color: '#2563eb' },
  rapportKnappar: { flexDirection: 'row', gap: 10 },
  bestridKnapp: { flex: 1, borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bestridText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  godkännKnapp: { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  godkännText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
