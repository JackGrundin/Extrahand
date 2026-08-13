import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import FältFel from '../components/FältFel';
import DatumVäljare from '../components/DatumVäljare';
import PassDetaljFält from '../components/PassDetaljFält';
import { formatDagDatum, veckodagsNamn } from '../utils/datumHelper';
import { KATEGORIER, SCHEMATYPER, formateraPris, beräknaAvdragFörPass } from '../utils/konstanter';

const TOMT_PASS = { datum: '', starttid: '', sluttid: '', kategori: '', ob_tillagg: [] };

// Redigering EFTER publicering. Befintliga pass har låsta datum och tider – de är avtalade
// med den som sökt. Nya pass går att lägga till, och kommande pass att ställa in.
export default function RedigeraSchemaScreen({ route, navigation }) {
  const { schemaId } = route.params;

  const [schema, setSchema] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState({});

  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [typ, setTyp] = useState('');
  const [timlon, setTimlon] = useState('');

  const [avdrag, setAvdrag] = useState([]);
  const [avdragFormVisas, setAvdragFormVisas] = useState(false);
  const [avdragNamn, setAvdragNamn] = useState('');
  const [avdragBelopp, setAvdragBelopp] = useState('');
  const [avdragTyp, setAvdragTyp] = useState('per_dag');

  const [passFormVisas, setPassFormVisas] = useState(false);
  const [nyttPass, setNyttPass] = useState(TOMT_PASS);

  const hämta = useCallback(async () => {
    try {
      const data = await api.hämtaSchema(schemaId);
      setSchema(data);
      setTitel(data.titel ?? '');
      setBeskrivning(data.beskrivning ?? '');
      setTyp(data.typ ?? '');
      setTimlon(data.timlon != null ? String(data.timlon) : '');
      setAvdrag(data.avdrag ?? []);
    } catch (f) {
      Alert.alert('Fel', f.message);
    } finally {
      setLaddar(false);
    }
  }, [schemaId]);

  useFocusEffect(useCallback(() => { hämta(); }, [hämta]));

  function rensaFel(nyckel) {
    setFel(prev => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  // ------------------------------------------------------------ Grunduppgifter

  async function sparaGrunduppgifter() {
    const nya = {};
    if (!titel.trim()) nya.titel = 'Titel krävs';
    if (!beskrivning.trim()) nya.beskrivning = 'Beskrivning krävs';
    // Samma regel som valideraSchema, men inline: skärmen äger inte pass och avdrag och
    // kan därför inte köra hela valideraSchema.
    if (!SCHEMATYPER.some(t => t.värde === typ)) nya.typ = 'Välj en schematyp';
    const lön = parseFloat(String(timlon).replace(',', '.'));
    if (!(lön > 0)) nya.timlon = 'Ange en timlön större än noll';
    if (Object.keys(nya).length) return setFel(nya);
    setFel({});

    setSparar(true);
    try {
      await api.uppdateraSchema(schemaId, {
        // Bara de fält som redigeras här skickas. PUT rör inte fält som utelämnas, så
        // plats, adress och kategori står kvar orörda.
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        typ,
        timlon: lön,
      });
      Alert.alert('Sparat', 'Schemat har uppdaterats.');
      await hämta();
    } catch (f) {
      Alert.alert('Fel', f.message);
    } finally {
      setSparar(false);
    }
  }

  // ------------------------------------------------------------ Löneavdrag

  async function sparaAvdrag() {
    const belopp = parseFloat(String(avdragBelopp).replace(',', '.'));
    if (!avdragNamn.trim()) return Alert.alert('Fel', 'Ge avdraget ett namn, t.ex. Boende.');
    if (!(belopp > 0)) return Alert.alert('Fel', 'Ange ett belopp större än noll.');

    setSparar(true);
    try {
      await api.skapaSchemaAvdrag(schemaId, { namn: avdragNamn.trim(), belopp, typ: avdragTyp });
      setAvdragNamn('');
      setAvdragBelopp('');
      setAvdragTyp('per_dag');
      setAvdragFormVisas(false);
      await hämta();
    } catch (f) {
      Alert.alert('Fel', f.message);
    } finally {
      setSparar(false);
    }
  }

  function taBortAvdrag(a) {
    Alert.alert('Ta bort avdrag', `Ta bort "${a.namn}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: async () => {
        setSparar(true);
        try {
          await api.taBortSchemaAvdrag(schemaId, a.id);
          await hämta();
        } catch (f) {
          Alert.alert('Fel', f.message);
        } finally {
          setSparar(false);
        }
      } },
    ]);
  }

  // ------------------------------------------------------------ Pass

  async function läggTillPass() {
    if (!nyttPass.datum) return Alert.alert('Fel', 'Välj ett datum för passet.');
    if (!nyttPass.starttid || !nyttPass.sluttid) return Alert.alert('Fel', 'Fyll i både start- och sluttid.');
    if (nyttPass.starttid === nyttPass.sluttid) {
      return Alert.alert('Fel', 'Start- och sluttid kan inte vara samma – passet blir noll timmar.');
    }

    setSparar(true);
    try {
      await api.läggTillSchemaPass(schemaId, [{
        datum: nyttPass.datum,
        starttid: nyttPass.starttid,
        sluttid: nyttPass.sluttid,
        // Tom roll blir null = ärv schemats värde, inte tom sträng.
        kategori: nyttPass.kategori?.trim() || null,
        ob_tillagg: nyttPass.ob_tillagg?.length ? nyttPass.ob_tillagg : null,
      }]);
      setNyttPass(TOMT_PASS);
      setPassFormVisas(false);
      await hämta();
    } catch (f) {
      Alert.alert('Fel', f.message);
    } finally {
      setSparar(false);
    }
  }

  function taBortPass(p) {
    Alert.alert(
      'Ta bort pass',
      `${veckodagsNamn(p.datum)} ${formatDagDatum(p.datum)}, ${p.starttid}–${p.sluttid}?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Ta bort', style: 'destructive', onPress: async () => {
          setSparar(true);
          try {
            await api.taBortSchemaPass(schemaId, p.id);
            await hämta();
          } catch (f) {
            Alert.alert('Fel', f.message);
          } finally {
            setSparar(false);
          }
        } },
      ]
    );
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!schema) return null;

  const ärTillsatt = schema.anvandare_id != null;
  const kommandePass = (schema.pass ?? []).filter(p => p.status === 'planerad');

  // Knappen sparar BARA de fyra fälten här nedanför – avdrag och pass sparas direkt när de
  // ändras. Nu när knappen sitter i foten och inte längre står precis under fälten är det
  // släckta läget det som visar räckvidden: den tänds bara när ett av dem rörts.
  //
  // Jämförelserna måste normalisera EXAKT som hämta() gör när fälten seedas, annars ser
  // knappen ändrad ut direkt vid inladdning.
  const ärÄndrat =
    titel !== (schema.titel ?? '') ||
    beskrivning !== (schema.beskrivning ?? '') ||
    typ !== (schema.typ ?? '') ||
    timlon !== (schema.timlon != null ? String(schema.timlon) : '');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {ärTillsatt && (
          <View style={styles.infoRuta}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.infoText}>
              {schema.personNamn ?? 'En person'} är godkänd för schemat. Datum och tider på
              befintliga pass är låsta, men du kan lägga till nya pass. Ändrar du timlönen
              får personen en notis.
            </Text>
          </View>
        )}

        <Text style={styles.label}>Titel *</Text>
        <TextInput
          style={[styles.input, fel.titel && styles.inputFel]}
          value={titel}
          onChangeText={t => { setTitel(t); rensaFel('titel'); }}
          maxLength={80}
        />
        <FältFel text={fel.titel} />

        <Text style={styles.label}>Beskrivning *</Text>
        <TextInput
          style={[styles.input, styles.textArea, fel.beskrivning && styles.inputFel]}
          value={beskrivning}
          onChangeText={t => { setBeskrivning(t); rensaFel('beskrivning'); }}
          multiline
        />
        <FältFel text={fel.beskrivning} />

        <Text style={styles.label}>Schematyp *</Text>
        <View style={styles.typRad}>
          {SCHEMATYPER.map(t => (
            <TouchableOpacity
              key={t.värde}
              style={[styles.typChip, typ === t.värde && styles.typChipAktiv]}
              onPress={() => { setTyp(t.värde); rensaFel('typ'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.typChipText, typ === t.värde && styles.typChipTextAktiv]}>
                {t.etikett}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <FältFel text={fel.typ} />

        <Text style={styles.label}>Timlön (kr) *</Text>
        <TextInput
          style={[styles.input, fel.timlon && styles.inputFel]}
          value={timlon}
          onChangeText={t => { setTimlon(t); rensaFel('timlon'); }}
          keyboardType="numeric"
        />
        <FältFel text={fel.timlon} />

        {/* ------------------------------------------------------ Löneavdrag */}

        <Text style={styles.sektionsRubrik}>Löneavdrag</Text>
        {avdrag.length === 0 && !avdragFormVisas && (
          <Text style={styles.tomText}>Inga löneavdrag.</Text>
        )}
        {avdrag.map(a => (
          <View key={a.id} style={styles.avdragRad}>
            <View style={{ flex: 1 }}>
              <Text style={styles.avdragNamn}>{a.namn}</Text>
              <Text style={styles.avdragDetalj}>
                {Number(a.belopp).toLocaleString('sv-SE')} kr {a.typ === 'totalt' ? 'totalt för perioden' : 'per pass'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => taBortAvdrag(a)} disabled={sparar} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ))}
        {avdrag.length > 0 && kommandePass.length > 0 && (
          <Text style={styles.avdragSumma}>
            Dras från lönen: {formateraPris(beräknaAvdragFörPass(avdrag, schema.antalPass ?? kommandePass.length))} kr per pass.
            Fakturan till företaget påverkas inte.
          </Text>
        )}

        {avdragFormVisas ? (
          <View style={styles.avdragForm}>
            <TextInput
              style={styles.avdragInput}
              placeholder="Namn, t.ex. Boende"
              value={avdragNamn}
              onChangeText={setAvdragNamn}
              maxLength={40}
            />
            <TextInput
              style={[styles.avdragInput, { marginTop: 8 }]}
              placeholder="Belopp i kr"
              value={avdragBelopp}
              onChangeText={setAvdragBelopp}
              keyboardType="numeric"
            />
            <View style={styles.typVäljare}>
              {[['per_dag', 'Per pass'], ['totalt', 'Totalt']].map(([v, etikett]) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.typKnapp, avdragTyp === v && styles.typKnappAktiv]}
                  onPress={() => setAvdragTyp(v)}
                >
                  <Text style={[styles.typText, avdragTyp === v && styles.typTextAktiv]}>{etikett}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.avdragHjälp}>
              {avdragTyp === 'totalt'
                ? 'Fördelas jämnt över schemats pass.'
                : 'Dras per pass – två pass samma dag ger två avdrag.'}
              {' '}Gäller från nästa rapporterade pass; redan rapporterade påverkas inte.
            </Text>
            <View style={styles.formKnappar}>
              <TouchableOpacity style={styles.avbrytKnapp} onPress={() => setAvdragFormVisas(false)} disabled={sparar}>
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.läggTillKnapp} onPress={sparaAvdrag} disabled={sparar}>
                <Text style={styles.läggTillText}>Lägg till</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addKnapp} onPress={() => setAvdragFormVisas(true)} disabled={sparar} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color="#dc2626" />
            <Text style={styles.addText}>Lägg till löneavdrag</Text>
          </TouchableOpacity>
        )}

        {/* ------------------------------------------------------ Pass */}

        <Text style={styles.sektionsRubrik}>Pass ({kommandePass.length})</Text>
        <Text style={styles.hjälpText}>
          Datum och tider på befintliga pass går inte att ändra. Behöver ett pass flyttas:
          ta bort det och lägg till ett nytt.
        </Text>

        {kommandePass.map(p => (
          <View key={p.id} style={styles.passRad}>
            <View style={styles.passDatumBlock}>
              <Text style={styles.passVeckodag}>{veckodagsNamn(p.datum)}</Text>
              <Text style={styles.passDatum}>{formatDagDatum(p.datum)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passTid}>{p.starttid} – {p.sluttid}</Text>
              {p.kategori ? <Text style={styles.passRoll}>{p.kategori}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => taBortPass(p)} disabled={sparar} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        {passFormVisas ? (
          <View style={styles.passForm}>
            <Text style={styles.label}>Datum *</Text>
            <DatumVäljare
              värde={nyttPass.datum}
              onÄndra={d => setNyttPass(p => ({ ...p, datum: d }))}
              placeholder="Välj datum"
              minimumDate={new Date()}
            />
            <PassDetaljFält
              starttid={nyttPass.starttid}
              sluttid={nyttPass.sluttid}
              kategori={nyttPass.kategori}
              obTillagg={nyttPass.ob_tillagg}
              onStarttid={v => setNyttPass(p => ({ ...p, starttid: v }))}
              onSluttid={v => setNyttPass(p => ({ ...p, sluttid: v }))}
              onKategori={v => setNyttPass(p => ({ ...p, kategori: v }))}
              onObTillagg={v => setNyttPass(p => ({ ...p, ob_tillagg: v }))}
              standardKategorier={KATEGORIER}
              timlön={parseFloat(String(timlon).replace(',', '.')) || 0}
              paslag={schema.paslag}
            />
            <View style={styles.formKnappar}>
              <TouchableOpacity
                style={styles.avbrytKnapp}
                onPress={() => { setPassFormVisas(false); setNyttPass(TOMT_PASS); }}
                disabled={sparar}
              >
                <Text style={styles.avbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.läggTillKnapp} onPress={läggTillPass} disabled={sparar}>
                <Text style={styles.läggTillText}>Lägg till pass</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addKnapp} onPress={() => setPassFormVisas(true)} disabled={sparar} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
            <Text style={[styles.addText, { color: '#2563eb' }]}>Lägg till pass</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Utanför ScrollView men innanför KeyboardAvoidingView, samma som navRad i
          PubliceraSchemaScreen: foten ligger då kvar längst ned och åker upp ovanför
          tangentbordet i stället för att hamna bakom det. */}
      <View style={styles.fot}>
        <TouchableOpacity
          style={[styles.sparaKnapp, (sparar || !ärÄndrat) && styles.knappInaktiv]}
          onPress={sparaGrunduppgifter}
          disabled={sparar || !ärÄndrat}
          activeOpacity={0.8}
        >
          <Text style={styles.sparaText}>Spara ändringar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },

  infoRuta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },

  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  inputFel: { borderColor: '#ef4444' },
  textArea: { height: 110, textAlignVertical: 'top' },

  typRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typChip: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  typChipAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typChipText: { fontSize: 14, color: '#444', fontWeight: '600' },
  typChipTextAktiv: { color: '#fff' },

  // paddingBottom 28 är appens manuella marginal för hemindikatorn – samma värde som
  // navRad i PubliceraSchemaScreen. Projektet har inget safe-area-bibliotek.
  fot: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  sparaKnapp: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  sparaText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  knappInaktiv: { opacity: 0.5 },

  sektionsRubrik: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginTop: 28, marginBottom: 8 },
  hjälpText: { fontSize: 13, color: '#6b7280', marginBottom: 10, lineHeight: 18 },
  tomText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginBottom: 4 },

  avdragRad: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  avdragNamn: { fontSize: 14, color: '#991b1b', fontWeight: '600' },
  avdragDetalj: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  avdragSumma: { fontSize: 12, color: '#b91c1c', marginTop: 2, marginBottom: 6, lineHeight: 17 },
  avdragForm: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#fecaca' },
  avdragInput: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  avdragHjälp: { fontSize: 12, color: '#b91c1c', marginTop: 8, lineHeight: 17 },
  typVäljare: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typKnapp: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', backgroundColor: '#fff' },
  typKnappAktiv: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  typText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
  typTextAktiv: { color: '#fff' },

  passRad: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fafafa', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  passDatumBlock: { width: 74 },
  passVeckodag: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' },
  passDatum: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  passTid: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  passRoll: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  passForm: { backgroundColor: '#f8faff', borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#bfdbfe' },

  addKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 4 },
  addText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  formKnappar: { flexDirection: 'row', gap: 8, marginTop: 12 },
  avbrytKnapp: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  avbrytText: { fontSize: 14, color: '#666', fontWeight: '600' },
  läggTillKnapp: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  läggTillText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
