import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';
import { harStartat } from '../utils/datumHelper';
import AvslutaPassModal from '../components/AvslutaPassModal';
import { useRealtidsPing } from '../context/RealtidsContext';

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
        <TouchableOpacity
          style={styles.länkKnapp}
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
        >
          <Text style={styles.länkKnappText}>Öppna chatt →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.länkKnapp}
          onPress={() => navigation.navigate('Betygsatt', { ansokningId: item.id })}
        >
          <Text style={styles.länkKnappText}>Betygsätt →</Text>
        </TouchableOpacity>
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
  const { jobbId, tidigare } = route.params;
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

  useFocusEffect(useCallback(() => { hämta(); }, []));

  // Realtid: nya ansökningar och statusändringar visas direkt för företaget
  useRealtidsPing(() => { hämta(); });

  function öppnaAvsluta(ansokningId) {
    setValtAnsokningId(ansokningId);
    setModalSynlig(true);
  }

  async function skickaRapport({ timmar, ob_tillagg }) {
    setSparar(true);
    try {
      await api.skapaRapport({ ansokan_id: valtAnsokningId, timmar, ob_tillagg });
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
  länkKnapp: { alignSelf: 'center', width: '100%', maxWidth: 400, backgroundColor: '#eff6ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  länkKnappText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  avsluteKnapp: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  avsluteKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  avvisadBadge: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12 },
  avvisadText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
