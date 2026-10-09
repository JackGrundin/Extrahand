import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, felText } from '../api/klient';
import { parsaObTillagg } from '../utils/datumHelper';
import { haptik } from '../utils/haptik';
import Kort from './Kort';
import { FÄRG, RADIE } from '../utils/tema';

const STATUS = {
  väntar:      { bg: '#fef9c3', text: '#854d0e', etikett: 'Väntar på svar' },
  accepterad:  { bg: FÄRG.framgångMjuk, text: FÄRG.framgång, etikett: 'Accepterad' },
  avslagen:    { bg: FÄRG.felMjuk, text: FÄRG.fel, etikett: 'Avböjd' },
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
      haptik.lyckat();
      onUppdaterad();
    } catch (fel) {
      haptik.fel();
      Alert.alert('Fel', felText(fel));
    } finally {
      setSparar(false);
    }
  }

  const färg = STATUS[förfrågan.status] ?? STATUS.väntar;
  const datum = new Date(förfrågan.datum + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const ob = parsaObTillagg(förfrågan.ob_tillagg);

  return (
    <Kort style={styles.kort} tryckbar={false}>
      <View style={styles.huvud}>
        <Ionicons name="briefcase-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
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
    </Kort>
  );
}

const styles = StyleSheet.create({
  kort: { marginTop: 12 },
  huvud: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  rubrik: { fontSize: 15, fontWeight: '700', color: FÄRG.text, flex: 1 },
  statusBricka: { borderRadius: RADIE.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  rader: { gap: 8, marginBottom: 14 },
  rad: { flexDirection: 'row', justifyContent: 'space-between' },
  etikett: { fontSize: 14, color: FÄRG.textDämpad },
  värde: { fontSize: 14, fontWeight: '600', color: FÄRG.text },
  obSektion: { backgroundColor: FÄRG.varningMjuk, borderRadius: RADIE.sm, padding: 10, marginTop: 4, borderWidth: 1, borderColor: FÄRG.varningKant },
  obRubrik: { fontSize: 12, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  obIntervall: { fontSize: 13, color: '#7c2d12', paddingVertical: 1 },
  knappar: { flexDirection: 'row', gap: 10 },
  avbojKnapp: { flex: 1, borderWidth: 1.5, borderColor: FÄRG.fel, borderRadius: RADIE.sm, paddingVertical: 11, alignItems: 'center' },
  avbojText: { color: FÄRG.fel, fontWeight: '700', fontSize: 14 },
  accepteraKnapp: { flex: 1, backgroundColor: FÄRG.framgång, borderRadius: RADIE.sm, paddingVertical: 11, alignItems: 'center' },
  accepteraText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  väntarText: { fontSize: 13, color: FÄRG.textSvag, fontStyle: 'italic', textAlign: 'center' },
});
