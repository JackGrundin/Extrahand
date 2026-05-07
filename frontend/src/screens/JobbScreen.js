import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api/klient';

export default function JobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function hämta() {
    try {
      const data = await api.hämtaJobb();
      setJobb(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useEffect(() => { hämta(); }, []);

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <FlatList
      style={styles.lista}
      data={jobb}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={<Text style={styles.tom}>Inga jobb publicerade ännu</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.kort} onPress={() => navigation.navigate('JobbDetalj', { jobb: item })}>
          <Text style={styles.titel}>{item.Titel}</Text>
          <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
          {item.Lon && <Text style={styles.lön}>{item.Lon.toLocaleString('sv-SE')} kr/mån</Text>}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  titel: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  lön: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
