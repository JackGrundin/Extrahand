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
      const data = ärFöretag
        ? await api.företagsKonversationer()
        : await api.minaAnsökningar();
      setPoster(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  const STATUSFÄRGER = {
    godkänd: { bg: '#dcfce7', text: '#16a34a' },
    avvisad: { bg: '#fee2e2', text: '#dc2626' },
    väntande: { bg: '#f3f4f6', text: '#6b7280' },
  };

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <FlatList
      style={styles.lista}
      data={poster}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      ListEmptyComponent={<Text style={styles.tom}>Inga aktiva chattar</Text>}
      renderItem={({ item }) => {
        const rubrik = ärFöretag ? (item.sökandeNamn ?? 'Okänd') : (item.foretagNamn ?? 'Okänt företag');
        const underRubrik = item.jobbTitel ?? '';
        const initial = rubrik[0]?.toUpperCase() ?? '?';
        const status = item.status ?? 'väntande';
        const statusFärg = STATUSFÄRGER[status];

        return (
          <TouchableOpacity
            style={styles.kort}
            onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
          >
            <View style={styles.kortHuvud}>
              <View style={styles.avatarBlå}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.titel} numberOfLines={1}>{rubrik}</Text>
                <Text style={styles.underTitel} numberOfLines={1}>{underRubrik}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusFärg.bg }]}>
                  <Text style={[styles.statusText, { color: statusFärg.text }]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
            {item.meddelande
              ? <Text style={styles.förhandsgranskning} numberOfLines={2}>{item.meddelande}</Text>
              : <Text style={styles.inget}>Ingen ansökningstext</Text>
            }
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarBlå: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 18 },
  titel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  underTitel: { fontSize: 13, color: '#888', marginTop: 2 },
  datum: { fontSize: 12, color: '#aaa' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  förhandsgranskning: { fontSize: 14, color: '#555', lineHeight: 20 },
  inget: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
