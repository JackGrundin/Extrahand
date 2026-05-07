import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

export default function ChattListaScreen({ navigation }) {
  const { användare } = useAuth();
  const ärFöretag = användare?.typ === 'företag';

  const [poster, setPoster] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function hämta() {
    try {
      if (ärFöretag) {
        // Företag: hämta alla jobb och filtrera på egna
        const allaJobb = await api.hämtaJobb();
        const minaJobb = allaJobb.filter((j) => j.Foretag_id === användare.id);
        // Hämta ansökningsantal för varje jobb parallellt
        const jobbMedAntal = await Promise.all(
          minaJobb.map(async (j) => {
            const ansökningar = await api.ansökningarFörJobb(j.id);
            return { ...j, antalAnsökningar: ansökningar.length, ansökningar };
          })
        );
        setPoster(jobbMedAntal.filter((j) => j.antalAnsökningar > 0));
      } else {
        // Privatperson: hämta egna ansökningar
        const ansökningar = await api.minaAnsökningar();
        setPoster(ansökningar);
      }
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  if (ärFöretag) {
    return (
      <FlatList
        style={styles.lista}
        data={poster}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga aktiva konversationer</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.kort}
            onPress={() => navigation.navigate('JobbAnsokningar', { jobbId: item.id, titel: item.Titel })}
          >
            <View style={styles.kortHuvud}>
              <Text style={styles.titel} numberOfLines={1}>{item.Titel}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.antalAnsökningar}</Text>
              </View>
            </View>
            <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
            <Text style={styles.länk}>Visa ansökningar →</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <FlatList
      style={styles.lista}
      data={poster}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={<Text style={styles.tom}>Inga aktiva chattar</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.kort}
          onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
        >
          <View style={styles.kortHuvud}>
            <View style={styles.avatarBlå}>
              <Text style={styles.avatarText}>J</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.titel}>Jobbansökan</Text>
              <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
            </View>
          </View>
          {item.meddelande
            ? <Text style={styles.förhandsgranskning} numberOfLines={2}>{item.meddelande}</Text>
            : <Text style={styles.inget}>Ingen ansökningstext</Text>
          }
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  titel: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  info: { fontSize: 13, color: '#888', marginBottom: 8 },
  badge: { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  badgeText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  länk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  avatarBlå: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 18 },
  datum: { fontSize: 12, color: '#aaa', marginTop: 2 },
  förhandsgranskning: { fontSize: 14, color: '#555', lineHeight: 20 },
  inget: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
