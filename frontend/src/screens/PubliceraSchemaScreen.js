import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PrenumerationModal from '../components/PrenumerationModal';
import ProBesparing from '../components/ProBesparing';
import FältFel from '../components/FältFel';
import StadInput from '../components/StadInput';
import SchemaPassModal from '../components/SchemaPassModal';
import PassDetaljFält from '../components/PassDetaljFält';
import MånadsKalender from '../components/MånadsKalender';
import DatumVäljare from '../components/DatumVäljare';
import StegIndikator from '../components/StegIndikator';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import { valideraSchema } from '../utils/schemaValidering';
import { formatDagDatum, veckodagsNamn, datumIntervall, veckodagsIndex } from '../utils/datumHelper';
import { synkaPassMotDatum, uppdateraFält, ärKomplett, tillPayload, nyttPassId, sorteraPass, hittaKrockar, harNolltid, antalPassEfterSynk } from '../utils/schemaPass';
import { api } from '../api/klient';
import { KATEGORIER, PÅSLAG_GRATIS, beräknaFakturapris, formateraPris, beräknaAvdragFörPass, beräknaAvdragTotalt } from '../utils/konstanter';

const STEG_ETIKETTER = ['Grunduppgifter', 'Period och datum', 'Detaljer per pass', 'Avdrag och publicering'];
const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

// Ett klick på "Vardagar" över tre månader ger ~65 pass. Varje pass blir en Jobb-rad och en
// ansökan vid tilldelningen, och kopplingen sker i en sekventiell loop i schemaTilldelning –
// därför en bekräftelse innan det blir stort, och ett hårt tak.
const VARNA_ÖVER_ANTAL = 60;
const MAX_ANTAL_PASS = 200;

