import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { parsaObTillagg } from '../utils/datumHelper';

const STATUS = {
  väntar:      { bg: '#fef9c3', text: '#854d0e', etikett: 'Väntar på svar' },
  accepterad:  { bg: '#dcfce7', text: '#16a34a', etikett: 'Accepterad' },
  avslagen:    { bg: '#fee2e2', text: '#dc2626', etikett: 'Avböjd' },
};

export default function JobbforfraganKort({ förfrågan, ärPrivatperson, onUppdaterad }) {
  const [sparar, setSparar] = useState(false);

  async function hantera(åtgärd) {
    setSparar(true);
    try {
      if (åtgärd === 'acceptera') {
        await api.accepteraJobbforfragan(förfrågan.id);
      } else {
        await api.avbojJobbforfragan(förfrågan.id);
      }
      onUppdaterad();
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  const färg = STATUS[förfrågan.status] ?? STATUS.väntar;
  const datum = new Date(förfrågan.datum + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const ob = parsaObTillagg(förfrågan.ob_tillagg);

  return (
    <View style={styles.kort}>
      <View style={styles.huvud}>
        <Ionicons name="briefcase-outline" size={18} color="#2563eb" />
        <Text style={styles.rubrik}>Passförfrågan</Text>
        <View style={[styles.statusBricka, { backgroundColor: färg.bg }]}>
          <Text style={[styles.statusText, { color: färg.text }]}>{färg.etikett}</Text>
        </View>
      </View>

      <View style={styles.rader}>
        {förfrågan.titel ? (
          <View style={styles.rad}>
            <Text style={styles.etikett}>Pass</Text>
            <Text style={styles.värde}>{förfrågan.titel}</Text>
          </View>
        ) : null}
        <View style={styles.rad}>
          <Text style={styles.etikett}>Datum</Text>
          <Text style={styles.värde}>{datum}</Text>
        </View>
        <View style={styles.rad}>
          <Text style={styles.etikett}>Tid</Text>
          <Text style={styles.värde}>{förfrågan.starttid}–{förfrågan.sluttid}</Text>
        </View>
        <View style={styles.rad}>
          <Text style={styles.etikett}>Timlön</Text>
          <Text style={styles.värde}>{Number(förfrågan.timlon).toLocaleString('sv-SE')} kr/tim</Text>
        </View>
        {ob.length > 0 && (
          <View style={styles.obSektion}>
            <Text style={styles.obRubrik}>OB-tillägg</Text>
            {ob.map((o, i) => (
              <Text key={i} style={styles.obIntervall}>
                {o.start}–{o.slut}: {o.typ === 'procent' ? `${o.värde}%` : `${o.värde} kr/h`}
              </Text>
            ))}
          </View>
        )}
      </View>

      {ärPrivatperson && förfrågan.status === 'väntar' && (
        <View style={styles.knappar}>
          <TouchableOpacity
            style={[styles.avbojKnapp, sparar && { opacity: 0.5 }]}
            onPress={() => hantera('avboj')}
            disabled={sparar}
          >
            <Text style={styles.avbojText}>Avböj</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.accepteraKnapp, sparar && { opacity: 0.5 }]}
            onPress={() => hantera('acceptera')}
            disabled={sparar}
          >
            <Text style={styles.accepteraText}>Acceptera</Text>
          </TouchableOpacity>
        </View>
      )}

      {!ärPrivatperson && förfrågan.status === 'väntar' && (
        <Text style={styles.väntarText}>Väntar på att personen svarar…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kort: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#e0e7ff' },
  huvud: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  rubrik: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  statusBricka: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  rader: { gap: 8, marginBottom: 14 },
  rad: { flexDirection: 'row', justifyContent: 'space-between' },
  etikett: { fontSize: 14, color: '#888' },
  värde: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  obSektion: { backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrik: { fontSize: 12, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  obIntervall: { fontSize: 13, color: '#7c2d12', paddingVertical: 1 },
  knappar: { flexDirection: 'row', gap: 10 },
  avbojKnapp: { flex: 1, borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  avbojText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  accepteraKnapp: { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  accepteraText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  väntarText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' },
});
