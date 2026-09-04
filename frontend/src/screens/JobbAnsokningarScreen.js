import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { harStartat, planeradeTimmar, parsaArbetstider } from '../utils/datumHelper';
import { ansökanStatusVisning } from '../utils/konstanter';
import AvslutaPassModal from '../components/AvslutaPassModal';
import HandlingsKnapp from '../components/HandlingsKnapp';
import IntygandeRad from '../components/IntygandeRad';
import { useRealtidsPing } from '../context/RealtidsContext';
import { useAttAvsluta } from '../context/AttAvslutaContext';

function StatusKnappar({ item, onUppdaterad, onAvsluta, navigation, tidigare, startat }) {
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
          {/* "Ta tillbaka godkännandet" döljs för tidigare/passerade pass och när passet startat */}
          {!tidigare && !startat && (
            <TouchableOpacity onPress={återkalla} disabled={sparar}>
              <Text style={styles.återkallaText}>Ta tillbaka godkännandet</Text>
            </TouchableOpacity>
          )}
        </View>
        <HandlingsKnapp
          text="Öppna chatt →"
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
        />
        <TouchableOpacity style={styles.avsluteKnapp} onPress={() => onAvsluta(item.id)}>
          <Text style={styles.avsluteKnappText}>Avsluta pass</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (item.status === 'avvisad') {
    // Hoppade personen av själv ska det inte stå "Nekad" – det är fel besked om vad som hänt.
    const status = ansökanStatusVisning(item, { ärFöretag: true });
    return (
      <View style={[styles.avvisadBadge, { backgroundColor: status.bg }]}>
        <Text style={[styles.avvisadText, { color: status.text }]}>{status.etikett}</Text>
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
  const { jobbId, tidigare } = route.params;
  const { uppdateraAttAvsluta } = useAttAvsluta();
  const [ansökningar, setAnsökningar] = useState([]);
  const [avslutadeIds, setAvslutadeIds] = useState(new Set());
  const [jobb, setJobb] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [modalSynlig, setModalSynlig] = useState(false);
  const [valtAnsokningId, setValtAnsokningId] = useState(null);
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

  useFocusEffect(useCallback(() => {
    hämta();
    // Att öppna jobbets ansökningslista räknas som att företaget sett ansökningarna –
    // nollställ räknaren och uppdatera badgen på Mina jobb-fliken.
    api.markeraAnsökningarSedda(jobbId)
      .then(() => uppdateraAttAvsluta())
      .catch(() => {});
  }, [jobbId, uppdateraAttAvsluta]));

  // Realtid: nya ansökningar och statusändringar visas direkt för företaget
  useRealtidsPing(() => { hämta(); });

  function öppnaAvsluta(ansokningId) {
    // Ett jobb = en tidrapport som täcker ALLA dagar i passet. Antalet dagar i
    // arbetstider är alltså antalet pass som avslutas – varna företaget explicit så
    // att ingen tror att bara ett av flera pass avslutas.
    const antal = parsaArbetstider(jobb?.arbetstider)?.length ?? jobb?.antal_dagar ?? 1;
    const text = antal > 1
      ? `Du är på väg att avsluta alla ${antal} pass för detta uppdrag. Är du säker?`
      : 'Du är på väg att avsluta passet. Är du säker?';
    Alert.alert('Avsluta pass', text, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ja, avsluta',
        onPress: () => {
          setValtAnsokningId(ansokningId);
          setModalSynlig(true);
        },
      },
    ]);
  }

  // Optimistisk favoritväxling: uppdatera kortet direkt och spara i databasen. Vid fel
  // rullas värdet tillbaka. favorit kommer från servern vid nästa hämta(), så det överlever
  // omladdning och följer med över enheter.
  async function växlaFavorit(item) {
    const nyttVärde = !item.favorit;
    setAnsökningar(prev => prev.map(a => (a.id === item.id ? { ...a, favorit: nyttVärde } : a)));
    try {
      await api.växlaFavoritAnsökan(item.id, nyttVärde);
    } catch (fel) {
      setAnsökningar(prev => prev.map(a => (a.id === item.id ? { ...a, favorit: item.favorit } : a)));
      Alert.alert('Fel', fel.message);
    }
  }

  async function skickaRapport({ timmar, ob_tillagg }) {
    setSparar(true);
    try {
      await api.skapaRapport({ ansokan_id: valtAnsokningId, timmar, ob_tillagg });
      setModalSynlig(false);
      setAvslutadeIds(prev => new Set([...prev, valtAnsokningId]));
      // Navigera tillbaka till "Mina jobb" direkt. Skärmens useFocusEffect hämtar då om
      // tidrapporterna, vilket flyttar det avslutade passet från "Aktiva" till "Tidigare
      // pass" utan att appen behöver laddas om.
      navigation.goBack();
      Alert.alert('Skickat!', 'Tidrapporten har skickats till arbetstagaren för godkännande.');
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  const timlön = jobb?.Lon ?? 0;
  // Favoriter fästs överst. Listan är redan ordnad created_at desc från servern och
  // Array.sort är stabil, så inbördes ordning bevaras inom varje grupp.
  const aktivaAnsökningar = ansökningar
    .filter(a => !avslutadeIds.has(a.id))
    .sort((a, b) => (b.favorit ? 1 : 0) - (a.favorit ? 1 : 0));

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
                <IntygandeRad ansökan={item} style={{ marginTop: 4 }} />
              </View>
              {/* Egen träffyta så att stjärnan inte utlöser kortets navigering till profilen. */}
              <TouchableOpacity
                onPress={() => växlaFavorit(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.favoritKnapp}
              >
                <Ionicons
                  name={item.favorit ? 'star' : 'star-outline'}
                  size={24}
                  color={item.favorit ? '#f59e0b' : '#9ca3af'}
                />
              </TouchableOpacity>
            </View>
            {item.meddelande ? (
              <Text style={styles.meddelande} numberOfLines={3}>{item.meddelande}</Text>
            ) : (
              <Text style={styles.ingetMeddelande}>Ingen ansökningstext</Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.sokande_id, ansokningId: item.id })} style={styles.profilLänkRad}>
              <Text style={styles.chattLänk}>Visa profil →</Text>
            </TouchableOpacity>
            <StatusKnappar item={item} onUppdaterad={hämta} onAvsluta={öppnaAvsluta} navigation={navigation} tidigare={tidigare} startat={harStartat(jobb?.arbetstider)} />
          </TouchableOpacity>
        )}
      />

      <AvslutaPassModal
        visible={modalSynlig}
        onClose={() => setModalSynlig(false)}
        timlön={timlön}
        paslag={jobb?.paslag}
        initialObTillagg={jobb?.ob_tillagg}
        planeradeTimmar={planeradeTimmar(jobb?.arbetstider)}
        sparar={sparar}
        onSkicka={skickaRapport}
      />
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
  favoritKnapp: { paddingLeft: 8, alignSelf: 'flex-start' },
  sökandeTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  datum: { fontSize: 13, color: '#999', marginTop: 2 },
  meddelande: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 10 },
  ingetMeddelande: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 10 },
  profilLänkRad: { marginBottom: 12 },
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  godkännKnapp: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  godkännKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  godkändContainer: { marginBottom: 12 },
  godkändRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  godkändBadge: { backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  godkändText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  återkallaText: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'underline' },
  avsluteKnapp: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  avsluteKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  avvisadBadge: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12 },
  avvisadText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
