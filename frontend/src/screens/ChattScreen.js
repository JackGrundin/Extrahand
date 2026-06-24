import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { STATUSFÄRGER_TIDRAPPORT } from '../utils/konstanter';
import { parsaArbetstider, formatDagDatum, parsaObTillagg } from '../utils/datumHelper';
import ErbjudPassModal from '../components/ErbjudPassModal';
import JobbforfraganKort from '../components/JobbforfraganKort';
import PassKort from '../components/PassKort';

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
        {(() => {
          const ob = parsaObTillagg(rapport.ob_tillagg);
          if (!ob.length || !rapport.timlon) return null;
          return (
            <View style={styles.obSektion}>
              <Text style={styles.obRubrik}>OB-tillägg</Text>
              {ob.map((o, i) => {
                const [sh = 0, sm = 0] = o.start.split(':').map(Number);
                const [eh = 0, em = 0] = o.slut.split(':').map(Number);
                const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                const belopp = o.typ === 'procent'
                  ? h * rapport.timlon * (o.värde / 100)
                  : h * o.värde;
                return (
                  <View key={i} style={styles.obRad}>
                    <Text style={styles.obIntervall}>
                      {o.start}–{o.slut} · {h} tim · {o.typ === 'procent' ? `${o.värde}%` : `${o.värde} kr/h`}
                    </Text>
                    <Text style={styles.obBelopp}>+{belopp.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</Text>
                  </View>
                );
              })}
            </View>
          );
        })()}
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
  const { användare } = useAuth();
  const { markeraLäst } = useNotifikationer();
  const ärPrivatperson = användare?.typ === 'privatperson';

  const [motpartId, setMotpartId] = useState(route.params?.medAnvandareId ?? null);
  const [motpartNamn, setMotpartNamn] = useState(route.params?.motpartNamn ?? null);
  const [aktivAnsokanId, setAktivAnsokanId] = useState(route.params?.ansokningId ?? null);
  const [meddelanden, setMeddelanden] = useState([]);
  const [pass, setPass] = useState([]);
  const [förfrågningar, setFörfrågningar] = useState([]);
  const [erbjudVisas, setErbjudVisas] = useState(false);
  const [skickarFörfrågan, setSkickarFörfrågan] = useState(false);
  const [text, setText] = useState('');
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [skickar, setSkickar] = useState(false);
  const listRef = useRef(null);

  // Knapp för betygsättning i headern (riktar mot aktiv ansökan)
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        aktivAnsokanId ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Betygsatt', { ansokningId: aktivAnsokanId })}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="star-outline" size={22} color="#f59e0b" />
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, aktivAnsokanId]);

  // Tar reda på motpartens id – antingen direkt från params eller via en ansökan
  async function bestämMotpart() {
    if (route.params?.medAnvandareId != null) return route.params.medAnvandareId;
    if (motpartId != null) return motpartId;
    if (route.params?.ansokningId != null) {
      try {
        const detaljer = await api.hämtaAnsökanDetaljer(route.params.ansokningId);
        return ärPrivatperson ? detaljer?.foretagId : detaljer?.sokande_id;
      } catch (fel) {
        console.error('Kunde inte avgöra motpart:', fel);
      }
    }
    return null;
  }

  async function hämta() {
    const id = await bestämMotpart();
    if (id == null) { setLaddar(false); setUppdaterar(false); return; }
    setMotpartId(id);

    const [konvResult, förfrResult] = await Promise.allSettled([
      api.hämtaKonversation(id),
      api.hämtaJobbforfragningar(id),
    ]);

    if (konvResult.status === 'fulfilled') {
      const k = konvResult.value;
      setMeddelanden(k.meddelanden ?? []);
      setPass(k.pass ?? []);
      setMotpartNamn(k.motpartNamn ?? null);
      if (k.aktivAnsokanId) setAktivAnsokanId(k.aktivAnsokanId);
    }
    if (förfrResult.status === 'fulfilled') setFörfrågningar(förfrResult.value);

    markeraLäst(String(id));
    setLaddar(false);
    setUppdaterar(false);
  }

  async function skickaFörfrågan(data) {
    if (motpartId == null) {
      Alert.alert('Fel', 'Kunde inte avgöra mottagare');
      return;
    }
    setSkickarFörfrågan(true);
    try {
      await api.skapaJobbforfragan({ till_anvandare_id: motpartId, ...data });
      setErbjudVisas(false);
      hämta();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSkickarFörfrågan(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  async function skicka() {
    if (!text.trim() || skickar || !aktivAnsokanId) return;
    setSkickar(true);
    try {
      const nytt = await api.skicka(aktivAnsokanId, { innehall: text.trim() });
      setMeddelanden((prev) => [...prev, nytt]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (fel) {
      console.error(fel);
    } finally {
      setSkickar(false);
    }
  }

  // Slår ihop meddelanden, jobbförfrågningar och pass/tidrapporter till en
  // gemensam tidslinje sorterad kronologiskt (äldst överst, nyast nederst).
  const tidslinje = useMemo(() => {
    const tidVärde = (v) => {
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const poster = [
      ...meddelanden.map((m) => ({ typ: 'meddelande', tid: tidVärde(m.created_at), data: m, key: `m-${m.id}` })),
      ...förfrågningar.map((f) => ({ typ: 'förfrågan', tid: tidVärde(f.skapad_datum), data: f, key: `f-${f.id}` })),
      ...pass.map((p) => ({ typ: 'pass', tid: tidVärde(p.tidrapport?.created_at ?? p.created_at), data: p, key: `p-${p.id}` })),
    ];
    poster.sort((a, b) => a.tid - b.tid);
    return poster;
  }, [meddelanden, förfrågningar, pass]);

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {motpartNamn && (
        <View style={styles.passStrip}>
          <Text style={styles.passTitel} numberOfLines={1}>{motpartNamn}</Text>
        </View>
      )}

      {!ärPrivatperson && (
        <TouchableOpacity style={styles.erbjudKnapp} onPress={() => setErbjudVisas(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
          <Text style={styles.erbjudText}>Erbjud pass</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={tidslinje}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.meddelandeLista}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga meddelanden ännu. Säg hej!</Text>}
        renderItem={({ item }) => {
          if (item.typ === 'förfrågan') {
            return (
              <JobbforfraganKort
                förfrågan={item.data}
                ärPrivatperson={ärPrivatperson}
                onUppdaterad={hämta}
              />
            );
          }
          if (item.typ === 'pass') {
            return item.data.tidrapport ? (
              <TidrapportKort
                rapport={item.data.tidrapport}
                ärPrivatperson={ärPrivatperson}
                onUppdaterad={hämta}
              />
            ) : (
              <PassKort pass={item.data} />
            );
          }
          const m = item.data;
          const ärMitt = m.avsandare_id === användare?.id;
          return (
            <View style={[styles.bubbla, ärMitt ? styles.mittBubbla : styles.deras]}>
              <Text style={[styles.bubblaText, ärMitt && styles.mittText]}>{m.innehall}</Text>
              <Text style={[styles.tid, ärMitt && styles.mittTid]}>
                {new Date(m.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
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

      <ErbjudPassModal
        visible={erbjudVisas}
        onClose={() => setErbjudVisas(false)}
        onSkicka={skickaFörfrågan}
        skickar={skickarFörfrågan}
      />
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
  erbjudKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eff6ff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  erbjudText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
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
  obSektion: { backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginVertical: 4, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrik: { fontSize: 12, fontWeight: '700', color: '#9a3412', marginBottom: 6 },
  obRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  obIntervall: { fontSize: 13, color: '#7c2d12', flex: 1 },
  obBelopp: { fontSize: 13, fontWeight: '700', color: '#c2410c' },
});
