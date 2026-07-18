import { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import TidVäljare from '../components/TidVäljare';
import PrenumerationModal from '../components/PrenumerationModal';
import ProBesparing from '../components/ProBesparing';
import FältFel from '../components/FältFel';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import { valideraJobb } from '../utils/jobbValidering';
import { api } from '../api/klient';
import { KATEGORIER, PÅSLAG_GRATIS, beräknaFakturapris, formateraPris } from '../utils/konstanter';
import StadInput from '../components/StadInput';

function formatDatum(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr + 'T12:00:00');
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

export default function PubliceraJobbScreen({ navigation }) {
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [lon, setLon] = useState('');
  const [kategori, setKategori] = useState('');
  const [antalDagar, setAntalDagar] = useState('');
  const [dagScheman, setDagScheman] = useState([]);
  const [sammaTider, setSammaTider] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState({});
  const scrollRef = useRef(null);
  const [kategoriModalVisas, setKategoriModalVisas] = useState(false);
  const [sokKategori, setSokKategori] = useState('');
  const [dagPickerIndex, setDagPickerIndex] = useState(null);
  const [tempDatum, setTempDatum] = useState(new Date());
  const [obTillagg, setObTillagg] = useState([]);
  const [obFormVisas, setObFormVisas] = useState(false);
  const [obStart, setObStart] = useState('');
  const [obSlut, setObSlut] = useState('');
  const [obTyp, setObTyp] = useState('procent');
  const [obVärde, setObVärde] = useState('');
  const [prenumeration, setPrenumeration] = useState(null);
  const [planModalVisas, setPlanModalVisas] = useState(false);
  const [betalningLaddar, setBetalningLaddar] = useState(false);

  // Hämtar företagets plan så att prisrutan kan visa rätt påslag redan innan
  // publicering. Hämtas om vid varje fokus – t.ex. när användaren kommer tillbaka
  // från Stripe Checkout i webbläsaren.
  const hämtaPrenumeration = useCallback(async () => {
    try {
      setPrenumeration(await api.prenumerationStatus());
    } catch {
      // Statusen är bara till för prisvisningen – backend avgör i slutändan.
    }
  }, []);

  useFocusEffect(useCallback(() => {
    hämtaPrenumeration();
  }, [hämtaPrenumeration]));

  // Stripe Checkout öppnas i den externa webbläsaren, så skärmen tappar aldrig fokus och
  // useFocusEffect ovan triggar inte vid återkomst. Utan detta skulle priset visas för
  // högt tills företaget bytte flik – trots att de just uppgraderat.
  useAppStateAktiv(hämtaPrenumeration);

  // Påslaget som gäller för nästa pass företaget publicerar.
  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;

  function hanteraAntalDagar(val) {
    setAntalDagar(val);
    const n = parseInt(val) || 0;
    setDagScheman(prev =>
      Array.from({ length: n }, (_, i) => prev[i] || { datum: '', start: '', slut: '' })
    );
    if (n <= 1) setSammaTider(false);
  }

  function uppdateraDag(index, fält, värde) {
    rensaFel('schema');
    setDagScheman(prev => {
      if (sammaTider && fält !== 'datum') {
        return prev.map(dag => ({ ...dag, [fält]: värde }));
      }
      const ny = [...prev];
      ny[index] = { ...ny[index], [fält]: värde };
      return ny;
    });
  }

  function öppnaPicker(index) {
    const dag = dagScheman[index];
    setTempDatum(dag.datum ? new Date(dag.datum + 'T12:00:00') : new Date());
    setDagPickerIndex(index);
  }

  function sparaDatum(index, date) {
    uppdateraDag(index, 'datum', date.toISOString().split('T')[0]);
  }

  function bekräftaDatum() {
    if (dagPickerIndex !== null) sparaDatum(dagPickerIndex, tempDatum);
    setDagPickerIndex(null);
  }

  function toggleSammaTider() {
    const nästa = !sammaTider;
    setSammaTider(nästa);
    if (nästa && dagScheman.length > 0) {
      const { start, slut } = dagScheman[0];
      setDagScheman(prev => prev.map(dag => ({ ...dag, start, slut })));
    }
  }

  // Rensar felmarkeringen för ett fält så snart användaren börjar rätta det.
  function rensaFel(nyckel) {
    setFel(prev => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  // Uppdaterar platsfältet och rensar felmarkering
  function hanteraPlatsInput(text) {
    setPlats(text);
    rensaFel('plats');
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
    k.toLowerCase().includes(sokKategori.toLowerCase())
  );

  // Skickar jobbet till backend. Backend avgör påslaget och svarar med KRAVER_PLANVAL
  // om gratiskontot förbrukat månadens två pass – då visas planvalet i stället, och
  // publiceringen görs om med accepteraHögrePåslag när företaget valt.
  async function publicera({ accepteraHögrePåslag = false } = {}) {
    const arbetstider = dagScheman.length > 0 ? JSON.stringify(dagScheman) : undefined;

    await api.publicera({
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim() || undefined,
      adress: adress.trim(),
      lon: lon ? parseInt(lon) : undefined,
      typ: 'gig',
      kategori: kategori || undefined,
      antal_dagar: antalDagar ? parseInt(antalDagar) : undefined,
      arbetstider,
      ob_tillagg: obTillagg,
      ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
    });

    Alert.alert('Klart!', 'Jobbet har publicerats.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  async function hanteraPublicering() {
    const nyaFel = valideraJobb({ titel, beskrivning, kategori, plats, adress, lon, dagScheman });
    if (Object.keys(nyaFel).length) {
      setFel(nyaFel);
      // Fälten ligger i ordning uppifrån, så det räcker att scrolla till toppen för att
      // första felet alltid ska synas.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setFel({});

    setLaddar(true);
    try {
      await publicera();
    } catch (error) {
      // Tredje passet denna månad på gratisplanen – låt företaget välja plan.
      if (error.kod === 'KRAVER_PLANVAL') {
        setPlanModalVisas(true);
        return;
      }
      Alert.alert('Fel', error.message);
    } finally {
      setLaddar(false);
    }
  }

  // "Fortsätt utan abonnemang" – jobbet publiceras med 40 % påslag.
  async function fortsattUtanAbonnemang() {
    setPlanModalVisas(false);
    setLaddar(true);
    try {
      await publicera({ accepteraHögrePåslag: true });
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  // "Uppgradera till Pro" – Stripe Checkout öppnas i webbläsaren. När företaget återvänder
  // till appen hämtas planen om via useAppStateAktiv (inte useFocusEffect – skärmen tappar
  // aldrig fokus när appen bara läggs i bakgrunden), så priset uppdateras direkt.
  async function uppgraderaTillPro() {
    setBetalningLaddar(true);
    try {
      const { url } = await api.skapaCheckout();
      await Linking.openURL(url);
      setPlanModalVisas(false);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setBetalningLaddar(false);
    }
  }

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Jobbtitel *</Text>
          <TextInput
            style={[styles.input, fel.titel && styles.inputFel]}
            placeholder="t.ex. Sommarjobbare på café"
            value={titel}
            onChangeText={(t) => { setTitel(t); rensaFel('titel'); }}
          />
          <FältFel text={fel.titel} />

          <Text style={styles.label}>Beskrivning *</Text>
          <TextInput
            style={[styles.input, styles.textArea, fel.beskrivning && styles.inputFel]}
            placeholder="Beskriv tjänsten, krav och arbetsuppgifter..."
            value={beskrivning}
            onChangeText={(t) => { setBeskrivning(t); rensaFel('beskrivning'); }}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <FältFel text={fel.beskrivning} />

          <Text style={styles.label}>Plats *</Text>
          <StadInput
            värde={plats}
            onÄndra={hanteraPlatsInput}
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
          <TextInput style={[styles.input, fel.lon && styles.inputFel]} placeholder="t.ex. 160" value={lon} onChangeText={(t) => { setLon(t); rensaFel('lon'); }} keyboardType="numeric" />
          <FältFel text={fel.lon} />
          {lon ? (() => {
            const timlön = parseFloat(lon) || 0;
            const faktureringspris = formateraPris(beräknaFakturapris(timlön, gällandePåslag));
            return timlön > 0 ? (
              <View style={styles.prisKalkyl}>
                <Text style={styles.prisRad}>Timlön för personen: <Text style={styles.prisFet}>{timlön} kr/h</Text></Text>
                <Text style={styles.prisRad}>Ni faktureras: <Text style={styles.prisFetBlå}>{faktureringspris} kr/h</Text> (exkl. moms)</Text>
                <ProBesparing timlön={timlön} paslag={gällandePåslag} />
              </View>
            ) : null;
          })() : null}

          <Text style={styles.label}>Antal dagar *</Text>
          <TextInput style={styles.input} placeholder="t.ex. 5" value={antalDagar} onChangeText={hanteraAntalDagar} keyboardType="numeric" />
          {dagScheman.length === 0 && <FältFel text={fel.schema} />}

          {dagScheman.length > 0 && (
            <View style={styles.dagSektion}>
              {dagScheman.length > 1 && (
                <TouchableOpacity style={styles.kryssRad} onPress={toggleSammaTider} activeOpacity={0.7}>
                  <View style={[styles.kryssRuta, sammaTider && styles.kryssRutaAktiv]}>
                    {sammaTider && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.kryssText}>Samma tider varje dag</Text>
                </TouchableOpacity>
              )}
              {dagScheman.map((dag, i) => (
                <View key={i} style={styles.dagRad}>
                  <Text style={styles.dagEtikett}>Dag {i + 1}</Text>
                  <View style={styles.dagFält}>
                    <TouchableOpacity
                      style={[styles.input, styles.datumKnapp]}
                      onPress={() => öppnaPicker(i)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar-outline" size={16} color={dag.datum ? '#1a1a1a' : '#aaa'} />
                      <Text style={[styles.datumText, !dag.datum && styles.datumPlaceholder]}>
                        {dag.datum ? formatDatum(dag.datum) : 'Datum'}
                      </Text>
                    </TouchableOpacity>
                    <TidVäljare
                      style={{ flex: 1 }}
                      placeholder="08:00"
                      value={dag.start}
                      onChange={v => uppdateraDag(i, 'start', v)}
                    />
                    <Text style={styles.tidStreck}>–</Text>
                    <TidVäljare
                      style={{ flex: 1 }}
                      placeholder="17:00"
                      value={dag.slut}
                      onChange={v => uppdateraDag(i, 'slut', v)}
                    />
                  </View>
                </View>
              ))}
              <FältFel text={fel.schema} />
            </View>
          )}

          <Text style={styles.label}>OB-tillägg (obekväm arbetstid)</Text>
          {obTillagg.map((ob, i) => (
            <View key={i} style={styles.obRad}>
              <Text style={styles.obRadText}>
                {ob.start}–{ob.slut}: {ob.värde}{ob.typ === 'procent' ? '%' : ' kr/h'}
                {lon ? (() => {
                  const [sh = 0, sm = 0] = ob.start.split(':').map(Number);
                  const [eh = 0, em = 0] = ob.slut.split(':').map(Number);
                  const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
                  const timlön = parseFloat(lon) || 0;
                  const brutto = ob.typ === 'procent' ? h * timlön * (ob.värde / 100) : h * ob.värde;
                  const kostnad = beräknaFakturapris(brutto, gällandePåslag);
                  return kostnad > 0 ? ` = +${formateraPris(kostnad)} kr (er kostnad)` : '';
                })() : ''}
              </Text>
              <TouchableOpacity onPress={() => setObTillagg(prev => prev.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {obFormVisas ? (
            <View style={styles.obForm}>
              <View style={styles.obFormTider}>
                <TidVäljare
                  style={{ flex: 1 }}
                  placeholder="18:00"
                  value={obStart}
                  onChange={setObStart}
                />
                <Text style={styles.tidStreck}>–</Text>
                <TidVäljare
                  style={{ flex: 1 }}
                  placeholder="20:00"
                  value={obSlut}
                  onChange={setObSlut}
                />
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
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Publicera jobb</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Planval vid tredje passet samma månad */}
      <PrenumerationModal
        visible={planModalVisas}
        onClose={() => setPlanModalVisas(false)}
        timlön={parseFloat(lon) || 0}
        laddar={betalningLaddar}
        onUppgradera={uppgraderaTillPro}
        onFortsattUtan={fortsattUtanAbonnemang}
      />

      {/* Datumväljare – Android (native dialog) */}
      {Platform.OS === 'android' && dagPickerIndex !== null && (
        <DateTimePicker
          value={tempDatum}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, date) => {
            setDagPickerIndex(null);
            if (date) sparaDatum(dagPickerIndex, date);
          }}
        />
      )}

      {/* Datumväljare – iOS (modal med spinner) */}
      <Modal visible={Platform.OS === 'ios' && dagPickerIndex !== null} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerPanel}>
            <View style={styles.pickerRubrikRad}>
              <TouchableOpacity onPress={() => setDagPickerIndex(null)}>
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
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', letterSpacing: 0 },
  textArea: { height: 120 },

  väljarKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  väljarText: { fontSize: 15, color: '#1a1a1a' },
  väljarPlaceholder: { color: '#aaa' },

  typVäljare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#555', fontWeight: '500', fontSize: 14 },
  typTextAktiv: { color: '#fff' },

  inputFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  dagSektion: { marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, backgroundColor: '#fafafa' },
  kryssRad: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  kryssRuta: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  kryssRutaAktiv: { backgroundColor: '#2563eb' },
  kryssText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dagRad: { marginBottom: 12 },
  dagEtikett: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  dagFält: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumKnapp: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumText: { fontSize: 15, color: '#1a1a1a' },
  datumPlaceholder: { color: '#aaa' },
  tidInput: { flex: 1, textAlign: 'center' },
  tidStreck: { fontSize: 16, color: '#9ca3af' },

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
  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },
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
});
