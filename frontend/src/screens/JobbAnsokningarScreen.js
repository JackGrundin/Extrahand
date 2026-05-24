import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';


const STATUSFÄRGER = {
  godkänd: { bg: '#dcfce7', text: '#16a34a' },
  avvisad: { bg: '#fee2e2', text: '#dc2626' },
  väntande: { bg: '#f3f4f6', text: '#6b7280' },
};

function StatusKnappar({ item, onUppdaterad, navigation }) {
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
  const { jobbId, titel } = route.params;
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function hämta() {
    try {
      const ansökningarData = await api.ansökningarFörJobb(jobbId);
      setAnsökningar(ansökningarData);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <FlatList
      style={styles.lista}
      data={ansökningar}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListHeaderComponent={
        <Text style={styles.rubrik}>{ansökningar.length} ansökning{ansökningar.length !== 1 ? 'ar' : ''}</Text>
      }
      ListEmptyComponent={<Text style={styles.tom}>Inga ansökningar ännu</Text>}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.kort}
          onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.sokande_id, ansokningId: item.id })}
        >
          <View style={styles.kortHuvud}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.sökandeNamn ?? '?').charAt(0).toUpperCase()}
              </Text>
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
          <StatusKnappar item={item} onUppdaterad={hämta} navigation={navigation} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  rubrik: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 12 },
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
  godkändBottomRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  återkallaText: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'underline' },
  betygsättText: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  avvisadBadge: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12 },
  avvisadText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
