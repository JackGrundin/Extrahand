import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput, Modal, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';
import { parsaArbetstider, formatDagDatum, parsaObTillagg, beräknaObBelopp } from '../utils/datumHelper';
import { beräknaFakturapris } from '../utils/konstanter';
import { normaliseraKrav, saknadeKrav } from '../utils/behorighet';
import BehörighetsKrav from '../components/BehörighetsKrav';
import { useJobbPåslag } from '../utils/useJobbPåslag';

export default function JobbDetaljScreen({ route, navigation }) {
  const { jobb } = route.params;
  const { användare } = useAuth();
  const [laddar, setLaddar] = useState(false);
  const [sökt, setSökt] = useState(false);
  const [meddelande, setMeddelande] = useState('');
  const [avtalsModalSynlig, setAvtalsModalSynlig] = useState(false);
  const [ikryssade, setIkryssade] = useState(() => new Set());
  const påslag = useJobbPåslag(jobb.paslag, användare?.typ === 'företag');
  // Höjden på navigationsrubriken – KeyboardAvoidingView behöver den som offset,
  // annars räknar iOS fel och lämnar en lucka eller låter tangentbordet ligga kvar över fältet.
  const rubrikHöjd = useHeaderHeight();

  const krav = normaliseraKrav(jobb.behorighets_krav);
  const kanIntyga = användare?.typ === 'privatperson' && !sökt;
  // Räknas mot kravlistan, inte mot antalet ikryssade: en gammal kryssning som inte längre
  // motsvarar något krav ska inte kunna låsa upp knappen.
  const kvarAttKryssa = kanIntyga ? saknadeKrav(krav, [...ikryssade]).length : 0;

  function öppnaKarta() {
    const q = encodeURIComponent(jobb.adress);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${q}`
      : `geo:0,0?q=${q}`;
    Linking.openURL(url);
  }

  async function hanteraSökan() {
    if (!användare?.avtalGodkant) {
      setAvtalsModalSynlig(true);
      return;
    }
    setLaddar(true);
    try {
      await api.sökaJobb(jobb.id, {
        meddelande: meddelande.trim() || null,
        intygade_krav: [...ikryssade],
      });
      setSökt(true);
      Alert.alert('Klart!', 'Din ansökan har skickats.');
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <>
    <KeyboardAvoidingView
      style={styles.kavContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={rubrikHöjd}
    >
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollInnehåll}>
      {jobb.foretagNamn && <Text style={styles.foretagNamn}>{jobb.foretagNamn}</Text>}
      <Text style={styles.titel}>{jobb.Titel}</Text>
      <Text style={styles.info}>{jobb.Plats} · {jobb.Typ}</Text>
      {jobb.Lon && <Text style={styles.lön}>{jobb.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
      {(() => {
        const ob = parsaObTillagg(jobb.ob_tillagg);
        if (!ob.length || !jobb.Lon) return null;
        const timlön = jobb.Lon;
        const totalObBrutto = beräknaObBelopp(ob, timlön);
        const erFöretag = användare?.typ === 'företag';
        const totalVisat = erFöretag
          ? beräknaFakturapris(totalObBrutto, påslag)
          : totalObBrutto;
        return (
          <View style={styles.obSektion}>
            <View style={styles.obRubrikRad}>
              <View style={styles.obBadge}><Text style={styles.obBadgeText}>OB</Text></View>
              <Text style={styles.obRubrik}>Obekväm arbetstid</Text>
            </View>
            {ob.map((o, i) => {
              const [sh = 0, sm = 0] = o.start.split(':').map(Number);
              const [eh = 0, em = 0] = o.slut.split(':').map(Number);
              const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
              const brutto = o.typ === 'procent' ? h * timlön * (o.värde / 100) : h * o.värde;
              const visat = erFöretag ? beräknaFakturapris(brutto, påslag) : brutto;
              return (
                <View key={i} style={styles.obRad}>
                  <Text style={styles.obIntervall}>{o.start}–{o.slut}</Text>
                  <Text style={styles.obTillägg}>
                    {o.typ === 'procent' ? `${o.värde}%` : `${o.värde} kr/h`}
                    {' '}= <Text style={styles.obBelopp}>+{visat.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</Text>
                  </Text>
                </View>
              );
            })}
            {totalVisat > 0 && (
              <View style={styles.obTotalRad}>
                <Text style={styles.obTotalText}>
                  {erFöretag ? 'OB-kostnad för er: ' : 'OB i bruttolön: '}
                  <Text style={styles.obTotalBelopp}>+{totalVisat.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</Text>
                </Text>
              </View>
            )}
          </View>
        );
      })()}
      {(() => {
        const schema = parsaArbetstider(jobb.arbetstider);
        if (schema && schema.length > 0) {
          return (
            <View style={styles.dagSchema}>
              <View style={styles.dagSchemaRubrikRad}>
                <Ionicons name="calendar" size={15} color="#2563eb" />
                <Text style={styles.dagSchemaRubrik}>
                  {schema.length} {schema.length === 1 ? 'dag' : 'dagar'}
                  {jobb.antal_dagar != null && jobb.antal_dagar !== schema.length ? ` · ${jobb.antal_dagar} planerade` : ''}
                </Text>
              </View>
              {schema.map((dag, i) => (
                <View key={i} style={styles.dagRad}>
                  <View style={styles.datumChip}>
                    <Text style={styles.datumChipText}>{formatDagDatum(dag.datum) ?? '–'}</Text>
                  </View>
                  {(dag.start || dag.slut) && (
                    <Text style={styles.dagTid}>{dag.start ?? '–'} – {dag.slut ?? '–'}</Text>
                  )}
                </View>
              ))}
            </View>
          );
        }
        return jobb.antal_dagar != null ? (
          <View style={styles.detaljerRad}>
            <Text style={styles.detalj}>{jobb.antal_dagar} dagar</Text>
          </View>
        ) : null;
      })()}

      {jobb.adress && (
        <View style={styles.adressKort}>
          <View style={styles.adressRad}>
            <Ionicons name="location-outline" size={16} color="#2563eb" />
            <Text style={styles.adressText}>{jobb.adress}</Text>
          </View>
          <TouchableOpacity style={styles.kartaKnapp} onPress={öppnaKarta}>
            <Ionicons name="map-outline" size={15} color="#2563eb" />
            <Text style={styles.kartaKnappText}>Visa på karta</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Kraven visas för alla – företaget läser sin egen annons, den sökande kryssar i.
          Utan krav renderar komponenten ingenting alls. */}
      <BehörighetsKrav
        krav={krav}
        läge={kanIntyga ? 'intyga' : 'visning'}
        ikryssade={ikryssade}
        onÄndra={setIkryssade}
      />

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
            style={[styles.knapp, (sökt || kvarAttKryssa > 0) && styles.knappInaktiv]}
            onPress={hanteraSökan}
            disabled={laddar || sökt || kvarAttKryssa > 0}
          >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : (
              /* Knappen säger VARFÖR den är låst. En avstängd knapp utan förklaring är
                 en återvändsgränd. */
              <Text style={styles.knappText}>
                {sökt ? 'Ansökan skickad'
                  : kvarAttKryssa > 0 ? `${kvarAttKryssa} krav kvar att kryssa i`
                  : 'Sök jobbet'}
              </Text>
            )
          }
        </TouchableOpacity>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>

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
    </>
  );
}

const styles = StyleSheet.create({
  kavContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  scrollInnehåll: { paddingBottom: 24 },
  foretagNamn: { fontSize: 15, color: '#2563eb', fontWeight: '600', marginBottom: 4 },
  titel: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  info: { fontSize: 15, color: '#666', marginBottom: 4 },
  lön: { fontSize: 16, color: '#2563eb', fontWeight: '600', marginBottom: 8 },
  detaljerRad: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  detalj: { fontSize: 14, color: '#666' },
  dagSchema: { backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  dagSchemaRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dagSchemaRubrik: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  dagRad: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  datumChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#bfdbfe' },
  datumChipText: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  dagTid: { fontSize: 14, color: '#374151' },
  adressKort: { backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  adressRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  adressText: { fontSize: 15, color: '#1a1a1a', flex: 1 },
  kartaKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  kartaKnappText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
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
  obSektion: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  obBadge: { backgroundColor: '#ea580c', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  obBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  obRubrik: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  obRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  obIntervall: { fontSize: 14, color: '#7c2d12', fontWeight: '600' },
  obTillägg: { fontSize: 14, color: '#9a3412' },
  obBelopp: { fontWeight: '700', color: '#c2410c' },
  obTotalRad: { borderTopWidth: 1, borderTopColor: '#fed7aa', marginTop: 8, paddingTop: 8 },
  obTotalText: { fontSize: 14, color: '#9a3412' },
  obTotalBelopp: { fontWeight: '700', color: '#c2410c' },
});
