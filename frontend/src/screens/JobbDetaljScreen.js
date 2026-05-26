import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

export default function JobbDetaljScreen({ route, navigation }) {
  const { jobb } = route.params;
  const { användare } = useAuth();
  const [laddar, setLaddar] = useState(false);
  const [sökt, setSökt] = useState(false);
  const [meddelande, setMeddelande] = useState('');
  const [avtalsModalSynlig, setAvtalsModalSynlig] = useState(false);

  async function hanteraSökan() {
    if (!användare?.avtalGodkant) {
      setAvtalsModalSynlig(true);
      return;
    }
    setLaddar(true);
    try {
      await api.sökaJobb(jobb.id, { meddelande: meddelande.trim() || null });
      setSökt(true);
      Alert.alert('Klart!', 'Din ansökan har skickats.');
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      {jobb.foretagNamn && <Text style={styles.foretagNamn}>{jobb.foretagNamn}</Text>}
      <Text style={styles.titel}>{jobb.Titel}</Text>
      <Text style={styles.info}>{jobb.Plats} · {jobb.Typ}</Text>
      {jobb.Lon && <Text style={styles.lön}>{jobb.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
      <View style={styles.detaljerRad}>
        {jobb.antal_dagar != null && <Text style={styles.detalj}>{jobb.antal_dagar} dagar</Text>}
        {jobb.arbetstider ? <Text style={styles.detalj}>{jobb.arbetstider}</Text> : null}
      </View>

      <Text style={styles.sektionsRubrik}>Beskrivning</Text>
      <Text style={styles.beskrivning}>{jobb.Beskrivning}</Text>

      {användare?.typ === 'företag' && (
        <TouchableOpacity
          style={styles.sekundärKnapp}
          onPress={() => navigation.navigate('JobbAnsokningar', { jobbId: jobb.id, titel: jobb.Titel })}
        >
          <Text style={styles.sekundärKnappText}>Se ansökningar</Text>
        </TouchableOpacity>
      )}

      {användare?.typ === 'privatperson' && (jobb.Foretag_id ?? jobb.foretag_id) && (
        <TouchableOpacity
          style={styles.sekundärKnapp}
          onPress={() => navigation.navigate('FöretagsProfil', { foretagId: jobb.Foretag_id ?? jobb.foretag_id })}
        >
          <Text style={styles.sekundärKnappText}>Om företaget</Text>
        </TouchableOpacity>
      )}

      {användare?.typ === 'privatperson' && (
        <>
          {!sökt && (
            <>
              <Text style={styles.sektionsRubrik}>Ansökningstext</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Berätta kort varför du passar för jobbet... (valfritt)"
                value={meddelande}
                onChangeText={setMeddelande}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </>
          )}
          <TouchableOpacity
            style={[styles.knapp, sökt && styles.knappInaktiv]}
            onPress={hanteraSökan}
            disabled={laddar || sökt}
          >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.knappText}>{sökt ? 'Ansökan skickad' : 'Sök jobbet'}</Text>
          }
        </TouchableOpacity>
        </>
      )}
    </ScrollView>

      <Modal visible={avtalsModalSynlig} transparent animationType="fade" onRequestClose={() => setAvtalsModalSynlig(false)}>
        <View style={styles.modalBakgrund}>
          <View style={styles.modalKort}>
            <Text style={styles.modalRubrik}>Avtal krävs</Text>
            <Text style={styles.modalText}>
              Du behöver skriva på ett anställningsavtal innan du kan ansöka om jobb. Vi skickar avtalet till din mejl inom kort.
            </Text>
            <TouchableOpacity style={styles.modalKnapp} onPress={() => setAvtalsModalSynlig(false)}>
              <Text style={styles.modalKnappText}>Stäng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  foretagNamn: { fontSize: 15, color: '#2563eb', fontWeight: '600', marginBottom: 4 },
  titel: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  info: { fontSize: 15, color: '#666', marginBottom: 4 },
  lön: { fontSize: 16, color: '#2563eb', fontWeight: '600', marginBottom: 8 },
  detaljerRad: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  detalj: { fontSize: 14, color: '#666' },
  sektionsRubrik: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  beskrivning: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 32 },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', minHeight: 110, marginBottom: 16 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  knappInaktiv: { backgroundColor: '#9ca3af' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  sekundärKnapp: { borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  sekundärKnappText: { color: '#2563eb', fontWeight: '600', fontSize: 16 },
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalKort: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  modalText: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 24 },
  modalKnapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalKnappText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
