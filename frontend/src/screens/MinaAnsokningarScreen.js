import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

export default function MinaAnsokningarScreen({ navigation }) {
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

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

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <FlatList
      style={styles.lista}
      data={ansökningar}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={
        <View style={styles.tomContainer}>
          <Text style={styles.tomText}>Du har inte sökt några jobb ännu</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.kort}
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
        >
          <View style={styles.kortHuvud}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobbTitel} numberOfLines={1}>
                {item.foretagNamn ?? 'Okänt företag'}
              </Text>
              <Text style={styles.foretagNamn} numberOfLines={1}>
                {item.jobbTitel ?? ''}
              </Text>
            </View>
            <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
          </View>
          {item.meddelande ? (
            <Text style={styles.meddelande} numberOfLines={2}>{item.meddelande}</Text>
          ) : (
            <Text style={styles.ingetMeddelande}>Ingen ansökningsttext</Text>
          )}
          {item.timmar > 0 && (
            <Text style={styles.timmar}>{item.timmar} tim loggade</Text>
          )}
          <Text style={styles.chattLänk}>Öppna chatt →</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  jobbTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  foretagNamn: { fontSize: 13, color: '#888', marginTop: 2 },
  datum: { fontSize: 13, color: '#999', marginLeft: 8 },
  meddelande: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 10 },
  ingetMeddelande: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 10 },
  timmar: { fontSize: 13, color: '#059669', fontWeight: '500', marginBottom: 6 },
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  tomContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
});
