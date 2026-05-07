import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, ScrollView } from 'react-native';
import { api } from '../api/klient';

const TYPER = ['Alla', 'heltid', 'deltid', 'uppdrag'];

export default function JobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [valtTyp, setValtTyp] = useState('Alla');
  const [stadFilter, setStadFilter] = useState('');

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

  const filtrerade = jobb.filter((j) => {
    const typOk = valtTyp === 'Alla' || j.Typ === valtTyp;
    const stadOk = !stadFilter.trim() || (j.Plats ?? '').toLowerCase().includes(stadFilter.trim().toLowerCase());
    return typOk && stadOk;
  });

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.stadInput}
          placeholder="Filtrera på stad..."
          value={stadFilter}
          onChangeText={setStadFilter}
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typScroll} contentContainerStyle={styles.typRad}>
          {TYPER.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, valtTyp === t && styles.chipAktiv]}
              onPress={() => setValtTyp(t)}
            >
              <Text style={[styles.chipText, valtTyp === t && styles.chipTextAktiv]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtrerade}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga jobb matchar filtret</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.kort} onPress={() => navigation.navigate('JobbDetalj', { jobb: item })}>
            <Text style={styles.titel}>{item.Titel}</Text>
            <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
            {item.Lon && <Text style={styles.lön}>{item.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterContainer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  stadInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  typScroll: { marginBottom: 4 },
  typRad: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  chipAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  chipTextAktiv: { color: '#fff' },
  lista: { padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  titel: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  lön: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
