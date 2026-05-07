import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfilScreen() {
  const { användare, loggaUt } = useAuth();

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
  typBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 40 },
  typText: { color: '#2563eb', fontWeight: '600' },
  loggaUtKnapp: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  loggaUtText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
