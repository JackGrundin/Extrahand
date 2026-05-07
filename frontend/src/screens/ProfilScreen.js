import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

export default function ProfilScreen() {
  const { användare, loggaUt } = useAuth();
  const [betyg, setBetyg] = useState(null);

  useEffect(() => {
    if (användare?.id) {
      api.hämtaBetyg(användare.id)
        .then(setBetyg)
        .catch(console.error);
    }
  }, [användare?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{användare?.namn?.[0]?.toUpperCase()}</Text>
      </View>

      <Text style={styles.namn}>{användare?.namn}</Text>
      <Text style={styles.email}>{användare?.email}</Text>

      <View style={styles.typBadge}>
        <Text style={styles.typText}>
          {användare?.typ === 'företag' ? 'Företag' : 'Privatperson'}
        </Text>
      </View>

      {betyg && betyg.antal > 0 ? (
        <View style={styles.betygRad}>
          <Ionicons name="star" size={18} color="#f59e0b" />
          <Text style={styles.betygSnitt}>{betyg.snitt.toFixed(1)}</Text>
          <Text style={styles.betygAntal}>({betyg.antal} betyg)</Text>
        </View>
      ) : (
        <Text style={styles.ingetBetyg}>Inga betyg ännu</Text>
      )}

      <TouchableOpacity
        style={styles.testKnapp}
        onPress={() =>
          api.testaNotifikation()
            .then(() => Alert.alert('Skickat!', 'Kolla om notifikationen dyker upp.'))
            .catch((fel) => Alert.alert('Fel', fel.message))
        }
      >
        <Text style={styles.testText}>Testa notifikation</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loggaUtKnapp} onPress={loggaUt}>
        <Text style={styles.loggaUtText}>Logga ut</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  namn: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 15, color: '#666', marginBottom: 12 },
  typBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  typText: { color: '#2563eb', fontWeight: '600' },
  betygRad: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 32 },
  betygSnitt: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  betygAntal: { fontSize: 14, color: '#888' },
  ingetBetyg: { fontSize: 14, color: '#aaa', marginBottom: 32 },
  testKnapp: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 40, marginBottom: 12 },
  testText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  loggaUtKnapp: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  loggaUtText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
