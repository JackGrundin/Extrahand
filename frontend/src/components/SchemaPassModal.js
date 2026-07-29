import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TidVäljare from './TidVäljare';
import DatumVäljare from './DatumVäljare';
import ObRedigerare from './ObRedigerare';
import { normalisera } from '../utils/konstanter';

// Lägg till eller redigera ETT schemapass. Ett pass har datum, två tider, en roll och en
// egen OB-lista – inline i formuläret gånger tjugo pass blir det oanvändbart, så passet
// redigeras här och listan i formuläret visar bara kompakta sammanfattningsrader.
//
// Kategorin är FRI TEXT. Företaget namnger sina egna avdelningar ("Liftvärd", "Garderob")
// och är inte bundet till KATEGORIER-listan. Förslagen är bara en genväg: företagets egna
// tidigare roller först, sedan standardkategorierna.
export default function SchemaPassModal({
  visible,
  onStäng,
  onSpara,
  initialPass,
  egnaKategorier = [],
  standardKategorier = [],
  timlön = 0,
  paslag,
  rubrik = 'Nytt pass',
}) {
  const [datum, setDatum] = useState('');
  const [starttid, setStarttid] = useState('');
  const [sluttid, setSluttid] = useState('');
  const [kategori, setKategori] = useState('');
  const [obTillagg, setObTillagg] = useState([]);

  // Fylls om varje gång modalen öppnas. initialPass bär antingen passet som redigeras
  // eller det förifyllda innehållet från "Kopiera föregående".
  useEffect(() => {
    if (!visible) return;
    setDatum(initialPass?.datum ?? '');
    setStarttid(initialPass?.starttid ?? '');
    setSluttid(initialPass?.sluttid ?? '');
    setKategori(initialPass?.kategori ?? '');
    setObTillagg(Array.isArray(initialPass?.ob_tillagg) ? initialPass.ob_tillagg : []);
  }, [visible, initialPass]);

  // Egna kategorier först – de är nästan alltid det företaget vill ha – sedan
  // standardlistan, filtrerad på det som skrivits. Diakritokänsligt via normalisera.
  const sökterm = normalisera(kategori);
  const förslag = [
    ...egnaKategorier,
    ...standardKategorier.filter(k => !egnaKategorier.includes(k)),
  ]
    .filter(k => sökterm.length === 0 || normalisera(k).includes(sökterm))
    .filter(k => normalisera(k) !== sökterm)
    .slice(0, 6);

  function spara() {
    if (!datum) return Alert.alert('Fel', 'Välj ett datum för passet.');
    if (!starttid || !sluttid) return Alert.alert('Fel', 'Ange både start- och sluttid.');
    onSpara({
      datum,
      starttid,
      sluttid,
      kategori: kategori.trim() || null,
      ob_tillagg: obTillagg,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onStäng}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onStäng} />
        <View style={styles.panel}>
          <View style={styles.handtag} />
          <Text style={styles.rubrik}>{rubrik}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.etikett}>Datum *</Text>
            <DatumVäljare värde={datum} onÄndra={setDatum} minimumDate={new Date()} />

            <Text style={styles.etikett}>Tider *</Text>
            <View style={styles.tidRad}>
              <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={starttid} onChange={setStarttid} />
              <Text style={styles.streck}>–</Text>
              <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={sluttid} onChange={setSluttid} />
            </View>

            <Text style={styles.etikett}>Roll / avdelning</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Liftvärd"
              value={kategori}
              onChangeText={setKategori}
              maxLength={40}
              autoCorrect={false}
            />
            {förslag.length > 0 && (
              <View style={styles.chipRad}>
                {förslag.map(k => (
                  <TouchableOpacity key={k} style={styles.chip} onPress={() => setKategori(k)} activeOpacity={0.7}>
                    <Text style={styles.chipText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.hjälp}>
              Egen text går bra – rollen visas i schemat och i kalendern.
            </Text>

            <View style={{ marginTop: 16 }}>
              <ObRedigerare
                värde={obTillagg}
                onÄndra={setObTillagg}
                timlön={timlön}
                paslag={paslag}
                rubrik="OB-tillägg för det här passet"
              />
            </View>

            <View style={styles.knappRad}>
              <TouchableOpacity style={styles.avbryt} onPress={onStäng}>
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spara} onPress={spara}>
                <Ionicons name="checkmark" size={17} color="#fff" />
                <Text style={styles.sparaText}>Spara pass</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, maxHeight: '88%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  rubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },

  etikett: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  tidRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streck: { fontSize: 16, color: '#9ca3af' },

  chipRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  knappRad: { flexDirection: 'row', gap: 10, marginTop: 22 },
  avbryt: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  avbrytText: { fontSize: 15, color: '#666', fontWeight: '600' },
  spara: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  sparaText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
