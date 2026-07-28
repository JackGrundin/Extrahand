import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useRealtidsPing } from '../context/RealtidsContext';
import MånadsKalender from '../components/MånadsKalender';
import { datumTillIso, formatDagDatum, veckodagsNamn } from '../utils/datumHelper';

// Företagets bemanningsöversikt: vilka dagar de har personal och vem som jobbar när.
// Hämtar en månad i taget med en månads marginal åt varje håll, så att månadsbyte känns
// direkt i stället för att trigga ett nytt API-anrop.
export default function SchemaKalenderScreen() {
  const idag = new Date();
  const [år, setÅr] = useState(idag.getFullYear());
  const [månad, setMånad] = useState(idag.getMonth());
  const [valtDatum, setValtDatum] = useState(datumTillIso(idag));
  const [pass, setPass] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  const hämta = useCallback(async () => {
    try {
      // Från första dagen i föregående månad till sista dagen i nästa.
      const från = datumTillIso(new Date(år, månad - 1, 1));
      const till = datumTillIso(new Date(år, månad + 2, 0));
      setPass(await api.schemaKalender(från, till));
    } catch (fel) {
      console.error('Kalender fel:', fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }, [år, månad]);

  useEffect(() => { hämta(); }, [hämta]);
  useRealtidsPing(() => { hämta(); });

  const passPerDatum = useMemo(() => {
    const grupper = {};
    for (const p of pass) (grupper[p.datum] ??= []).push(p);
    return grupper;
  }, [pass]);

  function bytMånad(steg) {
    const ny = new Date(år, månad + steg, 1);
    setÅr(ny.getFullYear());
    setMånad(ny.getMonth());
  }

  const dagensPass = passPerDatum[valtDatum] ?? [];
  const bemannadeDagar = Object.keys(passPerDatum).filter(d => {
    const [y, m] = d.split('-').map(Number);
    return y === år && m === månad + 1;
  }).length;

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
    >
      <MånadsKalender
        år={år}
        månad={månad}
        passPerDatum={passPerDatum}
        valtDatum={valtDatum}
        onVäljDag={setValtDatum}
        onBytMånad={bytMånad}
      />

      <View style={styles.sammanfattning}>
        <Ionicons name="people-outline" size={16} color="#2563eb" />
        <Text style={styles.sammanfattningText}>
          {bemannadeDagar === 0
            ? 'Ingen personal inbokad den här månaden'
            : `${bemannadeDagar} ${bemannadeDagar === 1 ? 'dag' : 'dagar'} med personal den här månaden`}
        </Text>
      </View>

      <View style={styles.dagSektion}>
        <Text style={styles.dagRubrik}>
          {veckodagsNamn(valtDatum)} {formatDagDatum(valtDatum)}
        </Text>

        {dagensPass.length === 0 ? (
          <Text style={styles.tomText}>Ingen personal inbokad den här dagen.</Text>
        ) : (
          dagensPass.map((p, i) => (
            <View key={`${p.datum}-${p.personId}-${i}`} style={styles.passKort}>
              <View style={styles.passHuvud}>
                <Text style={styles.passNamn}>{p.personNamn ?? 'Ej tillsatt'}</Text>
                {p.status === 'rapporterad' && (
                  <View style={styles.genomfördBricka}>
                    <Text style={styles.genomfördText}>Genomfört</Text>
                  </View>
                )}
              </View>
              <View style={styles.passRad}>
                <Ionicons name="time-outline" size={14} color="#6b7280" />
                <Text style={styles.passTid}>{p.starttid ?? '–'} – {p.sluttid ?? '–'}</Text>
                {p.typ === 'schema' && (
                  <View style={styles.schemaBricka}>
                    <Text style={styles.schemaBrickaText}>Schema</Text>
                  </View>
                )}
              </View>
              {p.titel ? <Text style={styles.passTitel} numberOfLines={1}>{p.titel}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  sammanfattning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sammanfattningText: { fontSize: 13, color: '#6b7280', flex: 1 },

  dagSektion: { padding: 16 },
  dagRubrik: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textTransform: 'capitalize' },
  tomText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  passKort: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passHuvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  passNamn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  genomfördBricka: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  genomfördText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  passRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passTid: { fontSize: 14, color: '#374151' },
  schemaBricka: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  schemaBrickaText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  passTitel: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
});
