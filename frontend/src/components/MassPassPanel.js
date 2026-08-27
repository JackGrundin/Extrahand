import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PassDetaljFält from './PassDetaljFält';

// Panelen som skriver tider, roll och OB till FLERA markerade pass på en gång.
//
// Håller sitt eget utkast i stället för att peka på ett riktigt pass: fälten börjar tomma
// och ett tomt fält betyder "rör inte det här" (se tillämpaPåMarkerade i utils/schemaPass.js).
// Skulle panelen förifyllas från något av de markerade passen vore det omöjligt att se vad
// som faktiskt kommer att skrivas över.
//
// Ligger utanför skärmens ScrollView, sist i samma flex-kolumn, så den stannar kvar medan
// man scrollar i passlistan och kryssar i fler rader. Inte absolut positionerad – då hade
// den lagt sig över stegnavigeringen och stängt in användaren.
export default function MassPassPanel({
  antal,
  onTillämpa,
  onRensaMarkering,
  egnaKategorier,
  standardKategorier,
  timlön,
  paslag,
}) {
  const [starttid, setStarttid] = useState('');
  const [sluttid, setSluttid] = useState('');
  const [kategori, setKategori] = useState('');
  const [obTillagg, setObTillagg] = useState([]);
  const [utfällt, setUtfällt] = useState(true);

  function nollställ() {
    setStarttid('');
    setSluttid('');
    setKategori('');
    setObTillagg([]);
  }

  const harNågot = Boolean(starttid || sluttid || kategori.trim() || obTillagg.length);

  function tillämpa({ rensaOb = false } = {}) {
    onTillämpa({ starttid, sluttid, kategori, ob_tillagg: obTillagg }, { rensaOb });
    // Markeringen behålls med flit – man sätter ofta roll först och OB sedan. Utkastet
    // nollställs däremot, annars ser det ut som om värdena ligger kvar och väntar.
    nollställ();
  }

  return (
    <View style={styles.panel}>
      <View style={styles.huvud}>
        <TouchableOpacity style={styles.huvudVänster} onPress={() => setUtfällt(v => !v)} activeOpacity={0.7}>
          <Ionicons name={utfällt ? 'chevron-down' : 'chevron-up'} size={18} color="#2563eb" />
          <Text style={styles.antal}>{antal} {antal === 1 ? 'pass markerat' : 'pass markerade'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRensaMarkering} hitSlop={8}>
          <Text style={styles.rensaLänk}>Rensa</Text>
        </TouchableOpacity>
      </View>

      {utfällt && (
        <ScrollView style={styles.innehåll} keyboardShouldPersistTaps="handled">
          <Text style={styles.hjälp}>
            Fyll bara i det som ska ändras. Tomma fält lämnas som de är.
          </Text>
          <PassDetaljFält
            starttid={starttid}
            sluttid={sluttid}
            kategori={kategori}
            obTillagg={obTillagg}
            onStarttid={setStarttid}
            onSluttid={setSluttid}
            onKategori={setKategori}
            onObTillagg={setObTillagg}
            egnaKategorier={egnaKategorier}
            standardKategorier={standardKategorier}
            timlön={timlön}
            paslag={paslag}
            obRubrik="OB-tillägg för de markerade passen"
          />
          {/* Ett tomt OB-utkast betyder "rör inte OB", så utan den här knappen går det inte
              att ta bort OB från flera pass på en gång. */}
          <TouchableOpacity onPress={() => tillämpa({ rensaOb: true })} style={styles.taBortObRad} hitSlop={6}>
            <Ionicons name="close-circle-outline" size={15} color="#dc2626" />
            <Text style={styles.taBortObText}>Ta bort OB på markerade pass</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.knapp, !harNågot && styles.knappInaktiv]}
        onPress={() => tillämpa()}
        disabled={!harNågot}
        activeOpacity={0.85}
      >
        <Text style={styles.knappText}>
          Använd på {antal} {antal === 1 ? 'pass' : 'pass'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
    maxHeight: '62%',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 12,
  },
  huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  huvudVänster: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  antal: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  rensaLänk: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  innehåll: { marginBottom: 8 },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  taBortObRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 },
  taBortObText: { fontSize: 13, color: '#dc2626', fontWeight: '500' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
