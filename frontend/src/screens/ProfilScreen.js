import { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert, Linking, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { api, felText } from '../api/klient';
import { useRealtidsPing } from '../context/RealtidsContext';
import { useAppStateAktiv } from '../utils/useAppStateAktiv';
import { BetygsSammanfattning, BetygsLista } from '../components/BetygsSektion';
import DokumentLista from '../components/DokumentLista';
import Knapp from '../components/Knapp';
import { FÄRG, TEXT, RADIE, STIL, SKUGGA } from '../utils/tema';
import {
  PÅSLAG_PRO,
  PÅSLAG_GRATIS,
  PRO_PRIS_KR,
  beräknaFakturapris,
  formateraPris,
} from '../utils/konstanter';

// Exempeltimlön som används för att visa vad Pro är värt på profilsidan.
const EXEMPEL_TIMLÖN = 150;

function ProfilSektion({ rubrik, innehall }) {
  if (!innehall) return null;
  return (
    <View style={styles.sektion}>
      <Text style={styles.sektionsRubrik}>{rubrik}</Text>
      <Text style={styles.sektionsText}>{innehall}</Text>
    </View>
  );
}

export default function ProfilScreen({ navigation }) {
  const { användare, loggaUt } = useAuth();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const [betyg, setBetyg] = useState(null);
  const [profil, setProfil] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [laddaUppBild, setLaddaUppBild] = useState(false);
  const [prenumerationLaddar, setPrenumerationLaddar] = useState(false);
  const [raderar, setRaderar] = useState(false);

  // Mjuk entré: innehållet tonar in och glider upp en aning när profilen laddats.
  const tona = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (laddar) return;
    Animated.timing(tona, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [laddar]);
  const glid = tona.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  // Radering av konto i två steg. Det är ett oåterkalleligt val som ligger direkt
  // under "Logga ut", så den första dialogen förklarar konsekvensen och den andra
  // fångar feltryck.
  function bekräftaRadering() {
    Alert.alert(
      'Ta bort konto',
      ärPrivatperson
        ? 'Ditt konto stängs och alla dina personuppgifter raderas: namn, e-post, telefonnummer, profilbild och CV.\n\nRedan utförda pass och dina tidrapporter sparas, eftersom de behövs för att du ska få betalt. Ansökningar som väntar på svar dras tillbaka.\n\nDu kan inte logga in igen efteråt.'
        : 'Ert konto stängs och alla era uppgifter raderas: kontaktuppgifter, fakturauppgifter, beskrivning och logotyp. Era annonser och scheman försvinner ur appen.\n\nRedan utfört arbete och underlag för fakturering sparas.\n\nNi kan inte logga in igen efteråt.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Fortsätt', style: 'destructive', onPress: bekräftaSlutgiltigt },
      ]
    );
  }

  function bekräftaSlutgiltigt() {
    Alert.alert(
      'Är du helt säker?',
      'Det går inte att ångra.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Ta bort mitt konto', style: 'destructive', onPress: taBortKonto },
      ]
    );
  }

  async function taBortKonto() {
    setRaderar(true);
    try {
      await api.taBortKonto();
      // Loggar ut direkt: token i telefonen gäller annars tills den går ut, och
      // appen skulle visa ett konto som inte längre finns.
      await loggaUt();
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
      setRaderar(false);
    }
  }

  // Öppnar Stripe Checkout i webbläsaren. När företaget kommer tillbaka till appen
  // hämtas profilen om (useFocusEffect), och webhooken har då hunnit sätta status.
  async function uppgraderaTillPro() {
    setPrenumerationLaddar(true);
    try {
      const { url } = await api.skapaCheckout();
      await Linking.openURL(url);
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setPrenumerationLaddar(false);
    }
  }

  // Öppnar Stripes kundportal, där företaget själv kan ändra eller avsluta sin
  // prenumeration.
  async function hanteraPrenumeration() {
    setPrenumerationLaddar(true);
    try {
      const { url } = await api.öppnaPortal();
      await Linking.openURL(url);
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setPrenumerationLaddar(false);
    }
  }

  async function hämta() {
    try {
      const [profilData, betygData] = await Promise.all([
        api.hämtaProfil(),
        användare?.id ? api.hämtaBetyg(användare.id) : null,
      ]);
      setProfil(profilData);
      if (betygData) setBetyg(betygData);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  // Stripe Checkout och kundportalen öppnas i den externa webbläsaren. Webhooken skickar
  // visserligen en realtidsping när prenumerationen ändras, men den kopplingen tappas ofta
  // medan appen ligger i bakgrunden på mobil – detta är säkerhetsnätet som säkerställer att
  // statusen är färsk när användaren kommer tillbaka.
  useAppStateAktiv(() => { hämta(); });

  // Realtid: nya betyg dyker upp på egna profilen direkt
  useRealtidsPing(() => { hämta(); });

  async function väljaProfilBild() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Tillstånd saknas', 'Appen behöver tillgång till ditt bildbibliotek.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;

    setLaddaUppBild(true);
    try {
      const { url } = await api.laddaUppProfilBild(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setProfil(prev => ({ ...prev, profilBild: url }));
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setLaddaUppBild(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollInnehall}>
      <Animated.View style={{ opacity: tona, transform: [{ translateY: glid }] }}>
        <LinearGradient colors={FÄRG.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner} />
        <View style={styles.innehall}>
      <TouchableOpacity
        onPress={väljaProfilBild}
        style={styles.avatarWrapper}
        disabled={laddaUppBild}
        accessibilityRole="button"
        accessibilityLabel="Byt profilbild"
      >
        {profil?.profilBild ? (
          <Image source={{ uri: profil.profilBild }} style={styles.profilBild} accessible={false} importantForAccessibility="no" />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{användare?.namn?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.kameraIkon}>
          {laddaUppBild
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="camera" size={14} color="#fff" accessible={false} importantForAccessibility="no" />
          }
        </View>
      </TouchableOpacity>

      <Text style={styles.namn}>{användare?.namn}</Text>
      <Text style={styles.email}>{användare?.email}</Text>

      <View style={styles.typBadge}>
        <Text style={styles.typText}>{ärPrivatperson ? 'Privatperson' : 'Företag'}</Text>
      </View>

      <BetygsSammanfattning betyg={betyg} />

      {ärPrivatperson && profil?.totalTimmar > 0 && (
        <View style={styles.timmArBadge}>
          <Ionicons name="time-outline" size={16} color="#059669" accessible={false} importantForAccessibility="no" />
          <Text style={styles.timmArText}>{profil.totalTimmar} jobbade timmar</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.redigeraKnapp}
        onPress={() => navigation.navigate('RedigeraProfil', { profil })}
        accessibilityRole="button"
        accessibilityLabel="Redigera profil"
      >
        <Ionicons name="create-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
        <Text style={styles.redigeraText}>Redigera profil</Text>
      </TouchableOpacity>

      {ärPrivatperson && (
        <DokumentLista redigerbar dokument={profil?.dokument} onÄndrad={hämta} />
      )}

      {/* Bemanningsöversikt: vilka dagar företaget har personal och vem som jobbar när. */}
      {!ärPrivatperson && (
        <TouchableOpacity
          style={styles.redigeraKnapp}
          onPress={() => navigation.navigate('SchemaKalender')}
          accessibilityRole="button"
          accessibilityLabel="Schemaöversikt"
        >
          <Ionicons name="calendar-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
          <Text style={styles.redigeraText}>Schemaöversikt</Text>
        </TouchableOpacity>
      )}

      {ärPrivatperson && (
        <>
          <ProfilSektion rubrik="CV / Om mig" innehall={profil?.cv} />
          <ProfilSektion rubrik="Tidigare erfarenheter" innehall={profil?.erfarenheter} />
          <ProfilSektion rubrik="Kompetenser" innehall={profil?.kompetenser} />
          <ProfilSektion rubrik="Intressen" innehall={profil?.intressen} />

          {!profil?.cv && !profil?.erfarenheter && !profil?.kompetenser && !profil?.intressen && (
            <Text style={styles.tomProfil}>Fyll i ditt CV och erfarenheter för att sticka ut när du söker jobb.</Text>
          )}
        </>
      )}

      {!ärPrivatperson && (
        <>
          {profil?.pro ? (
            <View style={styles.prenumerationKort}>
              <View style={styles.proRad}>
                <View style={styles.proBadge}>
                  <Ionicons name="star" size={12} color="#fff" accessible={false} importantForAccessibility="no" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
                <Text style={styles.proAktivText}>Lägsta pris på alla pass</Text>
              </View>

              <TouchableOpacity
                style={styles.hanteraKnapp}
                onPress={hanteraPrenumeration}
                disabled={prenumerationLaddar}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Hantera prenumeration"
              >
                {prenumerationLaddar ? (
                  <ActivityIndicator color={FÄRG.primär} size="small" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
                    <Text style={styles.hanteraText}>Hantera prenumeration</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.prenumerationKort}>
              <TouchableOpacity
                style={styles.uppgraderaKnapp}
                onPress={uppgraderaTillPro}
                disabled={prenumerationLaddar}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Uppgradera till Pro – ${PRO_PRIS_KR} kr per månad`}
              >
                {prenumerationLaddar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="star" size={16} color="#fff" accessible={false} importantForAccessibility="no" />
                    <Text style={styles.uppgraderaText}>Uppgradera till Pro – {PRO_PRIS_KR} kr/mån</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.exempelText}>
                Exempel: Med en timlön på {EXEMPEL_TIMLÖN} kr/h blir er kostnad{' '}
                <Text style={styles.exempelFramhävd}>
                  {formateraPris(beräknaFakturapris(EXEMPEL_TIMLÖN, PÅSLAG_PRO))} kr/h
                </Text>{' '}
                istället för{' '}
                <Text style={styles.exempelÖverstruken}>
                  {formateraPris(beräknaFakturapris(EXEMPEL_TIMLÖN, PÅSLAG_GRATIS))} kr/h
                </Text>
              </Text>
            </View>
          )}

          <ProfilSektion rubrik="Om företaget" innehall={profil?.beskrivning} />
          <ProfilSektion rubrik="Bransch" innehall={profil?.bransch} />
          <ProfilSektion rubrik="Stad" innehall={profil?.stad} />
          <ProfilSektion rubrik="Hemsida" innehall={profil?.hemsida} />
        </>
      )}

      <BetygsLista betyg={betyg} rubrik={ärPrivatperson ? 'Betyg från arbetsgivare' : 'Omdömen från personal'} />

      <Knapp text="Logga ut" variant="fara" onPress={loggaUt} style={styles.loggaUtKnapp} />

      <TouchableOpacity
        style={styles.integritetspolicyKnapp}
        onPress={() => navigation.navigate('Integritetspolicy')}
        accessibilityRole="button"
        accessibilityLabel="Integritetspolicy"
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
        <Text style={styles.integritetspolicyText}>Integritetspolicy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.taBortKontoKnapp}
        onPress={bekräftaRadering}
        disabled={raderar}
        accessibilityRole="button"
        accessibilityLabel="Ta bort konto"
      >
        {raderar
          ? <ActivityIndicator color={FÄRG.textSvag} size="small" />
          : <Text style={styles.taBortKontoText}>Ta bort konto</Text>
        }
      </TouchableOpacity>

          <Text style={styles.appNamn}>FastGig</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FÄRG.bakgrund },
  scrollInnehall: { paddingBottom: 48 },
  // Gradient-banner i toppen; avataren överlappar dess nederkant.
  banner: { height: 128, width: '100%' },
  innehall: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8, marginTop: -56 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: FÄRG.primär, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: FÄRG.yta, ...SKUGGA.lyft },
  profilBild: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, borderColor: FÄRG.yta, ...SKUGGA.lyft },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  kameraIkon: { position: 'absolute', bottom: 2, right: 2, backgroundColor: FÄRG.primär, borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: FÄRG.yta },
  namn: { ...TEXT.rubrikL, color: FÄRG.text, marginBottom: 4 },
  email: { fontSize: 15, color: FÄRG.textDämpad, marginBottom: 12 },
  typBadge: { backgroundColor: FÄRG.primärMjuk, paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIE.pill, marginBottom: 16 },
  typText: { color: FÄRG.primär, fontWeight: '700' },
  timmArBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: FÄRG.framgångMjuk, borderRadius: RADIE.pill, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 20 },
  timmArText: { fontSize: 14, color: '#059669', fontWeight: '700' },
  redigeraKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'stretch', borderWidth: 1.5, borderColor: FÄRG.primärKant, backgroundColor: FÄRG.primärMjuk, borderRadius: RADIE.sm, paddingVertical: 13, paddingHorizontal: 20, marginBottom: 14 },
  redigeraText: { color: FÄRG.primär, fontWeight: '700', fontSize: 15 },
  integritetspolicyKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'stretch', borderWidth: 1.5, borderColor: FÄRG.kant, borderRadius: RADIE.sm, paddingVertical: 13, paddingHorizontal: 20, marginTop: 14 },
  integritetspolicyText: { color: FÄRG.primär, fontWeight: '700', fontSize: 15 },
  sektion: { width: '100%', ...STIL.kort, marginBottom: 14 },
  sektionsRubrik: { ...TEXT.överlinje, color: FÄRG.textDämpad, marginBottom: 6 },
  sektionsText: { fontSize: 15, color: FÄRG.text, lineHeight: 22 },
  tomProfil: { fontSize: 14, color: FÄRG.textSvag, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  loggaUtKnapp: { marginTop: 16 },

  prenumerationKort: { width: '100%', backgroundColor: '#f5f7ff', borderWidth: 1, borderColor: FÄRG.primärKant, borderRadius: RADIE.md, padding: 16, marginBottom: 14, ...SKUGGA.mjuk },
  proRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: FÄRG.primär, borderRadius: RADIE.pill, paddingVertical: 3, paddingHorizontal: 10 },
  proBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  proAktivText: { fontSize: 14, fontWeight: '600', color: FÄRG.text },
  hanteraKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: FÄRG.primärKant, backgroundColor: FÄRG.yta, borderRadius: RADIE.sm, paddingVertical: 12, minHeight: 44 },
  hanteraText: { color: FÄRG.primär, fontWeight: '700', fontSize: 14 },
  uppgraderaKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: FÄRG.primär, borderRadius: RADIE.sm, paddingVertical: 14, minHeight: 44, ...SKUGGA.lyft, shadowColor: FÄRG.primärDjup },
  uppgraderaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  exempelText: { fontSize: 12, color: FÄRG.textDämpad, marginTop: 10, lineHeight: 18, textAlign: 'center' },
  exempelFramhävd: { fontWeight: '700', color: FÄRG.primär },
  exempelÖverstruken: { textDecorationLine: 'line-through', color: FÄRG.textSvag },
  // Nedtonad jämfört med "Logga ut": raderingen ska gå att hitta (App Store kräver
  // det) utan att bjuda in till feltryck.
  taBortKontoKnapp: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  taBortKontoText: { color: FÄRG.textSvag, fontSize: 14, textDecorationLine: 'underline' },
  appNamn: { marginTop: 32, fontSize: 13, fontWeight: '700', color: FÄRG.primär, letterSpacing: 1 },
});
