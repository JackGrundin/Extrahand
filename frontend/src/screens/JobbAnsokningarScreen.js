import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

function TimmArKort({ item, onSparat }) {
  const [timmar, setTimmar] = useState(String(item.timmar ?? 0));
  const [sparar, setSparar] = useState(false);

  async function spara() {
    const val = parseInt(timmar);
    if (isNaN(val) || val < 0) { Alert.alert('Fel', 'Ange ett giltigt antal timmar'); return; }
    setSparar(true);
    try {
      await api.loggaTimmar(item.id, val);
      onSparat();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  return (
    <View style={styles.timmArRad}>
      <TextInput
        style={styles.timmArInput}
        value={timmar}
        onChangeText={setTimmar}
        keyboardType="numeric"
        placeholder="0"
      />
      <Text style={styles.timmArEtikett}>tim</Text>
      <TouchableOpacity style={[styles.timmArKnapp, sparar && { opacity: 0.5 }]} onPress={spara} disabled={sparar}>
        <Text style={styles.timmArKnappText}>Logga</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function JobbAnsokningarScreen({ route, navigation }) {
  const { jobbId, titel } = route.params;
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function hämta() {
    try {
      const data = await api.ansökningarFörJobb(jobbId);
      setAnsökningar(data);
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
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id, titel: `Ansökan ${index + 1}` })}
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
          <Text style={styles.chattLänk}>Öppna chatt →</Text>
          <TimmArKort item={item} onSparat={hämta} />
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
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500', marginBottom: 12 },
  timmArRad: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  timmArInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, width: 64, fontSize: 15, textAlign: 'center' },
  timmArEtikett: { fontSize: 14, color: '#666' },
  timmArKnapp: { backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  timmArKnappText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
