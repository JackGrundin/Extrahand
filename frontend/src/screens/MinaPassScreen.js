import { useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';
import { useRealtidsPing } from '../context/RealtidsContext';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import HandlingsKnapp from '../components/HandlingsKnapp';
import RollBrickor from '../components/RollBrickor';

import { parsaArbetstider, formatDagDatum, formatBricka, passSlutTidpunkt, förstaArbetsdatum } from '../utils/datumHelper';

// Ett pass räknas som genomfört när dess sista sluttid redan passerat, eller när
// företaget skapat en tidrapport för passet. Vi jämför mot exakt sluttidpunkt (samma
// logik som företagssidans behöverAvslutas) så att ett pass flyttas till "Genomförda"
// så snart det tagit slut – även samma dag. Saknas datum och tidrapport är passet kommande.
function ärGenomfört(ansökan) {
  if (ansökan.rapportStatus != null) return true;
  const slut = passSlutTidpunkt(ansökan.arbetstider);
  return slut != null && slut.getTime() < Date.now();
}

// Gruppera på ARBETSDATUM, inte på när ansökan skapades. Ett schema tilldelas i en enda
// transaktion, så alla dess pass har samma created_at – utan detta skulle hela sommaren
// hamna under den månad personen godkändes. Faller tillbaka på created_at för pass som
// saknar datum.
function grupperaPerMånad(pass) {
  const grupper = {};
  pass.forEach(p => {
    const arbetsdatum = förstaArbetsdatum(p.arbetstider);
    const datum = arbetsdatum ? new Date(arbetsdatum + 'T12:00:00') : new Date(p.created_at);
    const nyckel = datum.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
    if (!grupper[nyckel]) grupper[nyckel] = { titel: nyckel, sortering: datum.getTime(), data: [] };
    grupper[nyckel].data.push(p);
  });
  return Object.values(grupper).sort((a, b) => a.sortering - b.sortering);
}

export default function MinaPassScreen({ navigation }) {
  const [ansökningar, setAnsökningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [aktivFlik, setAktivFlik] = useState('kommande');

  async function hämta() {
    try {
      const data = await api.minaAnsökningar();
      setAnsökningar(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  // Realtid: passlistan uppdateras direkt vid statusändringar och nya tidrapporter
  useRealtidsPing(() => { hämta(); });

  // Bara till för att tvinga fram en omrendering – värdet läses aldrig.
  const [, setTick] = useState(0);

  // ärGenomfört jämför sluttiden mot Date.now() VID RENDERING. Ligger skärmen öppen över
  // ett passslut flyttas passet annars inte förrän användaren drar ned eller byter flik.
  // En tom state-bump räcker: datan har inte ändrats, bara klockan, så ingen hämtning
  // behövs. Intervallet ligger i useFocusEffect så timern rivs när skärmen lämnas och
  // inget snurrar i bakgrunden. Minutupplösning matchar sluttidernas HH:MM – tätare
  // intervall kan inte flytta något tidigare.
  useFocusEffect(useCallback(() => {
    const intervall = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(intervall);
  }, []));

  // Timern står still medan appen ligger i bakgrunden (JS suspenderas på iOS), och under
  // tiden kan cron ha hunnit skapa tidrapporter – rapportStatus är den andra halvan av
  // ärGenomfört. Vid återkomst hämtas därför på riktigt i stället för att bara ticka.
  useAppStateAktiv(() => { hämta(); });

  const godkända = ansökningar.filter(a => a.status === 'godkänd');
  // Ett pass är genomfört när dess sista arbetsdatum passerat, eller när en tidrapport
  // skapats för passet (rapportStatus finns). Övriga godkända pass är kommande.
  //
  // Ett schema ger både en annons-ansökan (alla datum, inget schemaPassId) och en ansökan
  // per pass. Under Kommande visas bara det samlade schemakortet, så ett sommarjobb inte
  // fyller listan med 60 rader. Under Genomförda visas i stället varje pass för sig, med
  // sin egen tidrapport – och då döljs det samlade kortet.
  const genomförda = godkända
    .filter(ärGenomfört)
    .filter(a => !(a.schemaId && !a.schemaPassId));
  const kommande = godkända
    .filter(a => !ärGenomfört(a))
    .filter(a => !a.schemaPassId)
    // Närmaste pass överst. Sorteringen går på MINSTA arbetsdatumet, samma värde som
    // månadsgrupperingen ovan använder – tidigare lästes arrayens första element, och
    // eftersom arbetstider inte är garanterat sorterade kunde ett kort hamna i
    // juni-sektionen men sorteras som om det började i augusti. ISO-datum jämförs som
    // strängar; ingen Date behövs och tidszonen kan inte störa. Pass utan datum sist.
    .sort((a, b) => {
      const datumA = förstaArbetsdatum(a.arbetstider);
      const datumB = förstaArbetsdatum(b.arbetstider);
      if (!datumA && !datumB) return 0;
      if (!datumA) return 1;
      if (!datumB) return -1;
      return datumA < datumB ? -1 : datumA > datumB ? 1 : 0;
    });

  const sektioner = grupperaPerMånad(aktivFlik === 'kommande' ? kommande : genomförda);

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.flikar}>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'kommande' && styles.flikAktiv]}
          onPress={() => setAktivFlik('kommande')}
          activeOpacity={0.8}
        >
          <Text style={[styles.flikText, aktivFlik === 'kommande' && styles.flikTextAktiv]}>
            Kommande ({kommande.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'genomförda' && styles.flikAktiv]}
          onPress={() => setAktivFlik('genomförda')}
          activeOpacity={0.8}
        >
          <Text style={[styles.flikText, aktivFlik === 'genomförda' && styles.flikTextAktiv]}>
            Genomförda ({genomförda.length})
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sektioner}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.månadRubrik}>{section.titel.toUpperCase()}</Text>
        )}
        ListEmptyComponent={
          <View style={styles.tomContainer}>
            <Text style={styles.tomText}>
              {aktivFlik === 'kommande'
                ? 'Inga kommande pass'
                : 'Inga genomförda pass ännu'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const schema = parsaArbetstider(item.arbetstider);
          const allaDatum = schema ? schema.map(d => d.datum).filter(Boolean) : [];
          const bricka = allaDatum.length > 0
            ? formatBricka(allaDatum)
            : (() => { const d = new Date(item.created_at); return { rader: [String(d.getDate()), d.toLocaleDateString('sv-SE', { month: 'short' })], stor: true }; })();
          const visaDatum = allaDatum.slice(0, 3);
          const fler = allaDatum.length > 3 ? allaDatum.length - 3 : 0;
          // Det samlade schemakortet öppnar schemat med hela passlistan; ett vanligt pass
          // öppnar chatten som tidigare.
          const ärSchemaKort = item.schemaId != null && item.schemaPassId == null;
          const öppna = () => ärSchemaKort
            ? navigation.navigate('SchemaDetalj', { schemaId: item.schemaId })
            : navigation.navigate('Chatt', { ansokningId: item.id });
          return (
            <TouchableOpacity style={styles.kort} onPress={öppna} activeOpacity={0.85}>
              <View style={styles.datumRad}>
                <View style={styles.datumBricka}>
                  {bricka.rader.map((rad, i) => (
                    <Text key={i} style={i === 0 && bricka.stor ? styles.datumDag : styles.datumMån}>{rad}</Text>
                  ))}
                </View>
                <View style={styles.passInfo}>
                  <View style={styles.titelRad}>
                    <Text style={styles.passTitel} numberOfLines={1}>{item.jobbTitel ?? 'Jobb'}</Text>
                    {ärSchemaKort && (
                      <View style={styles.schemaBricka}>
                        <Text style={styles.schemaBrickaText}>Schema</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.passForetag} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
                  {/* Vilken avdelning personen är bokad på. Rollen ligger per dag i
                      arbetstider; det samlade schemakortet visar alla förekommande, ett
                      enskilt pass sin egen. */}
                  {(() => {
                    const roller = [...new Set((schema ?? []).map(d => d.kategori).filter(Boolean))];
                    return roller.length > 0
                      ? <RollBrickor roller={roller} max={2} style={{ marginTop: 4 }} />
                      : null;
                  })()}
                  {allaDatum.length > 0 ? (
                    <View style={styles.passDetaljer}>
                      {visaDatum.map((d, i) => (
                        <Text key={i} style={styles.passDetalj}>{formatDagDatum(d)}</Text>
                      ))}
                      {fler > 0 && <Text style={styles.passDetalj}>+{fler} till</Text>}
                    </View>
                  ) : item.antalDagar != null ? (
                    <View style={styles.passDetaljer}>
                      <Text style={styles.passDetalj}>{item.antalDagar} dag{item.antalDagar !== 1 ? 'ar' : ''}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <HandlingsKnapp
                text={ärSchemaKort ? 'Visa schema →' : 'Öppna chatt →'}
                onPress={öppna}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flikar: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  flik: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  flikAktiv: { backgroundColor: '#2563eb' },
  flikText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  flikTextAktiv: { color: '#fff' },

  lista: { padding: 16, paddingBottom: 32 },
  månadRubrik: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginTop: 16, marginBottom: 8 },

  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datumRad: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  datumBricka: { minWidth: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  datumDag: { fontSize: 18, fontWeight: '700', color: '#2563eb', lineHeight: 22 },
  datumMån: { fontSize: 10, color: '#2563eb', fontWeight: '600', textTransform: 'uppercase' },
  passInfo: { flex: 1 },
  titelRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flexShrink: 1 },
  schemaBricka: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  schemaBrickaText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  passForetag: { fontSize: 13, color: '#888', marginTop: 2 },
  passDetaljer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  passDetalj: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  timmarBricka: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timmarText: { fontSize: 13, fontWeight: '700', color: '#16a34a' },

  tomContainer: { alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
});
