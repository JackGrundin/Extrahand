import { useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

function grupperaPerMånad(pass) {
  const grupper = {};
  pass.forEach(p => {
    const datum = new Date(p.created_at);
    const nyckel = datum.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
    if (!grupper[nyckel]) grupper[nyckel] = [];
    grupper[nyckel].push(p);
  });
  return Object.entries(grupper).map(([titel, data]) => ({ titel, data }));
}

export default function MinaPassScreen({ navigation }) {
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [aktivFlik, setAktivFlik] = useState('kommande');

  async function hämta() {
    try {
      const data = await api.minaAnsökningar();
      setAnsökningar(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  const godkända = ansökningar.filter(a => a.status === 'godkänd');
  const kommande = godkända.filter(a => !(a.timmar > 0));
  const genomförda = godkända.filter(a => a.timmar > 0);

  const sektioner = grupperaPerMånad(aktivFlik === 'kommande' ? kommande : genomförda);

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.flikar}>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'kommande' && styles.flikAktiv]}
          onPress={() => setAktivFlik('kommande')}
          activeOpacity={0.8}
        >
          <Text style={[styles.flikText, aktivFlik === 'kommande' && styles.flikTextAktiv]}>
            Kommande ({kommande.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'genomförda' && styles.flikAktiv]}
          onPress={() => setAktivFlik('genomförda')}
          activeOpacity={0.8}
        >
          <Text style={[styles.flikText, aktivFlik === 'genomförda' && styles.flikTextAktiv]}>
            Genomförda ({genomförda.length})
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sektioner}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.månadRubrik}>{section.titel.toUpperCase()}</Text>
        )}
        ListEmptyComponent={
          <View style={styles.tomContainer}>
            <Text style={styles.tomText}>
              {aktivFlik === 'kommande'
                ? 'Inga kommande pass'
                : 'Inga genomförda pass ännu'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const datum = new Date(item.created_at);
          const dagText = datum.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <TouchableOpacity
              style={styles.kort}
              onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.datumRad}>
                <View style={styles.datumBricka}>
                  <Text style={styles.datumDag}>{datum.getDate()}</Text>
                  <Text style={styles.datumMån}>{datum.toLocaleDateString('sv-SE', { month: 'short' })}</Text>
                </View>
                <View style={styles.passInfo}>
                  <Text style={styles.passTitel} numberOfLines={1}>{item.jobbTitel ?? 'Jobb'}</Text>
                  <Text style={styles.passForetag} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
                  <View style={styles.passDetaljer}>
                    {item.antalDagar != null && (
                      <Text style={styles.passDetalj}>{item.antalDagar} dag{item.antalDagar !== 1 ? 'ar' : ''}</Text>
                    )}
                    {item.arbetstider ? (
                      <Text style={styles.passDetalj}>{item.arbetstider}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <Text style={styles.chattLänk}>Öppna chatt →</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flikar: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  flik: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  flikAktiv: { backgroundColor: '#2563eb' },
  flikText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  flikTextAktiv: { color: '#fff' },

  lista: { padding: 16, paddingBottom: 32 },
  månadRubrik: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginTop: 16, marginBottom: 8 },

  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datumRad: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  datumBricka: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  datumDag: { fontSize: 18, fontWeight: '700', color: '#2563eb', lineHeight: 22 },
  datumMån: { fontSize: 10, color: '#2563eb', fontWeight: '600', textTransform: 'uppercase' },
  passInfo: { flex: 1 },
  passTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  passForetag: { fontSize: 13, color: '#888', marginTop: 2 },
  passDetaljer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  passDetalj: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  timmarBricka: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timmarText: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },

  tomContainer: { alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
});
