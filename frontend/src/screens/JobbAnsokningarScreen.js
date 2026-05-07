import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

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
      ListEmptyComponent={
        <Text style={styles.tom}>Inga ansökningar ännu</Text>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.kort}
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id, titel: `Ansökan ${index + 1}` })}
        >
          <View style={styles.kortHuvud}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{index + 1}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.sökandeTitel}>Sökande #{index + 1}</Text>
              <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
            </View>
          </View>
          {item.meddelande ? (
            <Text style={styles.meddelande} numberOfLines={3}>{item.meddelande}</Text>
          ) : (
            <Text style={styles.ingetMeddelande}>Ingen ansökningstext</Text>
          )}
          <Text style={styles.chattLänk}>Öppna chatt →</Text>
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
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  tom: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
