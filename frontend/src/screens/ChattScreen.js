import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl, Modal } from 'react-native';
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
import AvslutaPassModal from '../components/AvslutaPassModal';
import { useRealtidsPing } from '../context/RealtidsContext';

function TidrapportKort({ rapport, ärPrivatperson, ärSenaste, onUppdaterad }) {
  const [sparar, setSparar] = useState(false);
  const [bestridVisas, setBestridVisas] = useState(false);
  const [bestridText, setBestridText] = useState('');
  const [korrigeraVisas, setKorrigeraVisas] = useState(false);

  async function godkänn() {
    setSparar(true);
    try {
      await api.uppdateraTidrapportStatus(rapport.id, 'godkänd');
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  async function skickaBestridande() {
    const orsak = bestridText.trim();
    if (!orsak) {
      Alert.alert('Fel', 'Skriv en förklaring till varför du bestrider tidrapporten.');
      return;
    }
    setSparar(true);
    try {
      await api.bestridTidrapport(rapport.id, orsak);
      setBestridVisas(false);
      setBestridText('');
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  // En automatiskt skapad rapport som fortfarande väntar på svar rättas PÅ PLATS – annars
  // skulle dubblettspärren i backend svara 409, och chatten få två kort för samma pass.
  // Efter ett bestridande gäller det vanliga flödet: en ny korrigerad rapport.
  const kanKorrigeraPåPlats = rapport.auto_skapad && rapport.status === 'väntar';

  async function skickaKorrigering({ timmar, ob_tillagg }) {
    setSparar(true);
    try {
      if (kanKorrigeraPåPlats) {
        await api.korrigeraTidrapport(rapport.id, { timmar, ob_tillagg });
      } else {
        await api.skapaRapport({ ansokan_id: rapport.ansokan_id, timmar, ob_tillagg });
      }
      setKorrigeraVisas(false);
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
        {/* Löneavdrag. Privatpersonen måste se dem här – det är enda stället de kan
            granska rapporten innan de godkänner den. */}
        {(() => {
          const avdrag = Array.isArray(rapport.avdrag) ? rapport.avdrag : [];
          if (!avdrag.length) return null;
          return (
            <View style={styles.avdragSektion}>
              <Text style={styles.avdragRubrik}>Löneavdrag</Text>
              {avdrag.map((a, i) => (
                <View key={i} style={styles.avdragRad}>
                  <Text style={styles.avdragNamn}>
                    {a.namn}
                    {a.typ === 'totalt' ? ` (del av ${Number(a.belopp).toLocaleString('sv-SE')} kr)` : ''}
                  </Text>
                  <Text style={styles.avdragBelopp}>
                    −{Number(a.avdraget).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
                  </Text>
                </View>
              ))}
            </View>
          );
        })()}

        <View style={[styles.rapportRad, styles.totalRad]}>
          <Text style={styles.totalEtikett}>Totalt</Text>
          <Text style={styles.totalVärde}>{rapport.totalt_belopp?.toLocaleString('sv-SE')} kr</Text>
        </View>

        {rapport.avdrag_belopp > 0 && (
          <View style={styles.rapportRad}>
            <Text style={styles.utbetalningEtikett}>Att betala ut</Text>
            <Text style={styles.utbetalningVärde}>
              {((rapport.totalt_belopp ?? 0) - rapport.avdrag_belopp).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
            </Text>
          </View>
        )}
      </View>

      {ärPrivatperson && rapport.status === 'väntar' && (
        <View style={styles.rapportKnappar}>
          <TouchableOpacity
            style={[styles.bestridKnapp, sparar && { opacity: 0.5 }]}
            onPress={() => setBestridVisas(true)}
            disabled={sparar}
          >
            <Text style={styles.bestridText}>Bestrid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.godkännKnapp, sparar && { opacity: 0.5 }]}
            onPress={godkänn}
            disabled={sparar}
          >
            <Text style={styles.godkännText}>Godkänn</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Företaget rättar antingen en bestriden rapport, eller ett schemapass som
          rapporterats automatiskt med schemalagda timmar (övertid eller rast). */}
      {!ärPrivatperson && ärSenaste && (rapport.status === 'bestridd' || kanKorrigeraPåPlats) && (
        <TouchableOpacity
          style={[styles.korrigeraKnapp, sparar && { opacity: 0.5 }]}
          onPress={() => setKorrigeraVisas(true)}
          disabled={sparar}
        >
          <Ionicons name="create-outline" size={16} color="#2563eb" />
          <Text style={styles.korrigeraText}>
            {kanKorrigeraPåPlats ? 'Justera timmar' : 'Skicka korrigerad tidrapport'}
          </Text>
        </TouchableOpacity>
      )}

      {kanKorrigeraPåPlats && (
        <Text style={styles.autoNot}>
          Skapad automatiskt från schemalagda tider. Justera vid övertid eller rast.
        </Text>
      )}

      {rapport.created_at && !Number.isNaN(new Date(rapport.created_at).getTime()) && (
        <Text style={styles.rapportTid}>
          {new Date(rapport.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {/* Ruta där privatpersonen förklarar varför tidrapporten bestrids */}
      <Modal visible={bestridVisas} transparent animationType="fade" onRequestClose={() => setBestridVisas(false)}>
        <View style={styles.modalBakgrund}>
          <View style={styles.modalKort}>
            <Text style={styles.modalRubrik}>Bestrid tidrapport</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Förklara vad som inte stämmer med tidrapporten"
              value={bestridText}
              onChangeText={setBestridText}
              multiline
              autoFocus
            />
            <View style={styles.modalKnappar}>
              <TouchableOpacity style={styles.modalAvbryt} onPress={() => setBestridVisas(false)} disabled={sparar}>
                <Text style={styles.modalAvbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSkicka, sparar && { opacity: 0.5 }]} onPress={skickaBestridande} disabled={sparar}>
                <Text style={styles.modalSkickaText}>Skicka</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Korrigerad tidrapport använder samma formulär som "Avsluta pass" */}
      <AvslutaPassModal
        visible={korrigeraVisas}
        onClose={() => setKorrigeraVisas(false)}
        timlön={rapport.timlon}
        paslag={rapport.paslag}
        initialObTillagg={rapport.ob_tillagg}
        sparar={sparar}
        onSkicka={skickaKorrigering}
        rubrik="Korrigerad tidrapport"
      />
    </View>
  );
}

// Tydligt kort i chatten som visar att privatpersonen bestridit tidrapporten,
// med förklaringstexten inuti kortet (ersätter ett vanligt chattmeddelande).
function BestriddKort({ rapport }) {
  return (
    <View style={styles.bestriddKort}>
      <View style={styles.bestriddHuvud}>
        <Ionicons name="alert-circle" size={18} color="#dc2626" />
        <Text style={styles.bestriddRubrik}>Tidrapport bestriden</Text>
      </View>
      <Text style={styles.bestriddText}>{rapport.bestridande_orsak}</Text>
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

  // Scrollar till botten av tidslinjen. Retries fångar att pass-/tidrapportkorten
  // längst ned mäts klart först efter första scrollen (variabel höjd).
  const scrollaTillBotten = useCallback((animated = false) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 150);
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 400);
  }, []);

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
    // Chatten ska alltid öppnas längst ned i konversationen.
    scrollaTillBotten(false);
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

  // Realtid för den öppna konversationen: en signal på användarens kanal (nytt meddelande,
  // tidrapport eller jobbförfrågan) hämtar färsk konversation direkt.
  useRealtidsPing(() => { hämta(); });

  async function skicka() {
    if (!text.trim() || skickar || !aktivAnsokanId) return;
    setSkickar(true);
    try {
      const nytt = await api.skicka(aktivAnsokanId, { innehall: text.trim() });
      setMeddelanden((prev) => [...prev, nytt]);
      setText('');
      scrollaTillBotten(true);
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
      // Varje tidrapport (det kan finnas flera per pass: bestridda + korrigerade) placeras
      // efter när den skickades (created_at, annars datum) så att den hamnar kronologiskt
      // bland meddelandena. Pass utan tidrapport sorteras efter när passet/ansökan skapades.
      ...pass.flatMap((p) => {
        const rapporter = p.tidrapporter ?? (p.tidrapport ? [p.tidrapport] : []);
        if (!rapporter.length) {
          // Ett schema ger ett pass per dag. Utan den här kollapsen skulle ett sommarschema
          // lägga 60 passkort i tidslinjen. Schemats annons-pass (schemaPassId null) har
          // alla datum i sina arbetstider och visas i stället som ett samlat kort.
          // Tidrapporter döljs aldrig – var och en måste godkännas för sig.
          if (p.schemaPassId) return [];
          return [{ typ: 'pass', tid: tidVärde(p.created_at), data: p, key: `p-${p.id}` }];
        }
        return rapporter.flatMap((r, i) => {
          const tid = tidVärde(r.created_at ?? r.datum);
          const poster = [{
            typ: 'tidrapport',
            tid,
            data: r,
            ärSenaste: i === rapporter.length - 1,
            key: `t-${r.id}`,
          }];
          // Ett bestridande visas som ett eget "Bestridd"-kort direkt efter tidrapporten.
          if (r.status === 'bestridd' && r.bestridande_orsak) {
            poster.push({ typ: 'bestridd', tid, data: r, key: `b-${r.id}` });
          }
          return poster;
        });
      }),
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
          if (item.typ === 'tidrapport') {
            return (
              <TidrapportKort
                rapport={item.data}
                ärPrivatperson={ärPrivatperson}
                ärSenaste={item.ärSenaste}
                onUppdaterad={hämta}
              />
            );
          }
          if (item.typ === 'bestridd') {
            return <BestriddKort rapport={item.data} />;
          }
          if (item.typ === 'pass') {
            return <PassKort pass={item.data} />;
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
  rapportTid: { fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'right' },
  rapportKnappar: { flexDirection: 'row', gap: 10 },
  bestridKnapp: { flex: 1, borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bestridText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  godkännKnapp: { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  godkännText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  bestriddKort: { backgroundColor: '#fef2f2', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#fecaca' },
  bestriddHuvud: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bestriddRubrik: { fontSize: 15, fontWeight: '700', color: '#dc2626', flex: 1 },
  bestriddText: { fontSize: 15, color: '#7f1d1d', lineHeight: 21 },
  korrigeraKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 10 },
  korrigeraText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  autoNot: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 6 },
  avdragSektion: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  avdragRubrik: { fontSize: 12, fontWeight: '700', color: '#991b1b', marginBottom: 6 },
  avdragRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  avdragNamn: { fontSize: 13, color: '#991b1b', flex: 1 },
  avdragBelopp: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  utbetalningEtikett: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  utbetalningVärde: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalKort: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalRubrik: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, minHeight: 48, textAlignVertical: 'top', marginBottom: 16 },
  modalKnappar: { flexDirection: 'row', gap: 10 },
  modalAvbryt: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalAvbrytText: { color: '#666', fontWeight: '600', fontSize: 15 },
  modalSkicka: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSkickaText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  obSektion: { backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginVertical: 4, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrik: { fontSize: 12, fontWeight: '700', color: '#9a3412', marginBottom: 6 },
  obRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  obIntervall: { fontSize: 13, color: '#7c2d12', flex: 1 },
  obBelopp: { fontSize: 13, fontWeight: '700', color: '#c2410c' },
});
