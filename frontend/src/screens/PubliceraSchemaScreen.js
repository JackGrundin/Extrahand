import { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PrenumerationModal from '../components/PrenumerationModal';
import ProBesparing from '../components/ProBesparing';
import FältFel from '../components/FältFel';
import StadInput from '../components/StadInput';
import SchemaPassModal from '../components/SchemaPassModal';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import { valideraSchema } from '../utils/schemaValidering';
import { formatDagDatum, veckodagsNamn, nästaDatumIso } from '../utils/datumHelper';
import { api } from '../api/klient';
import { KATEGORIER, PÅSLAG_GRATIS, beräknaFakturapris, formateraPris, normalisera, beräknaAvdragFörPass } from '../utils/konstanter';

export default function PubliceraSchemaScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [timlon, setTimlon] = useState('');
  const [kategori, setKategori] = useState('');
  const [pass, setPass] = useState([]);
  const [avdrag, setAvdrag] = useState([]);

  // Passmodalen. redigerarIndex = null vid nytt pass, annars passets plats i listan.
  const [passModalVisas, setPassModalVisas] = useState(false);
  const [redigerarIndex, setRedigerarIndex] = useState(null);
  const [passUtkast, setPassUtkast] = useState(null);
  const [egnaKategorier, setEgnaKategorier] = useState([]);

  // Avdragsformuläret
  const [avdragFormVisas, setAvdragFormVisas] = useState(false);
  const [avdragNamn, setAvdragNamn] = useState('');
  const [avdragBelopp, setAvdragBelopp] = useState('');
  const [avdragTyp, setAvdragTyp] = useState('per_dag');

  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState({});
  const scrollRef = useRef(null);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');
  const [prenumeration, setPrenumeration] = useState(null);
  const [planModalVisas, setPlanModalVisas] = useState(false);
  const [betalningLaddar, setBetalningLaddar] = useState(false);

  const hämtaStartdata = useCallback(async () => {
    try {
      setPrenumeration(await api.prenumerationStatus());
    } catch {
      // Statusen styr bara prisvisningen – backend avgör i slutändan.
    }
    try {
      setEgnaKategorier(await api.schemaKategorier());
    } catch {
      // Förslagen är en genväg, inte ett krav.
    }
  }, []);

  useFocusEffect(useCallback(() => { hämtaStartdata(); }, [hämtaStartdata]));
  useAppStateAktiv(hämtaStartdata);

  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;
  const timlönTal = parseFloat(timlon) || 0;

  function rensaFel(nyckel) {
    setFel(prev => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  // ------------------------------------------------------------------ Pass

  function öppnaNyttPass() {
    setRedigerarIndex(null);
    setPassUtkast(null);
    setPassModalVisas(true);
  }

  // Förifyller med föregående pass tider, roll och OB, och stegar datumet en dag framåt.
  // Fortfarande ett pass i taget, men repetitiva scheman blir snabba att lägga in.
  function öppnaKopieraFöregående() {
    const sista = pass[pass.length - 1];
    if (!sista) return;
    setRedigerarIndex(null);
    setPassUtkast({ ...sista, datum: nästaDatumIso(sista.datum) });
    setPassModalVisas(true);
  }

  function öppnaRedigera(index) {
    setRedigerarIndex(index);
    setPassUtkast(pass[index]);
    setPassModalVisas(true);
  }

  function sparaPass(nyttPass) {
    rensaFel('pass');
    setPass(prev => {
      const nästa = redigerarIndex == null
        ? [...prev, nyttPass]
        : prev.map((p, i) => (i === redigerarIndex ? nyttPass : p));
      // Håll listan kronologisk så att den speglar hur perioden faktiskt ser ut.
      return nästa.sort((a, b) =>
        a.datum === b.datum ? a.starttid.localeCompare(b.starttid) : a.datum.localeCompare(b.datum)
      );
    });
    setPassModalVisas(false);
  }

  function taBortPass(index) {
    setPass(prev => prev.filter((_, i) => i !== index));
  }

  // --------------------------------------------------------------- Avdrag

  function läggTillAvdrag() {
    const belopp = parseFloat(avdragBelopp);
    if (!avdragNamn.trim()) return Alert.alert('Fel', 'Ge avdraget ett namn, t.ex. Boende.');
    if (!belopp || belopp <= 0) return Alert.alert('Fel', 'Ange ett belopp större än noll.');
    setAvdrag(prev => [...prev, { namn: avdragNamn.trim(), belopp, typ: avdragTyp }]);
    setAvdragNamn('');
    setAvdragBelopp('');
    setAvdragTyp('per_dag');
    setAvdragFormVisas(false);
    rensaFel('avdrag');
  }

  // ------------------------------------------------------------ Publicera

  const filtreradeKategorier = KATEGORIER.filter(k =>
    normalisera(k).includes(normalisera(sokKategori))
  );

  // Perioden härleds ur passen – samma regel som servern använder.
  const period = pass.length
    ? { start: pass[0].datum, slut: pass[pass.length - 1].datum }
    : null;

  const avdragPerPass = beräknaAvdragFörPass(avdrag, pass.length);

  async function publicera({ accepteraHögrePåslag = false } = {}) {
    await api.skapaSchema({
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim(),
      adress: adress.trim(),
      kategori,
      typ: 'sommarjobb',
      timlon: timlönTal,
      pass,
      avdrag,
      ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
    });

    Alert.alert('Klart!', `Schemat har publicerats med ${pass.length} pass.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  async function hanteraPublicering() {
    const nyaFel = valideraSchema({ titel, beskrivning, kategori, plats, adress, timlon, pass, avdrag });
    if (Object.keys(nyaFel).length) {
      setFel(nyaFel);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setFel({});

    setLaddar(true);
    try {
      await publicera();
    } catch (error) {
      if (error.kod === 'KRAVER_PLANVAL') {
        setPlanModalVisas(true);
        return;
      }
      Alert.alert('Fel', error.message);
    } finally {
      setLaddar(false);
    }
  }

  async function fortsattUtanAbonnemang() {
    setPlanModalVisas(false);
    setLaddar(true);
    try {
      await publicera({ accepteraHögrePåslag: true });
    } catch (error) {
      Alert.alert('Fel', error.message);
    } finally {
      setLaddar(false);
    }
  }

  async function uppgraderaTillPro() {
    setBetalningLaddar(true);
    try {
      const { url } = await api.skapaCheckout();
      await Linking.openURL(url);
      setPlanModalVisas(false);
    } catch (error) {
      Alert.alert('Fel', error.message);
    } finally {
      setBetalningLaddar(false);
    }
  }

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.infoRuta}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.infoText}>
              En person söker och godkänns för hela schemat. Tidrapporter skapas automatiskt
              efter varje pass. Hela schemat räknas som ett pass mot gratisgränsen.
            </Text>
          </View>

          <Text style={styles.label}>Titel *</Text>
          <TextInput
            style={[styles.input, fel.titel && styles.inputFel]}
            placeholder="t.ex. Sommarpersonal 2026"
            value={titel}
            onChangeText={(t) => { setTitel(t); rensaFel('titel'); }}
          />
          <FältFel text={fel.titel} />

          <Text style={styles.label}>Beskrivning *</Text>
          <TextInput
            style={[styles.input, styles.textArea, fel.beskrivning && styles.inputFel]}
            placeholder="Beskriv uppdraget, krav och arbetsuppgifter..."
            value={beskrivning}
            onChangeText={(t) => { setBeskrivning(t); rensaFel('beskrivning'); }}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <FältFel text={fel.beskrivning} />

          <Text style={styles.label}>Stad *</Text>
          <StadInput
            värde={plats}
            onÄndra={(t) => { setPlats(t); rensaFel('plats'); }}
            placeholder="t.ex. Stockholm"
            fel={!!fel.plats}
          />
          <FältFel text={fel.plats} />

          <Text style={styles.label}>Adress till arbetsplatsen *</Text>
          <TextInput
            style={[styles.input, fel.adress && styles.inputFel]}
            placeholder="t.ex. Storgatan 12, Stockholm"
            value={adress}
            onChangeText={(t) => { setAdress(t); rensaFel('adress'); }}
            autoCorrect={false}
          />
          <FältFel text={fel.adress} />

          <Text style={styles.label}>Timlön (kr/tim) *</Text>
          <TextInput
            style={[styles.input, fel.timlon && styles.inputFel]}
            placeholder="t.ex. 160"
            value={timlon}
            onChangeText={(t) => { setTimlon(t); rensaFel('timlon'); }}
            keyboardType="numeric"
          />
          <FältFel text={fel.timlon} />
          {timlönTal > 0 && (
            <View style={styles.prisKalkyl}>
              <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{timlönTal} kr/h</Text></Text>
              <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{formateraPris(beräknaFakturapris(timlönTal, gällandePåslag))} kr/h</Text> (exkl. moms)</Text>
              <ProBesparing timlön={timlönTal} paslag={gällandePåslag} />
            </View>
          )}

          <Text style={styles.label}>Huvudkategori *</Text>
          <TouchableOpacity style={[styles.väljarKnapp, fel.kategori && styles.inputFel]} onPress={() => setKategoriModalVisas(true)} activeOpacity={0.7}>
            <Text style={[styles.väljarText, !kategori && styles.väljarPlaceholder]}>
              {kategori || 'Välj kategori...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <FältFel text={fel.kategori} />
          <Text style={styles.hjälp}>
            Beskriver annonsen. Varje pass kan sedan få en egen roll, t.ex. Liftvärd eller Garderob.
          </Text>

          {/* Passlistan. Perioden räknas ur passen – inga egna datumfält för den. */}
          <View style={styles.passRubrikRad}>
            <Text style={[styles.label, { marginTop: 24 }]}>Pass *</Text>
            {period && (
              <Text style={styles.periodText}>
                {formatDagDatum(period.start)} – {formatDagDatum(period.slut)} · {pass.length} pass
              </Text>
            )}
          </View>

          {pass.length === 0 ? (
            <Text style={styles.tomPass}>Inga pass ännu. Lägg till det första nedan.</Text>
          ) : (
            <View style={styles.passLista}>
              {pass.map((p, i) => (
                <TouchableOpacity
                  key={`${p.datum}-${p.starttid}-${i}`}
                  style={styles.passRad}
                  onPress={() => öppnaRedigera(i)}
                  activeOpacity={0.7}
                >
                  <View style={styles.passDatum}>
                    <Text style={styles.passVeckodag}>{veckodagsNamn(p.datum)}</Text>
                    <Text style={styles.passDatumText}>{formatDagDatum(p.datum)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passTid}>{p.starttid}–{p.sluttid}</Text>
                    <View style={styles.passBrickor}>
                      {p.kategori ? (
                        <View style={styles.rollBricka}><Text style={styles.rollBrickaText}>{p.kategori}</Text></View>
                      ) : null}
                      {p.ob_tillagg?.length > 0 && (
                        <View style={styles.obBricka}><Text style={styles.obBrickaText}>OB ×{p.ob_tillagg.length}</Text></View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => taBortPass(i)} hitSlop={10} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <FältFel text={fel.pass} />

          <View style={styles.passKnappRad}>
            <TouchableOpacity style={styles.passKnapp} onPress={öppnaNyttPass} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.passKnappText}>Lägg till pass</Text>
            </TouchableOpacity>
            {pass.length > 0 && (
              <TouchableOpacity style={styles.kopieraKnapp} onPress={öppnaKopieraFöregående} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={17} color="#2563eb" />
                <Text style={styles.kopieraText}>Kopiera föregående</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Löneavdrag */}
          <Text style={[styles.label, { marginTop: 24 }]}>Löneavdrag</Text>
          <Text style={styles.hjälp}>
            Dras från personens lön, t.ex. för boende eller kost. Fakturan till er påverkas inte.
          </Text>

          {avdrag.map((a, i) => (
            <View key={i} style={styles.avdragRad}>
              <View style={{ flex: 1 }}>
                <Text style={styles.avdragNamn}>{a.namn}</Text>
                <Text style={styles.avdragDetalj}>
                  {a.belopp} kr {a.typ === 'totalt' ? 'totalt för perioden' : 'per pass'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAvdrag(prev => prev.filter((_, j) => j !== i))} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}

          {avdragFormVisas ? (
            <View style={styles.avdragForm}>
              <TextInput
                style={styles.input}
                placeholder="Namn, t.ex. Boende"
                value={avdragNamn}
                onChangeText={setAvdragNamn}
                maxLength={40}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
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
              <Text style={styles.hjälp}>
                {avdragTyp === 'totalt'
                  ? 'Fördelas jämnt över schemats pass.'
                  : 'Dras per pass – två pass samma dag ger två avdrag.'}
              </Text>
              <View style={styles.avdragKnappar}>
                <TouchableOpacity style={styles.avdragAvbryt} onPress={() => setAvdragFormVisas(false)}>
                  <Text style={styles.avdragAvbrytText}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.avdragLäggTill} onPress={läggTillAvdrag}>
                  <Text style={styles.avdragLäggTillText}>Lägg till</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.avdragAddKnapp} onPress={() => setAvdragFormVisas(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color="#dc2626" />
              <Text style={styles.avdragAddText}>Lägg till avdrag</Text>
            </TouchableOpacity>
          )}
          <FältFel text={fel.avdrag} />

          {avdragPerPass > 0 && pass.length > 0 && (
            <View style={styles.avdragSummering}>
              <Text style={styles.avdragSummeringText}>
                Vid {pass.length} pass dras {formateraPris(avdragPerPass)} kr per pass,
                totalt {formateraPris(avdragPerPass * pass.length)} kr från lönen.
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.knapp, laddar && styles.knappInaktiv]} onPress={hanteraPublicering} disabled={laddar}>
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Publicera schema</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SchemaPassModal
        visible={passModalVisas}
        onStäng={() => setPassModalVisas(false)}
        onSpara={sparaPass}
        initialPass={passUtkast}
        egnaKategorier={egnaKategorier}
        standardKategorier={KATEGORIER}
        timlön={timlönTal}
        paslag={gällandePåslag}
        rubrik={redigerarIndex == null ? 'Nytt pass' : 'Redigera pass'}
      />

      <PrenumerationModal
        visible={planModalVisas}
        onClose={() => setPlanModalVisas(false)}
        timlön={timlönTal}
        laddar={betalningLaddar}
        onUppgradera={uppgraderaTillPro}
        onFortsattUtan={fortsattUtanAbonnemang}
      />

      <Modal visible={kategoriModalVisas} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => { setKategoriModalVisas(false); setSokKategori(''); }}
          />
          <View style={styles.panel}>
            <View style={styles.handtag} />
            <Text style={styles.panelTitel}>Välj huvudkategori</Text>
            <TextInput
              style={styles.sokInput}
              placeholder="Sök kategori..."
              placeholderTextColor="#9ca3af"
              value={sokKategori}
              onChangeText={setSokKategori}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filtreradeKategorier.length === 0 ? (
                <Text style={styles.ingaResultat}>Inga kategorier hittades</Text>
              ) : (
                filtreradeKategorier.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={styles.kategoriRad}
                    activeOpacity={0.7}
                    onPress={() => { setKategori(k); rensaFel('kategori'); setKategoriModalVisas(false); setSokKategori(''); }}
                  >
                    <Text style={styles.kategoriRadText}>{k}</Text>
                    {kategori === k && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 120 },
  inputFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  infoRuta: { flexDirection: 'row', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#bae6fd' },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },

  väljarKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  väljarText: { fontSize: 15, color: '#1a1a1a' },
  väljarPlaceholder: { color: '#aaa' },

  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  passRubrikRad: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  periodText: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginBottom: 6 },
  tomPass: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 8 },
  passLista: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  passRad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fafafa' },
  passDatum: { width: 66 },
  passVeckodag: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '600' },
  passDatumText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  passTid: { fontSize: 14, color: '#374151', fontWeight: '500' },
  passBrickor: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  rollBricka: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rollBrickaText: { fontSize: 11, color: '#2563eb', fontWeight: '700' },
  obBricka: { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  obBrickaText: { fontSize: 11, color: '#c2410c', fontWeight: '700' },

  passKnappRad: { flexDirection: 'row', gap: 8, marginTop: 12 },
  passKnapp: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  passKnappText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  kopieraKnapp: { flex: 1, flexDirection: 'row', gap: 6, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  kopieraText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },

  avdragRad: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  avdragNamn: { fontSize: 14, fontWeight: '600', color: '#991b1b' },
  avdragDetalj: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  avdragForm: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fecaca' },
  avdragKnappar: { flexDirection: 'row', gap: 8, marginTop: 10 },
  avdragAvbryt: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  avdragAvbrytText: { fontSize: 13, color: '#666', fontWeight: '600' },
  avdragLäggTill: { flex: 1, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  avdragLäggTillText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  avdragAddKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  avdragAddText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  avdragSummering: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  avdragSummeringText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },

  typVäljare: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typKnapp: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', backgroundColor: '#fff' },
  typKnappAktiv: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  typText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
  typTextAktiv: { color: '#fff' },

  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '80%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  panelTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa', marginBottom: 10 },
  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },
});
