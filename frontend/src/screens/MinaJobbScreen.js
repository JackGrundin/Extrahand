import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

export default function MinaJobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function taBort(id) {
    Alert.alert('Ta bort annons', 'Är du säker? Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: async () => {
        try {
          await api.taBortJobb(id);
          setJobb(prev => prev.filter(j => j.id !== id));
        } catch (fel) {
          Alert.alert('Fel', fel.message);
        }
      }},
    ]);
  }

  async function hämta() {
    try {
      const data = await api.minaJobb();
      setJobb(data);
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
      data={jobb}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={
        <View style={styles.tomContainer}>
          <Text style={styles.tomText}>Du har inte publicerat några jobb ännu</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.kort}
          onPress={() => navigation.navigate('JobbAnsokningar', { jobbId: item.id, titel: item.Titel })}
        >
          <View style={styles.kortHuvud}>
            <Text style={styles.titel} numberOfLines={1}>{item.Titel}</Text>
            <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
          </View>
          <Text style={styles.info}>{item.Plats ? `${item.Plats} · ` : ''}{item.Typ}</Text>
          {(item.antal_dagar != null || item.arbetstider) && (
            <View style={styles.extraRad}>
              {item.antal_dagar != null && <Text style={styles.extra}>{item.antal_dagar} dagar</Text>}
              {item.arbetstider ? <Text style={styles.extra}>{item.arbetstider}</Text> : null}
            </View>
          )}
          <View style={styles.kortBotten}>
            <Text style={styles.seAnsokningar}>Se ansökningar →</Text>
            <View style={styles.åtgärder}>
              <TouchableOpacity onPress={() => navigation.navigate('RedigeraJobb', { jobb: item })}>
                <Text style={styles.redigeraText}>Redigera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => taBort(item.id)}>
                <Text style={styles.taBortText}>Ta bort</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  titel: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  datum: { fontSize: 13, color: '#999', marginLeft: 8 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  extraRad: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  extra: { fontSize: 13, color: '#888' },
  kortBotten: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  seAnsokningar: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  åtgärder: { flexDirection: 'row', gap: 16 },
  redigeraText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  taBortText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
  tomContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
});
