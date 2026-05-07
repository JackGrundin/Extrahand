import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

function ProfilSektion({ rubrik, innehall }) {
  if (!innehall) return null;
  return (
    <View style={styles.sektion}>
      <Text style={styles.sektionsRubrik}>{rubrik}</Text>
      <Text style={styles.sektionsText}>{innehall}</Text>
    </View>
  );
}

export default function ProfilScreen({ navigation }) {
  const { användare, loggaUt } = useAuth();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const [betyg, setBetyg] = useState(null);
  const [profil, setProfil] = useState(null);
  const [laddar, setLaddar] = useState(true);

  async function hämta() {
    try {
      const [profilData, betygData] = await Promise.all([
        api.hämtaProfil(),
        användare?.id ? api.hämtaBetyg(användare.id) : null,
      ]);
      setProfil(profilData);
      if (betygData) setBetyg(betygData);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.innehall}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{användare?.namn?.[0]?.toUpperCase()}</Text>
      </View>

      <Text style={styles.namn}>{användare?.namn}</Text>
      <Text style={styles.email}>{användare?.email}</Text>

      <View style={styles.typBadge}>
        <Text style={styles.typText}>
          {ärPrivatperson ? 'Privatperson' : 'Företag'}
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

      {ärPrivatperson && (
        <>
          <TouchableOpacity
            style={styles.redigeraKnapp}
            onPress={() => navigation.navigate('RedigeraProfil', { profil })}
          >
            <Ionicons name="create-outline" size={18} color="#2563eb" />
            <Text style={styles.redigeraText}>Redigera profil</Text>
          </TouchableOpacity>

          <ProfilSektion rubrik="CV / Om mig" innehall={profil?.cv} />
          <ProfilSektion rubrik="Tidigare erfarenheter" innehall={profil?.erfarenheter} />
          <ProfilSektion rubrik="Kompetenser" innehall={profil?.kompetenser} />
          <ProfilSektion rubrik="Intressen" innehall={profil?.intressen} />

          {!profil?.cv && !profil?.erfarenheter && !profil?.kompetenser && !profil?.intressen && (
            <Text style={styles.tomProfil}>Fyll i ditt CV och erfarenheter för att sticka ut när du söker jobb.</Text>
          )}
        </>
      )}

      <TouchableOpacity style={styles.loggaUtKnapp} onPress={loggaUt}>
        <Text style={styles.loggaUtText}>Logga ut</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  innehall: { alignItems: 'center', padding: 32, paddingBottom: 48 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  namn: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 15, color: '#666', marginBottom: 12 },
  typBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  typText: { color: '#2563eb', fontWeight: '600' },
  betygRad: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
  betygSnitt: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  betygAntal: { fontSize: 14, color: '#888' },
  ingetBetyg: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  redigeraKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginBottom: 24 },
  redigeraText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  sektion: { width: '100%', marginBottom: 20 },
  sektionsRubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sektionsText: { fontSize: 15, color: '#333', lineHeight: 22 },
  tomProfil: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  loggaUtKnapp: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  loggaUtText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
