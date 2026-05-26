import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [laddaUppBild, setLaddaUppBild] = useState(false);

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

  async function väljaProfilBild() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Tillstånd saknas', 'Appen behöver tillgång till ditt bildbibliotek.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;

    setLaddaUppBild(true);
    try {
      const { url } = await api.laddaUppProfilBild(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setProfil(prev => ({ ...prev, profilBild: url }));
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddaUppBild(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.innehall}>
      <TouchableOpacity onPress={väljaProfilBild} style={styles.avatarWrapper} disabled={laddaUppBild}>
        {profil?.profilBild ? (
          <Image source={{ uri: profil.profilBild }} style={styles.profilBild} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{användare?.namn?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.kameraIkon}>
          {laddaUppBild
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="camera" size={14} color="#fff" />
          }
        </View>
      </TouchableOpacity>

      <Text style={styles.namn}>{användare?.namn}</Text>
      <Text style={styles.email}>{användare?.email}</Text>

      <View style={styles.typBadge}>
        <Text style={styles.typText}>{ärPrivatperson ? 'Privatperson' : 'Företag'}</Text>
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

      {ärPrivatperson && profil?.totalTimmar > 0 && (
        <View style={styles.timmArBadge}>
          <Ionicons name="time-outline" size={16} color="#059669" />
          <Text style={styles.timmArText}>{profil.totalTimmar} jobbade timmar</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.redigeraKnapp}
        onPress={() => navigation.navigate('RedigeraProfil', { profil })}
      >
        <Ionicons name="create-outline" size={18} color="#2563eb" />
        <Text style={styles.redigeraText}>Redigera profil</Text>
      </TouchableOpacity>

      {ärPrivatperson && (
        <>
          <ProfilSektion rubrik="CV / Om mig" innehall={profil?.cv} />
          <ProfilSektion rubrik="Tidigare erfarenheter" innehall={profil?.erfarenheter} />
          <ProfilSektion rubrik="Kompetenser" innehall={profil?.kompetenser} />
          <ProfilSektion rubrik="Intressen" innehall={profil?.intressen} />

          {!profil?.cv && !profil?.erfarenheter && !profil?.kompetenser && !profil?.intressen && (
            <Text style={styles.tomProfil}>Fyll i ditt CV och erfarenheter för att sticka ut när du söker jobb.</Text>
          )}
        </>
      )}

      {!ärPrivatperson && (
        <>
          <ProfilSektion rubrik="Om företaget" innehall={profil?.beskrivning} />
          <ProfilSektion rubrik="Bransch" innehall={profil?.bransch} />
          <ProfilSektion rubrik="Stad" innehall={profil?.stad} />
          <ProfilSektion rubrik="Hemsida" innehall={profil?.hemsida} />
        </>
      )}

      {ärPrivatperson && betyg && betyg.antal > 0 && (
            <View style={styles.betygSektion}>
              <Text style={styles.betygSektionsRubrik}>Betyg från arbetsgivare</Text>
              {betyg.betyg.map((b, i) => (
                <View key={i} style={styles.betygKort}>
                  <View style={styles.betygKortHuvud}>
                    <View style={styles.stjärnRad}>
                      {[1,2,3,4,5].map(n => (
                        <Ionicons key={n} name={n <= b.stjarnor ? 'star' : 'star-outline'} size={14} color="#f59e0b" />
                      ))}
                    </View>
                    <Text style={styles.betygDatum}>{new Date(b.created_at).toLocaleDateString('sv-SE')}</Text>
                  </View>
                  {b.företagNamn && <Text style={styles.betygFöretag}>{b.företagNamn}</Text>}
                  {b.kommentar && <Text style={styles.betygKommentar}>{b.kommentar}</Text>}
                </View>
              ))}
            </View>
          )}

      <TouchableOpacity style={styles.loggaUtKnapp} onPress={loggaUt}>
        <Text style={styles.loggaUtText}>Logga ut</Text>
      </TouchableOpacity>

      <Text style={styles.appNamn}>FastGig</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  innehall: { alignItems: 'center', padding: 32, paddingBottom: 48 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  profilBild: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  kameraIkon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  namn: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 15, color: '#666', marginBottom: 12 },
  typBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  typText: { color: '#2563eb', fontWeight: '600' },
  betygRad: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  betygSnitt: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  betygAntal: { fontSize: 14, color: '#888' },
  ingetBetyg: { fontSize: 14, color: '#aaa', marginBottom: 12 },
  timmArBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 20 },
  timmArText: { fontSize: 14, color: '#059669', fontWeight: '600' },
  redigeraKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginBottom: 24 },
  redigeraText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  sektion: { width: '100%', marginBottom: 20 },
  sektionsRubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sektionsText: { fontSize: 15, color: '#333', lineHeight: 22 },
  tomProfil: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  betygSektion: { width: '100%', marginTop: 8 },
  betygSektionsRubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  betygKort: { backgroundColor: '#fafafa', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  betygKortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stjärnRad: { flexDirection: 'row', gap: 2 },
  betygDatum: { fontSize: 12, color: '#aaa' },
  betygFöretag: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  betygKommentar: { fontSize: 14, color: '#444', lineHeight: 20 },
  loggaUtKnapp: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  loggaUtText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
  appNamn: { marginTop: 32, fontSize: 13, fontWeight: '700', color: '#d1d5db', letterSpacing: 1 },
});
