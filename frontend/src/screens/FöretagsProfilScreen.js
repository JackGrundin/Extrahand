import { useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

export default function FöretagsProfilScreen({ route, navigation }) {
  const { foretagId } = route.params;
  const [profil, setProfil] = useState(null);
  const [laddar, setLaddar] = useState(true);

  useFocusEffect(useCallback(() => {
    async function hämta() {
      try {
        const data = await api.hämtaAnvändareProfil(foretagId);
        setProfil(data);
      } catch (fel) {
        console.error(fel);
      } finally {
        setLaddar(false);
      }
    }
    hämta();
  }, [foretagId]));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!profil) return null;

  function öppnaHemsida() {
    let url = profil.hemsida;
    if (!url.startsWith('http')) url = 'https://' + url;
    Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.huvud}>
        {profil.profilBild
          ? <Image source={{ uri: profil.profilBild }} style={styles.logga} />
          : <View style={styles.loggaPlaceholder}><Text style={styles.loggaInitial}>{profil.namn?.[0] ?? '?'}</Text></View>
        }
        <Text style={styles.namn}>{profil.namn}</Text>
        {profil.bransch && <Text style={styles.bransch}>{profil.bransch}</Text>}
        {profil.stad && <Text style={styles.meta}>{profil.stad}</Text>}
        {profil.hemsida && (
          <TouchableOpacity onPress={öppnaHemsida}>
            <Text style={styles.hemsida}>{profil.hemsida}</Text>
          </TouchableOpacity>
        )}
      </View>

      {profil.beskrivning && (
        <View style={styles.sektion}>
          <Text style={styles.sektionsRubrik}>Om företaget</Text>
          <Text style={styles.beskrivning}>{profil.beskrivning}</Text>
        </View>
      )}

      <View style={styles.sektion}>
        <Text style={styles.sektionsRubrik}>Aktiva annonser</Text>
        {profil.aktivaJobb?.length > 0 ? profil.aktivaJobb.map(jobb => (
          <TouchableOpacity
            key={jobb.id}
            style={styles.jobbKort}
            onPress={() => navigation.navigate('JobbDetalj', { jobb: { ...jobb, foretagNamn: profil.namn } })}
          >
            <Text style={styles.jobbTitel}>{jobb.Titel}</Text>
            <Text style={styles.jobbMeta}>{jobb.Plats} · {jobb.Typ}</Text>
            {jobb.Lon && <Text style={styles.jobbLön}>{jobb.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
          </TouchableOpacity>
        )) : (
          <Text style={styles.ingaJobb}>Inga aktiva annonser just nu</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  huvud: { backgroundColor: '#fff', alignItems: 'center', padding: 28, marginBottom: 12 },
  logga: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  loggaPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  loggaInitial: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  namn: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  bransch: { fontSize: 15, color: '#2563eb', fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 14, color: '#888', marginBottom: 2 },
  hemsida: { fontSize: 14, color: '#2563eb', marginTop: 4, textDecorationLine: 'underline' },
  sektion: { backgroundColor: '#fff', padding: 20, marginBottom: 12 },
  sektionsRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  beskrivning: { fontSize: 15, color: '#444', lineHeight: 22 },
  jobbKort: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  jobbTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  jobbMeta: { fontSize: 13, color: '#888', marginBottom: 2 },
  jobbLön: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  ingaJobb: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
});
