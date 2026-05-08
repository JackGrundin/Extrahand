import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';

function Sektion({ rubrik, innehall }) {
  if (!innehall) return null;
  return (
    <View style={styles.sektion}>
      <Text style={styles.sektionsRubrik}>{rubrik}</Text>
      <Text style={styles.sektionsText}>{innehall}</Text>
    </View>
  );
}

export default function SökandeProfilScreen({ route, navigation }) {
  const { sokandeId, ansokningId } = route.params;
  const [profil, setProfil] = useState(null);
  const [betyg, setBetyg] = useState(null);
  const [laddar, setLaddar] = useState(true);

  useEffect(() => {
    async function hämta() {
      try {
        const [profilData, betygData] = await Promise.all([
          api.hämtaAnvändareProfil(sokandeId),
          api.hämtaBetyg(sokandeId),
        ]);
        setProfil(profilData);
        setBetyg(betygData);
      } catch (fel) {
        console.error(fel);
      } finally {
        setLaddar(false);
      }
    }
    hämta();
  }, [sokandeId]);

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!profil) return (
    <View style={styles.fel}>
      <Text style={styles.felText}>Kunde inte ladda profilen.</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.innehall}>
      {profil.profilBild ? (
        <Image source={{ uri: profil.profilBild }} style={styles.profilBild} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profil.namn?.[0]?.toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.namn}>{profil.namn}</Text>

      {betyg && betyg.antal > 0 ? (
        <View style={styles.betygRad}>
          <Ionicons name="star" size={18} color="#f59e0b" />
          <Text style={styles.betygSnitt}>{betyg.snitt.toFixed(1)}</Text>
          <Text style={styles.betygAntal}>({betyg.antal} betyg)</Text>
        </View>
      ) : (
        <Text style={styles.ingetBetyg}>Inga betyg ännu</Text>
      )}

      {profil.totalTimmar > 0 && (
        <View style={styles.timmArBadge}>
          <Ionicons name="time-outline" size={16} color="#059669" />
          <Text style={styles.timmArText}>{profil.totalTimmar} jobbade timmar</Text>
        </View>
      )}

      <View style={styles.divider} />

      {!profil.cv && !profil.erfarenheter && !profil.kompetenser && !profil.intressen ? (
        <Text style={styles.tomProfil}>Den här personen har inte fyllt i sin profil än.</Text>
      ) : (
        <>
          <Sektion rubrik="CV / Om mig" innehall={profil.cv} />
          <Sektion rubrik="Tidigare erfarenheter" innehall={profil.erfarenheter} />
          <Sektion rubrik="Kompetenser" innehall={profil.kompetenser} />
          <Sektion rubrik="Intressen" innehall={profil.intressen} />
        </>
      )}

      {ansokningId && (
        <TouchableOpacity
          style={styles.chattKnapp}
          onPress={() => navigation.navigate('Chatt', { ansokningId })}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.chattKnappText}>Öppna chatt</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  innehall: { alignItems: 'center', padding: 32, paddingBottom: 48 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  profilBild: { width: 88, height: 88, borderRadius: 44, marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  namn: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  betygRad: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  betygSnitt: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  betygAntal: { fontSize: 14, color: '#888' },
  ingetBetyg: { fontSize: 14, color: '#aaa', marginBottom: 12 },
  timmArBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 16 },
  timmArText: { fontSize: 14, color: '#059669', fontWeight: '600' },
  divider: { width: '100%', height: 1, backgroundColor: '#f0f0f0', marginVertical: 20 },
  sektion: { width: '100%', marginBottom: 20 },
  sektionsRubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sektionsText: { fontSize: 15, color: '#333', lineHeight: 22 },
  tomProfil: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22 },
  chattKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24 },
  chattKnappText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fel: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  felText: { color: '#999', fontSize: 16 },
});
