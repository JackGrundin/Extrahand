import { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import TidVäljare from '../components/TidVäljare';
import PrenumerationModal from '../components/PrenumerationModal';
import ProBesparing from '../components/ProBesparing';
import FältFel from '../components/FältFel';
import StadInput from '../components/StadInput';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import { valideraSchema, genereraPass } from '../utils/schemaValidering';
import { datumTillIso, veckodagsNamn } from '../utils/datumHelper';
import { api } from '../api/klient';
import { KATEGORIER, PÅSLAG_GRATIS, beräknaFakturapris, formateraPris, normalisera } from '../utils/konstanter';

const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

function formatDatum(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export default function PubliceraSchemaScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [timlon, setTimlon] = useState('');
  const [kategori, setKategori] = useState('');
  const [startdatum, setStartdatum] = useState('');
  const [slutdatum, setSlutdatum] = useState('');
  const [pass, setPass] = useState([]);

  // Passgeneratorn
  const [valdaDagar, setValdaDagar] = useState([]);
  const [genStart, setGenStart] = useState('');
  const [genSlut, setGenSlut] = useState('');

  const [obTillagg, setObTillagg] = useState([]);
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');

  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState({});
  const scrollRef = useRef(null);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');
  // 'start' | 'slut' | index på ett pass, eller null när ingen väljare är öppen
  const [datumVäljare, setDatumVäljare] = useState(null);
  const [tempDatum, setTempDatum] = useState(new Date());
  const [prenumeration, setPrenumeration] = useState(null);
  const [planModalVisas, setPlanModalVisas] = useState(false);
  const [betalningLaddar, setBetalningLaddar] = useState(false);

  const hämtaPrenumeration = useCallback(async () => {
    try {
      setPrenumeration(await api.prenumerationStatus());
    } catch {
      // Statusen styr bara prisvisningen – backend avgör i slutändan.
    }
  }, []);

  useFocusEffect(useCallback(() => { hämtaPrenumeration(); }, [hämtaPrenumeration]));
  useAppStateAktiv(hämtaPrenumeration);

  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;

  function rensaFel(nyckel) {
    setFel(prev => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  function toggleVeckodag(index) {
    setValdaDagar(prev => (prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]));
  }

  // Fyller passlistan utifrån period, valda veckodagar och tider. Befintliga pass ersätts
  // efter en bekräftelse så att ingen tappar handredigerade tider av misstag.
  function körGenerator() {
    if (!startdatum || !slutdatum) {
      Alert.alert('Välj period', 'Ange start- och slutdatum innan du genererar pass.');
      return;
    }
    if (valdaDagar.length === 0) {
      Alert.alert('Välj dagar', 'Kryssa i vilka veckodagar som ska ingå.');
      return;
    }
    if (!genStart || !genSlut) {
      Alert.alert('Välj tider', 'Ange start- och sluttid för passen.');
      return;
    }

    const nya = genereraPass({ startdatum, slutdatum, veckodagar: valdaDagar, starttid: genStart, sluttid: genSlut });
    if (nya.length === 0) {
      Alert.alert('Inga pass', 'Inga datum i perioden matchar de valda veckodagarna.');
      return;
    }

    const applicera = () => { setPass(nya); rensaFel('pass'); };

    if (pass.length > 0) {
      Alert.alert(
        'Ersätt passlistan?',
        `Du har redan ${pass.length} pass. Vill du ersätta dem med ${nya.length} nya?`,
        [{ text: 'Avbryt', style: 'cancel' }, { text: 'Ersätt', style: 'destructive', onPress: applicera }]
      );
    } else {
      applicera();
    }
  }

  function uppdateraPass(index, fält, värde) {
    rensaFel('pass');
    setPass(prev => {
      const ny = [...prev];
      ny[index] = { ...ny[index], [fält]: värde };
      return ny;
    });
  }

  function taBortPass(index) {
    setPass(prev => prev.filter((_, i) => i !== index));
  }

  function öppnaDatumVäljare(vilken) {
    const nuvarande =
      vilken === 'start' ? startdatum : vilken === 'slut' ? slutdatum : pass[vilken]?.datum;
    setTempDatum(nuvarande ? new Date(nuvarande + 'T12:00:00') : new Date());
    setDatumVäljare(vilken);
  }

  function sparaDatum(vilken, date) {
    const iso = datumTillIso(date);
    if (vilken === 'start') { setStartdatum(iso); rensaFel('period'); }
    else if (vilken === 'slut') { setSlutdatum(iso); rensaFel('period'); }
    else uppdateraPass(vilken, 'datum', iso);
  }

  function bekräftaDatum() {
    if (datumVäljare !== null) sparaDatum(datumVäljare, tempDatum);
    setDatumVäljare(null);
  }

  function läggTillOb() {
    if (!obStart.trim() || !obSlut.trim() || !obVärde.trim()) {
      Alert.alert('Fel', 'Fyll i alla OB-fält');
      return;
    }
    const värde = parseFloat(obVärde);
    if (!värde || värde <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt OB-värde');
      return;
    }
    setObTillagg(prev => [...prev, { start: obStart.trim(), slut: obSlut.trim(), typ: obTyp, värde }]);
    setObStart('');
    setObSlut('');
    setObVärde('');
    setObFormVisas(false);
  }

  const filtreradeKategorier = KATEGORIER.filter(k =>
    normalisera(k).includes(normalisera(sokKategori))
  );

  async function publicera({ accepteraHögrePåslag = false } = {}) {
    await api.skapaSchema({
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim(),
      adress: adress.trim(),
      kategori,
      typ: 'sommarjobb',
      startdatum,
      slutdatum,
      timlon: parseFloat(timlon),
      ob_tillagg: obTillagg,
      pass,
      ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
    });

    Alert.alert('Klart!', `Schemat har publicerats med ${pass.length} pass.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  async function hanteraPublicering() {
    const nyaFel = valideraSchema({ titel, beskrivning, kategori, plats, adress, timlon, startdatum, slutdatum, pass });
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
          {timlon ? (() => {
            const lön = parseFloat(timlon) || 0;
            if (lön <= 0) return null;
            return (
              <View style={styles.prisKalkyl}>
                <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{lön} kr/h</Text></Text>
                <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{formateraPris(beräknaFakturapris(lön, gällandePåslag))} kr/h</Text> (exkl. moms)</Text>
                <ProBesparing timlön={lön} paslag={gällandePåslag} />
              </View>
            );
          })() : null}

          <Text style={styles.label}>Period *</Text>
          <View style={styles.periodRad}>
            <TouchableOpacity
              style={[styles.input, styles.datumKnapp, fel.period && styles.inputFel]}
              onPress={() => öppnaDatumVäljare('start')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={startdatum ? '#1a1a1a' : '#aaa'} />
              <Text style={[styles.datumText, !startdatum && styles.datumPlaceholder]}>
                {startdatum ? formatDatum(startdatum) : 'Från'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.tidStreck}>–</Text>
            <TouchableOpacity
              style={[styles.input, styles.datumKnapp, fel.period && styles.inputFel]}
              onPress={() => öppnaDatumVäljare('slut')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={slutdatum ? '#1a1a1a' : '#aaa'} />
              <Text style={[styles.datumText, !slutdatum && styles.datumPlaceholder]}>
                {slutdatum ? formatDatum(slutdatum) : 'Till'}
              </Text>
            </TouchableOpacity>
          </View>
          <FältFel text={fel.period} />

          {/* Passgeneratorn: utan den vore 40 pass omöjliga att mata in för hand */}
          <Text style={styles.label}>Generera pass</Text>
          <View style={styles.generator}>
            <Text style={styles.generatorHjälp}>Välj vilka veckodagar som ska ingå:</Text>
            <View style={styles.dagKnappar}>
              {VECKODAGAR.map((dag, i) => (
                <TouchableOpacity
                  key={dag}
                  style={[styles.dagKnapp, valdaDagar.includes(i) && styles.dagKnappAktiv]}
                  onPress={() => toggleVeckodag(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dagKnappText, valdaDagar.includes(i) && styles.dagKnappTextAktiv]}>{dag}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.generatorTider}>
              <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={genStart} onChange={setGenStart} />
              <Text style={styles.tidStreck}>–</Text>
              <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={genSlut} onChange={setGenSlut} />
            </View>
            <TouchableOpacity style={styles.generatorKnapp} onPress={körGenerator} activeOpacity={0.8}>
              <Ionicons name="repeat-outline" size={18} color="#fff" />
              <Text style={styles.generatorKnappText}>Generera pass</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            Pass * {pass.length > 0 ? `(${pass.length} st)` : ''}
          </Text>
          {pass.length === 0 ? (
            <Text style={styles.tomPass}>Inga pass ännu. Använd generatorn ovan.</Text>
          ) : (
            <View style={styles.passLista}>
              {pass.map((p, i) => (
                <View key={`${p.datum}-${i}`} style={styles.passRad}>
                  <TouchableOpacity
                    style={styles.passDatum}
                    onPress={() => öppnaDatumVäljare(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.passVeckodag}>{veckodagsNamn(p.datum)}</Text>
                    <Text style={styles.passDatumText}>{formatDatum(p.datum)}</Text>
                  </TouchableOpacity>
                  <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={p.starttid} onChange={v => uppdateraPass(i, 'starttid', v)} />
                  <Text style={styles.tidStreck}>–</Text>
                  <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={p.sluttid} onChange={v => uppdateraPass(i, 'sluttid', v)} />
                  <TouchableOpacity onPress={() => taBortPass(i)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <FältFel text={fel.pass} />

          <Text style={styles.label}>OB-tillägg (obekväm arbetstid)</Text>
          {obTillagg.map((ob, i) => (
            <View key={i} style={styles.obRad}>
              <Text style={styles.obRadText}>
                {ob.start}–{ob.slut}: {ob.värde}{ob.typ === 'procent' ? '%' : ' kr/h'}
              </Text>
              <TouchableOpacity onPress={() => setObTillagg(prev => prev.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {obFormVisas ? (
            <View style={styles.obForm}>
              <View style={styles.obFormTider}>
                <TidVäljare style={{ flex: 1 }} placeholder="18:00" value={obStart} onChange={setObStart} />
                <Text style={styles.tidStreck}>–</Text>
                <TidVäljare style={{ flex: 1 }} placeholder="20:00" value={obSlut} onChange={setObSlut} />
              </View>
              <View style={styles.typVäljare}>
                {['procent', 'fast'].map(t => (
                  <TouchableOpacity key={t} style={[styles.typKnapp, obTyp === t && styles.typKnappAktiv]} onPress={() => setObTyp(t)}>
                    <Text style={[styles.typText, obTyp === t && styles.typTextAktiv]}>
                      {t === 'procent' ? 'Procent (%)' : 'Fast kr/h'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder={obTyp === 'procent' ? 'OB-procent (t.ex. 50)' : 'Extra kr/h (t.ex. 25)'}
                value={obVärde}
                onChangeText={setObVärde}
                keyboardType="numeric"
              />
              <View style={styles.obFormKnappar}>
                <TouchableOpacity style={styles.obAvbryt} onPress={() => { setObFormVisas(false); setObStart(''); setObSlut(''); setObVärde(''); }}>
                  <Text style={styles.obAvbrytText}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.obLäggTillKnapp} onPress={läggTillOb}>
                  <Text style={styles.obLäggTillText}>Lägg till</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.obAddKnapp} onPress={() => setObFormVisas(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color="#ea580c" />
              <Text style={styles.obAddText}>Lägg till OB-intervall</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Kategori *</Text>
          <TouchableOpacity style={[styles.väljarKnapp, fel.kategori && styles.inputFel]} onPress={() => setKategoriModalVisas(true)} activeOpacity={0.7}>
            <Text style={[styles.väljarText, !kategori && styles.väljarPlaceholder]}>
              {kategori || 'Välj kategori...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <FältFel text={fel.kategori} />

          <TouchableOpacity style={[styles.knapp, laddar && styles.knappInaktiv]} onPress={hanteraPublicering} disabled={laddar}>
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Publicera schema</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PrenumerationModal
        visible={planModalVisas}
        onClose={() => setPlanModalVisas(false)}
        timlön={parseFloat(timlon) || 0}
        laddar={betalningLaddar}
        onUppgradera={uppgraderaTillPro}
        onFortsattUtan={fortsattUtanAbonnemang}
      />

      {/* Datumväljare – Android */}
      {Platform.OS === 'android' && datumVäljare !== null && (
        <DateTimePicker
          value={tempDatum}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, date) => {
            const vilken = datumVäljare;
            setDatumVäljare(null);
            if (date) sparaDatum(vilken, date);
          }}
        />
      )}

      {/* Datumväljare – iOS */}
      <Modal visible={Platform.OS === 'ios' && datumVäljare !== null} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerPanel}>
            <View style={styles.pickerRubrikRad}>
              <TouchableOpacity onPress={() => setDatumVäljare(null)}>
                <Text style={styles.pickerAvbryt}>Avbryt</Text>
              </TouchableOpacity>
              <Text style={styles.pickerRubrik}>Välj datum</Text>
              <TouchableOpacity onPress={bekräftaDatum}>
                <Text style={styles.pickerKlar}>Klar</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDatum}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_, date) => date && setTempDatum(date)}
              locale="sv-SE"
              themeVariant="light"
              textColor="#1a1a1a"
            />
          </View>
        </View>
      </Modal>

      {/* Kategoriväljare */}
      <Modal visible={kategoriModalVisas} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => { setKategoriModalVisas(false); setSokKategori(''); }}
          />
          <View style={styles.panel}>
            <View style={styles.handtag} />
            <Text style={styles.panelTitel}>Välj kategori</Text>
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

  infoRuta: { flexDirection: 'row', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#bae6fd' },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },

  väljarKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  väljarText: { fontSize: 15, color: '#1a1a1a' },
  väljarPlaceholder: { color: '#aaa' },

  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  periodRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datumKnapp: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumText: { fontSize: 15, color: '#1a1a1a' },
  datumPlaceholder: { color: '#aaa' },
  tidStreck: { fontSize: 16, color: '#9ca3af' },

  generator: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, backgroundColor: '#fafafa' },
  generatorHjälp: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  dagKnappar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dagKnapp: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  dagKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dagKnappText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  dagKnappTextAktiv: { color: '#fff' },
  generatorTider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  generatorKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12 },
  generatorKnappText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  tomPass: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 8 },
  passLista: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, backgroundColor: '#fafafa', gap: 8 },
  passRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passDatum: { width: 74 },
  passVeckodag: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '600' },
  passDatumText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },

  typVäljare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },

  obRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obRadText: { fontSize: 14, color: '#9a3412', flex: 1 },
  obForm: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#fed7aa' },
  obFormTider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  obFormKnappar: { flexDirection: 'row', gap: 10, marginTop: 8 },
  obAvbryt: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, alignItems: 'center' },
  obAvbrytText: { fontSize: 14, color: '#666', fontWeight: '600' },
  obLäggTillKnapp: { flex: 1, backgroundColor: '#ea580c', borderRadius: 10, padding: 12, alignItems: 'center' },
  obLäggTillText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  obAddKnapp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4 },
  obAddText: { fontSize: 14, color: '#ea580c', fontWeight: '600' },

  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerRubrikRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  pickerAvbryt: { fontSize: 16, color: '#9ca3af' },
  pickerKlar: { fontSize: 16, color: '#2563eb', fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '80%' },
  handtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  panelTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa', marginBottom: 10 },
  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },
});