export default function PubliceraSchemaScreen({ navigation }) {
  const [steg, setSteg] = useState(1);

  // Steg 1
  const [titel, setTitel] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [plats, setPlats] = useState('');
  const [adress, setAdress] = useState('');
  const [timlon, setTimlon] = useState('');

  // Steg 2 – perioden är ren UI-ställning. Servern härleder schemats period ur passens
  // datum (se härledPeriod i backend/routes/scheman.js), så den skickas aldrig med.
  const [startdatum, setStartdatum] = useState('');
  const [slutdatum, setSlutdatum] = useState('');
  const [valdaDatum, setValdaDatum] = useState(() => new Set());
  const [visadMånad, setVisadMånad] = useState(() => {
    const idag = new Date();
    return { år: idag.getFullYear(), månad: idag.getMonth() };
  });

  // Steg 3
  const [pass, setPass] = useState([]);
  const [öppetPassId, setÖppetPassId] = useState(null);
  const [egnaKategorier, setEgnaKategorier] = useState([]);
  const [passModalVisas, setPassModalVisas] = useState(false);
  const [redigerarId, setRedigerarId] = useState(null);
  const [passUtkast, setPassUtkast] = useState(null);

  // Steg 4
  const [avdrag, setAvdrag] = useState([]);
  const [avdragFormVisas, setAvdragFormVisas] = useState(false);
  const [avdragNamn, setAvdragNamn] = useState('');
  const [avdragBelopp, setAvdragBelopp] = useState('');
  const [avdragTyp, setAvdragTyp] = useState('per_dag');

  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState({});
  const scrollRef = useRef(null);
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

  // Ref, inte state: vakten nedan läser flaggan när den anropas, och en omrendering hinner
  // inte påverka den bort-navigering vi just startat.
  const harPublicerat = useRef(false);

  // Android-bakåt (och svep tillbaka på iOS) ska gå ett steg bakåt i flödet, inte lämna
  // skärmen med ett halvfyllt schema. Först på steg 1 släpper vi igenom.
  useFocusEffect(
    useCallback(() => {
      const av = navigation.addListener('beforeRemove', e => {
        // Efter en lyckad publicering ska skärmen lämnas på riktigt. Utan den här raden
        // fångar vakten bort-navigeringen och backar till steg 3, eftersom man står på
        // steg 4 när schemat publicerats.
        if (harPublicerat.current) return;
        if (steg === 1) return;
        e.preventDefault();
        tillbaka();
      });
      return av;
    }, [navigation, steg])
  );

  const gällandePåslag = prenumeration?.paslag ?? PÅSLAG_GRATIS;
  const timlönTal = parseFloat(timlon) || 0;

  function rensaFel(nyckel) {
    setFel(prev => (prev[nyckel] ? { ...prev, [nyckel]: undefined } : prev));
  }

  // ---------------------------------------------------------- Steg 2: datum

  const periodDatum = useMemo(
    () => (startdatum && slutdatum ? datumIntervall(startdatum, slutdatum) : []),
    [startdatum, slutdatum]
  );

  // Krymps perioden hamnar redan valda datum utanför den. Att bara filtrera bort dem tyst
  // vore dataförlust: har man gått vidare till steg 3 och fyllt i tider ligger de i pass[],
  // och de skulle försvinna utan att någon sa något. Fråga i stället.
  function sättPeriod(vilken, värde) {
    const nyStart = vilken === 'start' ? värde : startdatum;
    const nySlut = vilken === 'slut' ? värde : slutdatum;

    const genomför = () => {
      if (vilken === 'start') setStartdatum(värde); else setSlutdatum(värde);
      rensaFel('period');
      if (nyStart && nySlut) {
        const inom = new Set(datumIntervall(nyStart, nySlut));
        setValdaDatum(prev => new Set([...prev].filter(d => inom.has(d))));
        setPass(prev => prev.filter(p => inom.has(p.datum)));
        const [år, månad] = nyStart.split('-').map(Number);
        setVisadMånad({ år, månad: månad - 1 });
      }
    };

    if (nyStart && nySlut) {
      const inom = new Set(datumIntervall(nyStart, nySlut));
      const utanför = [...valdaDatum].filter(d => !inom.has(d));
      const ifyllda = pass.filter(p => !inom.has(p.datum) && ärKomplett(p));
      if (utanför.length > 0) {
        return Alert.alert(
          'Datum hamnar utanför perioden',
          ifyllda.length > 0
            ? `${utanför.length} valda datum ligger utanför den nya perioden, varav ${ifyllda.length} redan har ifyllda tider. De tas bort.`
            : `${utanför.length} valda datum ligger utanför den nya perioden och tas bort.`,
          [{ text: 'Avbryt', style: 'cancel' }, { text: 'Ta bort', style: 'destructive', onPress: genomför }]
        );
      }
    }
    genomför();
  }

  function växlaDatum(datum) {
    setValdaDatum(prev => {
      const nästa = new Set(prev);
      if (nästa.has(datum)) nästa.delete(datum); else nästa.add(datum);
      return nästa;
    });
    rensaFel('datum');
  }

  // Veckodagsgenvägarna arbetar på HELA perioden, inte bara den visade månaden. De växlar:
  // är alla den veckodagen redan valda tas de bort, annars läggs de till. Ett feltryck går
  // därmed att ångra med samma knapp.
  function växlaVeckodagar(index) {
    const träffar = periodDatum.filter(d => index.includes(veckodagsIndex(d)));
    if (!träffar.length) return;
    setValdaDatum(prev => {
      const allaValda = träffar.every(d => prev.has(d));
      const nästa = new Set(prev);
      for (const d of träffar) { if (allaValda) nästa.delete(d); else nästa.add(d); }
      return nästa;
    });
    rensaFel('datum');
  }

  function bytMånad(riktning) {
    setVisadMånad(({ år, månad }) => {
      const ny = new Date(år, månad + riktning, 1);
      return { år: ny.getFullYear(), månad: ny.getMonth() };
    });
  }

  // Antalet pass steg 3 kommer att innehålla. Inte samma sak som valdaDatum.size, eftersom
  // en dag kan ha flera pass – därför visar Nästa-knappen det här talet, inte antalet datum.
  const antalPass = useMemo(() => antalPassEfterSynk(valdaDatum, pass), [valdaDatum, pass]);

  // ---------------------------------------------------------- Steg 3: pass

  const krockar = useMemo(() => hittaKrockar(pass), [pass]);
  const nolltider = useMemo(() => new Set(pass.filter(harNolltid).map(p => p.id)), [pass]);
  const ofullständiga = useMemo(() => pass.filter(p => !ärKomplett(p)).length, [pass]);

  // Härled ur pass i stället för att lita på öppetPassId. Tas passet bort när perioden
  // krymps blir öppetPass null av sig självt, och editorn slutar renderas utan upprensning.
  const öppetPass = pass.find(p => p.id === öppetPassId) ?? null;

  // Fälls editorn ut långt ner hamnar den bakom tangentbordet. Skrolla fram den.
  function scrollaFramEditor(y) {
    if (y > 0) scrollRef.current?.scrollTo({ y: Math.max(y - 120, 0), animated: true });
  }

  // Skriver ett fält till ETT pass. Sorterar medvetet INTE om listan: starttiden ingår i
  // sorteringen, så en omsortering mitt i redigeringen skulle få raden att hoppa bort under
  // fingret. tillPayload sorterar ändå innan schemat skickas.
  function ändraPass(id, fält, värde) {
    setPass(prev => uppdateraFält(prev, [id], fält, värde));
    rensaFel('pass');
  }

  function öppnaRedigera(p) {
    setRedigerarId(p.id);
    setPassUtkast(p);
    setPassModalVisas(true);
  }

  // Ett datum kan ha två pass med olika starttid – t.ex. Liftvärd 08–12 och Garderob 18–23.
  // Steg 2 väljer datum, så den möjligheten bor här i stället.
  function läggTillPassSammaDag(p) {
    setRedigerarId(null);
    setPassUtkast({ datum: p.datum, starttid: '', sluttid: '', kategori: p.kategori, ob_tillagg: [] });
    setPassModalVisas(true);
  }

  function sparaPass(nyttPass) {
    setPass(prev => sorteraPass(
      redigerarId == null
        ? [...prev, { ...nyttPass, id: nyttPassId() }]
        : prev.map(p => (p.id === redigerarId ? { ...p, ...nyttPass } : p))
    ));
    setPassModalVisas(false);
    rensaFel('pass');
  }

  function taBortPass(id) {
    setPass(prev => prev.filter(p => p.id !== id));
    // Datumet ska också bort ur kalendern om det var dagens sista pass.
    setValdaDatum(prev => {
      const kvar = pass.filter(p => p.id !== id);
      const datum = pass.find(p => p.id === id)?.datum;
      if (!datum || kvar.some(p => p.datum === datum)) return prev;
      const n = new Set(prev); n.delete(datum); return n;
    });
  }

  // ------------------------------------------------------- Steg 4: avdrag

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

  const avdragPerPass = beräknaAvdragFörPass(avdrag, pass.length);
  const avdragTotalt = beräknaAvdragTotalt(avdrag, pass.length);

  // ------------------------------------------------------- Navigering

  function gåVidare() {
    setFel({});
    setSteg(s => Math.min(s + 1, 4));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function nästa() {
    // EN valideringskälla: valideraSchema körs i sin helhet och rätt nycklar plockas ut per
    // steg. Egna regler här skulle bli en andra sanning vid sidan av den som speglar
    // backends valideraSchemaInput.
    const alla = valideraSchema({ titel, beskrivning, plats, adress, timlon, pass, avdrag });

    if (steg === 1) {
      const f = {};
      for (const nyckel of ['titel', 'beskrivning', 'plats', 'adress', 'timlon']) {
        if (alla[nyckel]) f[nyckel] = alla[nyckel];
      }
      if (Object.keys(f).length) { setFel(f); return; }
    }

    if (steg === 2) {
      if (!startdatum || !slutdatum) { setFel({ period: 'Välj både start- och slutdatum' }); return; }
      if (valdaDatum.size === 0) { setFel({ datum: 'Klicka i minst ett datum i kalendern' }); return; }
      if (valdaDatum.size > MAX_ANTAL_PASS) {
        setFel({ datum: `Högst ${MAX_ANTAL_PASS} pass per schema. Du har valt ${valdaDatum.size} datum.` });
        return;
      }

      // Bevarar ifyllda tider på datum som redan har pass – se synkaPassMotDatum.
      const nyaPass = synkaPassMotDatum(valdaDatum, pass);
      const fortsätt = () => {
        setPass(nyaPass);
        gåVidare();
      };

      if (nyaPass.length > VARNA_ÖVER_ANTAL) {
        return Alert.alert(
          'Många pass',
          `Det här skapar ${nyaPass.length} pass. Varje pass blir ett eget jobb när någon godkänns. Fortsätt?`,
          [{ text: 'Avbryt', style: 'cancel' }, { text: 'Fortsätt', onPress: fortsätt }]
        );
      }
      return fortsätt();
    }

    if (steg === 3) {
      if (alla.pass) { setFel({ pass: alla.pass }); return; }
      if (krockar.size > 0) {
        setFel({ pass: 'Två pass har samma datum och starttid – de är rödmarkerade nedan.' });
        return;
      }
      if (nolltider.size > 0) {
        setFel({ pass: 'Ett pass har samma start- och sluttid och blir noll timmar långt.' });
        return;
      }
    }

    gåVidare();
  }

  function tillbaka() {
    setFel({});
    setSteg(s => Math.max(s - 1, 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // ------------------------------------------------------- Publicera

  async function publicera({ accepteraHögrePåslag = false } = {}) {
    await api.skapaSchema({
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim(),
      adress: adress.trim(),
      typ: 'sommarjobb',
      timlon: timlönTal,
      pass: tillPayload(pass),
      avdrag,
      ...(accepteraHögrePåslag ? { acceptera_hogre_paslag: true } : {}),
    });

    Alert.alert('Klart!', `Schemat har publicerats med ${pass.length} pass.`, [
      { text: 'OK', onPress: tillMinaScheman },
    ]);
  }

  // Efter publicering hör schemat hemma under Mina annonser, inte i guiden man just lämnat.
  function tillMinaScheman() {
    harPublicerat.current = true;
    // MinaJobb ligger i en annan flik, så navigate bubblar upp till tab-navigatorn.
    navigation.navigate('MinaJobbTab', { screen: 'MinaJobb', params: { flik: 'scheman' } });
    // Töm guidens stack, annars ligger det publicerade schemat kvar ifyllt på steg 4 nästa
    // gång Publicera-fliken öppnas – skärmen avmonteras inte av ett flikbyte.
    navigation.popToTop();
  }

  async function hanteraPublicering() {
    // Full validering som sista grind – samma regler som backends valideraSchemaInput.
    const nyaFel = valideraSchema({ titel, beskrivning, plats, adress, timlon, pass, avdrag });
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
      if (error.kod === 'KRAVER_PLANVAL') { setPlanModalVisas(true); return; }
      Alert.alert('Fel', error.message);
    } finally {
      setLaddar(false);
    }
  }

  async function fortsattUtanAbonnemang() {
    setPlanModalVisas(false);
    setLaddar(true);
    try { await publicera({ accepteraHögrePåslag: true }); }
    catch (error) { Alert.alert('Fel', error.message); }
    finally { setLaddar(false); }
  }

  async function uppgraderaTillPro() {
    setBetalningLaddar(true);
    try {
      const { url } = await api.skapaCheckout();
      await Linking.openURL(url);
      setPlanModalVisas(false);
    } catch (error) { Alert.alert('Fel', error.message); }
    finally { setBetalningLaddar(false); }
  }

  // ------------------------------------------------------- Rendering

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StegIndikator steg={steg} antal={4} etiketter={STEG_ETIKETTER} onVäljSteg={setSteg} />

        <ScrollView ref={scrollRef} style={styles.container} keyboardShouldPersistTaps="handled">
          {steg === 1 && (
            <>
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
            </>
          )}

          {steg === 2 && (
            <>
              <Text style={styles.label}>Period *</Text>
              <View style={styles.periodRad}>
                <DatumVäljare
                  värde={startdatum}
                  onÄndra={(d) => sättPeriod('start', d)}
                  placeholder="Från"
                  minimumDate={new Date()}
                  style={{ flex: 1 }}
                  fel={!!fel.period}
                />
                <Text style={styles.streck}>–</Text>
                <DatumVäljare
                  värde={slutdatum}
                  onÄndra={(d) => sättPeriod('slut', d)}
                  placeholder="Till"
                  minimumDate={startdatum ? new Date(startdatum + 'T12:00:00') : new Date()}
                  style={{ flex: 1 }}
                  fel={!!fel.period}
                />
              </View>
              <FältFel text={fel.period} />

              {periodDatum.length > 0 && (
                <>
                  <View style={styles.rubrikRad}>
                    <Text style={[styles.label, styles.labelIRad]}>Välj passdatum *</Text>
                    <View style={[styles.räknarePill, valdaDatum.size > 0 && styles.räknarePillAktiv]}>
                      <Text style={[styles.räknareText, valdaDatum.size > 0 && styles.räknareTextAktiv]}>
                        {valdaDatum.size === 0 ? 'Inga datum valda' : `${valdaDatum.size} datum valda`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.datumHjälpText}>Tryck på de datum du vill ha pass.</Text>

                  <Text style={styles.label}>Snabbval</Text>
                  <View style={styles.chipRad}>
                    {VECKODAGAR.map((namn, i) => (
                      <TouchableOpacity key={namn} style={styles.chip} onPress={() => växlaVeckodagar([i])} activeOpacity={0.7}>
                        <Text style={styles.chipText}>{namn}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.chipRad}>
                    <TouchableOpacity style={styles.chipBred} onPress={() => växlaVeckodagar([0, 1, 2, 3, 4])} activeOpacity={0.7}>
                      <Text style={styles.chipText}>Vardagar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chipBred} onPress={() => växlaVeckodagar([5, 6])} activeOpacity={0.7}>
                      <Text style={styles.chipText}>Helger</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chipRensa} onPress={() => setValdaDatum(new Set())} activeOpacity={0.7}>
                      <Text style={styles.chipRensaText}>Rensa</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.kalenderRam}>
                    <MånadsKalender
                      år={visadMånad.år}
                      månad={visadMånad.månad}
                      valdaDatum={valdaDatum}
                      minDatum={startdatum}
                      maxDatum={slutdatum}
                      onVäljDag={växlaDatum}
                      onBytMånad={bytMånad}
                    />
                  </View>

                  <FältFel text={fel.datum} />
                </>
              )}

              {periodDatum.length === 0 && (
                <Text style={styles.tomText}>Välj en period ovan så visas kalendern.</Text>
              )}
            </>
          )}

          {steg === 3 && (
            <>
              <View style={styles.hjälpRuta}>
                <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
                <Text style={styles.hjälpText}>
                  Tryck på ett pass för att fylla i tider, roll och OB.
                </Text>
              </View>

              <View style={styles.passRubrikRad}>
                <Text style={styles.label}>Pass ({pass.length})</Text>
                <View style={styles.rubrikHöger}>
                  {ofullständiga > 0 && <Text style={styles.varning}>{ofullständiga} saknar tider</Text>}
                  {krockar.size > 0 && <Text style={styles.varning}>{krockar.size} krockar</Text>}
                </View>
              </View>

              <View style={styles.passLista}>
                {pass.map(p => {
                  const fel = krockar.has(p.id) || nolltider.has(p.id);
                  const öppet = öppetPassId === p.id;
                  return (
                    <View key={p.id}>
                      <View style={[styles.passRad, fel && styles.passRadFel, öppet && styles.passRadÖppen]}>
                        <TouchableOpacity
                          style={styles.passInnehåll}
                          onPress={() => setÖppetPassId(öppet ? null : p.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.passDatum}>
                            <Text style={styles.passVeckodag}>{veckodagsNamn(p.datum)}</Text>
                            <Text style={styles.passDatumText}>{formatDagDatum(p.datum)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            {/* Tiderna visas så snart NÅGON av dem är satt, så att ifyllnaden
                                syns direkt i listan utan att man öppnar passet. */}
                            {p.starttid || p.sluttid ? (
                              <Text style={[styles.passTid, fel && styles.passTidFel]}>
                                {p.starttid || '?'} – {p.sluttid || '?'}
                                {krockar.has(p.id) ? '  · krockar' : nolltider.has(p.id) ? '  · 0 timmar' : ''}
                              </Text>
                            ) : (
                              <Text style={styles.fyllI}>— fyll i tider —</Text>
                            )}
                            <View style={styles.passBrickor}>
                              {p.kategori?.trim() ? (
                                <View style={styles.rollBricka}><Text style={styles.rollBrickaText}>{p.kategori}</Text></View>
                              ) : null}
                              {p.ob_tillagg?.length > 0 && (
                                <View style={styles.obBricka}><Text style={styles.obBrickaText}>OB ×{p.ob_tillagg.length}</Text></View>
                              )}
                            </View>
                          </View>
                          <Ionicons name={öppet ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => läggTillPassSammaDag(p)} hitSlop={8} style={{ padding: 4 }}>
                          <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => taBortPass(p.id)} hitSlop={8} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Editorn ligger I raden, så den är alltid vid passet oavsett hur lång
                          listan är. key={p.id} nollställer ObRedigerares eget formulärstate
                          när man byter pass – annars kan ett halvifyllt OB-intervall
                          committas på fel pass. */}
                      {öppet && (
                        <View
                          key={p.id}
                          style={styles.editor}
                          onLayout={e => scrollaFramEditor(e.nativeEvent.layout.y)}
                        >
                          <View style={styles.editorDatumRad}>
                            <Text style={styles.editorRubrik}>
                              {veckodagsNamn(p.datum)} {formatDagDatum(p.datum)}
                            </Text>
                            <TouchableOpacity onPress={() => öppnaRedigera(p)} hitSlop={8}>
                              <Text style={styles.bytDatum}>Byt datum</Text>
                            </TouchableOpacity>
                          </View>
                          <PassDetaljFält
                            starttid={p.starttid}
                            sluttid={p.sluttid}
                            kategori={p.kategori ?? ''}
                            obTillagg={p.ob_tillagg ?? []}
                            onStarttid={(v) => ändraPass(p.id, 'starttid', v)}
                            onSluttid={(v) => ändraPass(p.id, 'sluttid', v)}
                            onKategori={(v) => ändraPass(p.id, 'kategori', v)}
                            onObTillagg={(v) => ändraPass(p.id, 'ob_tillagg', v)}
                            egnaKategorier={egnaKategorier}
                            standardKategorier={KATEGORIER}
                            timlön={timlönTal}
                            paslag={gällandePåslag}
                            obRubrik="OB-tillägg för det här passet"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <FältFel text={fel.pass} />
            </>
          )}

          {steg === 4 && (
            <>
              <View style={styles.sammanfattning}>
                <Text style={styles.sammanfattningTitel}>{titel}</Text>
                <Text style={styles.sammanfattningRad}>
                  {pass.length} pass · {formatDagDatum(pass[0]?.datum)} – {formatDagDatum(pass[pass.length - 1]?.datum)}
                </Text>
                <Text style={styles.sammanfattningRad}>{plats} · {timlönTal} kr/tim</Text>
              </View>

              <Text style={styles.label}>Löneavdrag</Text>
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
                  <TextInput style={styles.input} placeholder="Namn, t.ex. Boende" value={avdragNamn} onChangeText={setAvdragNamn} maxLength={40} />
                  <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Belopp i kr" value={avdragBelopp} onChangeText={setAvdragBelopp} keyboardType="numeric" />
                  <View style={styles.typVäljare}>
                    {[['per_dag', 'Per pass'], ['totalt', 'Totalt']].map(([v, etikett]) => (
                      <TouchableOpacity key={v} style={[styles.typKnapp, avdragTyp === v && styles.typKnappAktiv]} onPress={() => setAvdragTyp(v)}>
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
                    totalt {formateraPris(avdragTotalt)} kr från lönen.
                  </Text>
                </View>
              )}

              {(fel.titel || fel.beskrivning || fel.plats || fel.adress || fel.timlon || fel.pass) && (
                <Text style={styles.slutfel}>
                  Något saknas i ett tidigare steg: {[fel.titel, fel.beskrivning, fel.plats, fel.adress, fel.timlon, fel.pass].filter(Boolean).join('. ')}
                </Text>
              )}
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.navRad}>
          {steg > 1 && (
            <TouchableOpacity style={styles.tillbakaKnapp} onPress={tillbaka} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={18} color="#2563eb" />
              <Text style={styles.tillbakaText}>Tillbaka</Text>
            </TouchableOpacity>
          )}
          {steg < 4 ? (
            <TouchableOpacity style={styles.nästaKnapp} onPress={nästa} activeOpacity={0.8}>
              {/* Antalet bara i datumsteget, där det säger något. "(0 pass)" vore
                  meningslöst – nästa blockerar ändå med fel.datum. */}
              <Text style={styles.nästaText}>
                {steg === 2 && antalPass > 0 ? `Nästa (${antalPass} pass)` : 'Nästa'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nästaKnapp, laddar && styles.knappInaktiv]} onPress={hanteraPublicering} disabled={laddar} activeOpacity={0.8}>
              {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.nästaText}>Publicera schema</Text>}
            </TouchableOpacity>
          )}
        </View>
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
        rubrik={redigerarId == null ? 'Nytt pass' : 'Redigera pass'}
        minDatum={startdatum}
        maxDatum={slutdatum}
      />

      <PrenumerationModal
        visible={planModalVisas}
        onClose={() => setPlanModalVisas(false)}
        timlön={timlönTal}
        laddar={betalningLaddar}
        onUppgradera={uppgraderaTillPro}
        onFortsattUtan={fortsattUtanAbonnemang}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 120 },
  inputFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  tomText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginTop: 20, textAlign: 'center' },

  infoRuta: { flexDirection: 'row', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#bae6fd' },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },

  prisKalkyl: { backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 8, gap: 4, borderWidth: 1, borderColor: '#bae6fd' },
  prisRad: { fontSize: 13, color: '#0369a1' },
  prisFet: { fontWeight: '700', color: '#0369a1' },
  prisFetBlå: { fontWeight: '700', color: '#1d4ed8' },

  periodRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streck: { fontSize: 16, color: '#9ca3af' },
  chipRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  chipBred: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  chipText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  chipRensa: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  chipRensaText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  kalenderRam: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  rubrikRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelIRad: { marginBottom: 0 },
  datumHjälpText: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  // Neutral när inget är valt, så en tom räknare inte ser ut som ett ifyllt tillstånd.
  räknarePill: { backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 16 },
  räknarePillAktiv: { backgroundColor: '#eff6ff' },
  räknareText: { fontSize: 13, color: '#9ca3af', fontWeight: '700' },
  räknareTextAktiv: { color: '#2563eb' },

  hjälpRuta: { flexDirection: 'row', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#bae6fd' },
  hjälpText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },

  rubrikHöger: { flexDirection: 'row', gap: 10 },

  passRadÖppen: { backgroundColor: '#eff6ff' },
  editor: { backgroundColor: '#f8faff', paddingHorizontal: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  editorDatumRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  editorRubrik: { fontSize: 13, fontWeight: '700', color: '#1d4ed8', textTransform: 'capitalize' },
  bytDatum: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  passRubrikRad: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  varning: { fontSize: 12, color: '#c2410c', fontWeight: '700', marginBottom: 6 },
  passLista: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  passRad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fafafa' },
  passInnehåll: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  passDatum: { width: 66 },
  passVeckodag: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '600' },
  passDatumText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  passTid: { fontSize: 14, color: '#374151', fontWeight: '500' },
  passRadFel: { backgroundColor: '#fef2f2' },
  passTidFel: { color: '#dc2626', fontWeight: '700' },
  fyllI: { fontSize: 13, color: '#c2410c', fontStyle: 'italic' },
  passBrickor: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  rollBricka: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rollBrickaText: { fontSize: 11, color: '#2563eb', fontWeight: '700' },
  obBricka: { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  obBrickaText: { fontSize: 11, color: '#c2410c', fontWeight: '700' },

  sammanfattning: { backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  sammanfattningTitel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sammanfattningRad: { fontSize: 13, color: '#0369a1' },

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
  slutfel: { fontSize: 13, color: '#dc2626', marginTop: 14, lineHeight: 18 },

  typVäljare: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typKnapp: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', backgroundColor: '#fff' },
  typKnappAktiv: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  typText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
  typTextAktiv: { color: '#fff' },

  navRad: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  tillbakaKnapp: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18 },
  tillbakaText: { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  nästaKnapp: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14 },
  nästaText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  knappInaktiv: { backgroundColor: '#93c5fd' },
});
