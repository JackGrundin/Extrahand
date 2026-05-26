import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

export default function RapporterScreen() {
  const [rapporter, setRapporter] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function hämta(from, to) {
    setLaddar(true);
    try {
      const data = await api.allaRapporter(from || null, to || null);
      setRapporter(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta('', ''); }, []));

  const totaltBelopp = rapporter.reduce((sum, r) => sum + (r.totalt_belopp ?? 0), 0);
  const totaltTimmar = rapporter.reduce((sum, r) => sum + (r.timmar ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.filter}>
        <TextInput
          style={styles.datumInput}
          placeholder="Från (ÅÅÅÅ-MM-DD)"
          value={fromDate}
          onChangeText={setFromDate}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.datumInput}
          placeholder="Till (ÅÅÅÅ-MM-DD)"
          value={toDate}
          onChangeText={setToDate}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.filterKnapp} onPress={() => hämta(fromDate, toDate)}>
          <Text style={styles.filterKnappText}>Filtrera</Text>
        </TouchableOpacity>
      </View>

      {laddar ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      ) : (
        <FlatList
          data={rapporter}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.tom}>Inga godkända rapporter hittades</Text>}
          ListFooterComponent={rapporter.length > 0 ? (
            <View style={styles.summering}>
              <View style={styles.summeringRad}>
                <Text style={styles.summeringEtikett}>Totalt antal rapporter</Text>
                <Text style={styles.summeringVärde}>{rapporter.length}</Text>
              </View>
              <View style={styles.summeringRad}>
                <Text style={styles.summeringEtikett}>Totalt timmar</Text>
                <Text style={styles.summeringVärde}>{totaltTimmar} tim</Text>
              </View>
              <View style={[styles.summeringRad, styles.totalRad]}>
                <Text style={styles.totalEtikett}>Totalt belopp</Text>
                <Text style={styles.totalVärde}>{totaltBelopp.toLocaleString('sv-SE')} kr</Text>
              </View>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.kort}>
              <View style={styles.kortHuvud}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.namn}>{item.anvandareNamn ?? '–'}</Text>
                  <Text style={styles.email}>{item.anvandareEmail ?? '–'}</Text>
                  {item.anvardareTelefon ? <Text style={styles.telefon}>{item.anvardareTelefon}</Text> : null}
                </View>
                <Text style={styles.datum}>{new Date(item.datum).toLocaleDateString('sv-SE')}</Text>
              </View>
              <View style={styles.kortDetaljer}>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timmar</Text>
                  <Text style={styles.detaljVärde}>{item.timmar}</Text>
                </View>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timlön</Text>
                  <Text style={styles.detaljVärde}>{item.timlon?.toLocaleString('sv-SE')} kr</Text>
                </View>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Totalt</Text>
                  <Text style={[styles.detaljVärde, styles.totalText]}>{item.totalt_belopp?.toLocaleString('sv-SE')} kr</Text>
                </View>
              </View>
              {item.foretagNamn && (
                <Text style={styles.foretag}>Företag: {item.foretagNamn}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filter: { backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  datumInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  filterKnapp: { backgroundColor: '#2563eb', borderRadius: 8, padding: 10, alignItems: 'center' },
  filterKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  lista: { padding: 16, paddingBottom: 32 },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 15 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kortHuvud: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  namn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  telefon: { fontSize: 13, color: '#888', marginTop: 1 },
  datum: { fontSize: 13, color: '#999' },
  kortDetaljer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detalj: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, alignItems: 'center' },
  detaljEtikett: { fontSize: 11, color: '#888', marginBottom: 4 },
  detaljVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalText: { color: '#2563eb' },
  foretag: { fontSize: 12, color: '#aaa' },
  summering: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#e0e7ff' },
  summeringRad: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summeringEtikett: { fontSize: 14, color: '#555' },
  summeringVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalRad: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 4 },
  totalEtikett: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  totalVärde: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
});
