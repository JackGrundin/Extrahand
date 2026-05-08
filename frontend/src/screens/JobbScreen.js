import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, ScrollView } from 'react-native';
import { api } from '../api/klient';

const TYPER = ['Alla', 'gig', 'sommarjobb'];
const KATEGORIER = ['Alla', 'Café', 'Restaurang', 'Butik', 'Lager', 'Kontor', 'IT', 'Snickare', 'Städ', 'Övrigt'];
const SORTERING = ['Nyast', 'Högst lön', 'Flest dagar'];

export default function JobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [valtTyp, setValtTyp] = useState('Alla');
  const [valtKategori, setValtKategori] = useState('Alla');
  const [stadFilter, setStadFilter] = useState('');
  const [minLön, setMinLön] = useState('');
  const [minDagar, setMinDagar] = useState('');
  const [sortering, setSortering] = useState('Nyast');

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

  const filtrerade = jobb
    .filter((j) => {
      const typOk = valtTyp === 'Alla' || j.Typ === valtTyp;
      const kategoriOk = valtKategori === 'Alla' || j.Kategori === valtKategori;
      const stadOk = !stadFilter.trim() || (j.Plats ?? '').toLowerCase().includes(stadFilter.trim().toLowerCase());
      const lönOk = !minLön || (j.Lon != null && j.Lon >= parseInt(minLön));
      const dagarOk = !minDagar || (j.antal_dagar != null && j.antal_dagar >= parseInt(minDagar));
      return typOk && kategoriOk && stadOk && lönOk && dagarOk;
    })
    .sort((a, b) => {
      if (sortering === 'Högst lön') return (b.Lon ?? 0) - (a.Lon ?? 0);
      if (sortering === 'Flest dagar') return (b.antal_dagar ?? 0) - (a.antal_dagar ?? 0);
      return new Date(b.created_at) - new Date(a.created_at);
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

        <View style={styles.inputRad}>
          <TextInput
            style={styles.miniInput}
            placeholder="Min lön (kr/tim)"
            value={minLön}
            onChangeText={setMinLön}
            keyboardType="numeric"
            clearButtonMode="while-editing"
          />
          <TextInput
            style={styles.miniInput}
            placeholder="Min antal dagar"
            value={minDagar}
            onChangeText={setMinDagar}
            keyboardType="numeric"
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRad}>
          {SORTERING.map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, sortering === s && styles.chipAktiv]} onPress={() => setSortering(s)}>
              <Text style={[styles.chipText, sortering === s && styles.chipTextAktiv]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRad}>
          {TYPER.map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, valtTyp === t && styles.chipAktiv]} onPress={() => setValtTyp(t)}>
              <Text style={[styles.chipText, valtTyp === t && styles.chipTextAktiv]}>
                {t === 'Alla' ? 'Alla typer' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRad, { marginBottom: 4 }]}>
          {KATEGORIER.map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, styles.chipKategori, valtKategori === k && styles.chipAktiv]} onPress={() => setValtKategori(k)}>
              <Text style={[styles.chipText, valtKategori === k && styles.chipTextAktiv]}>{k}</Text>
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
            <View style={styles.kortTopp}>
              <Text style={styles.titel} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
              {item.Kategori && <Text style={styles.kategoriTag}>{item.Kategori}</Text>}
            </View>
            <Text style={styles.jobbTitel} numberOfLines={1}>{item.Titel}</Text>
            <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
            {item.Lon && <Text style={styles.lön}>{item.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
            <View style={styles.extraRad}>
              {item.antal_dagar != null && <Text style={styles.extraInfo}>{item.antal_dagar} dagar</Text>}
              {item.arbetstider ? <Text style={styles.extraInfo}>{item.arbetstider}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterContainer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  stadInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  inputRad: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  miniInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: '#fafafa' },
  chipRad: { gap: 8, paddingRight: 4, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  chipKategori: { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  chipAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextAktiv: { color: '#fff' },
  lista: { padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortTopp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titel: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  jobbTitel: { fontSize: 14, color: '#555', marginBottom: 4 },
  kategoriTag: { fontSize: 12, color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  lön: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  extraRad: { flexDirection: 'row', gap: 12, marginTop: 4 },
  extraInfo: { fontSize: 13, color: '#888' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
