import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, SectionList, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, felText } from '../api/klient';

// Datum visas överallt i samma ISO-format (sv-SE), så att en admin aldrig behöver gissa om
// "08/09" är 8 sep eller 9 aug. "(N dagar sedan)" följer med som sekundär orientering.
function visaDatum(x) {
  return x ? new Date(x).toLocaleDateString('sv-SE') : '–';
}
function dagarSedanText(x) {
  if (!x) return '';
  const dagar = Math.floor((Date.now() - new Date(x).getTime()) / (1000 * 60 * 60 * 24));
  return `${dagar} ${dagar === 1 ? 'dag' : 'dagar'} sedan`;
}
function isoDatum(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function kr(belopp) {
  return `${Math.round(belopp ?? 0).toLocaleString('sv-SE')} kr`;
}
function antal(n) {
  return (Math.round(Number(n) || 0)).toLocaleString('sv-SE');
}

// Period-pillarna på Dashboard-fliken. Speglar web/src/utils/tidsfilter.js: alla intervall är
// "fram till nu", så bara den undre gränsen (from) varierar och skickas som ?from=YYYY-MM-DD.
const TIDSPERIODER = [
  { nyckel: 'denna-manad', etikett: 'Denna månad' },
  { nyckel: '3-manader', etikett: 'Senaste 3 mån' },
  { nyckel: '6-manader', etikett: 'Senaste 6 mån' },
  { nyckel: 'detta-ar', etikett: 'Detta år' },
  { nyckel: 'totalt', etikett: 'Totalt' },
];

// Undre datumgräns (YYYY-MM-DD) för en vald period, eller null för 'totalt'. Månad/år är
// kalenderankrade, 3/6 månader rullande från dagens datum – samma logik som tidsfilterFrån.
function frånDatumFörPeriod(nyckel, nu = new Date()) {
  switch (nyckel) {
    case '3-manader': return isoDatum(new Date(nu.getFullYear(), nu.getMonth() - 3, nu.getDate()));
    case '6-manader': return isoDatum(new Date(nu.getFullYear(), nu.getMonth() - 6, nu.getDate()));
    case 'detta-ar': return isoDatum(new Date(nu.getFullYear(), 0, 1));
    case 'totalt': return null;
    case 'denna-manad':
    default: return isoDatum(new Date(nu.getFullYear(), nu.getMonth(), 1));
  }
}

function periodEtikett(nyckel) {
  return (TIDSPERIODER.find(t => t.nyckel === nyckel) || TIDSPERIODER[0]).etikett;
}

// Litet siffer-kort för Dashboard-fliken.
function StatKort({ etikett, värde, under, primär }) {
  return (
    <View style={[styles.statKort, primär && styles.statKortPrimär]}>
      <Text style={styles.statEtikett}>{etikett}</Text>
      <Text style={styles.statVärde}>{värde}</Text>
      {under ? <Text style={styles.statUnder}>{under}</Text> : null}
    </View>
  );
}

export default function RapporterScreen({ navigation }) {
  const [aktivFlik, setAktivFlik] = useState('dashboard');
  const [rapporter, setRapporter] = useState([]);
  const [privatpersoner, setPrivatpersoner] = useState([]);
  const [företag, setFöretag] = useState([]);
  // Dashboard-statistik + vald period (styr aktivitet/ekonomi, inte användar-räknarna).
  const [statistik, setStatistik] = useState(null);
  const [tidsperiod, setTidsperiod] = useState('denna-manad');
  // Berikad privatpersonslista (varningar, pass, betyg) för Privatpersoner-fliken.
  const [privatpersonerStat, setPrivatpersonerStat] = useState([]);
  const [sökPrivatpersonStat, setSökPrivatpersonStat] = useState('');
  // Eskalerade bestridanden + per-rad-utkast (korrekta timmar + fusk-flagga) och sparar-id.
  const [bestridanden, setBestridanden] = useState([]);
  const [bestridandeTimmar, setBestridandeTimmar] = useState({});
  const [bestridandeFusk, setBestridandeFusk] = useState({});
  const [sparBestridande, setSparBestridande] = useState(null);
  const [faktureringsunderlag, setFaktureringsunderlag] = useState([]);
  const [faktureringFel, setFaktureringFel] = useState(null);
  const [raderadeKonton, setRaderadeKonton] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sökPrivatperson, setSökPrivatperson] = useState('');
  const [sökFöretag, setSökFöretag] = useState('');
  // Markerade tidrapporter för bulk-utbetalning (nivå 3).
  const [markerade, setMarkerade] = useState(new Set());
  // Privatpersonen vars avtal håller på att återkallas (null = modalen stängd) + orsak.
  const [avtalModal, setAvtalModal] = useState(null);
  const [avtalOrsak, setAvtalOrsak] = useState('');
  const [återkallar, setÅterkallar] = useState(false);

  // Rubriken speglar aktiv flik – annars stod det alltid "Tidrapporter" även på Företag.
  useEffect(() => {
    const titlar = { dashboard: 'Dashboard', rapporter: 'Tidrapporter', bestridanden: 'Bestridanden', avtal: 'Avtal', företag: 'Företag', fakturering: 'Fakturering', privatpersoner: 'Privatpersoner', raderade: 'Raderade konton' };
    navigation.setOptions({ title: titlar[aktivFlik] ?? 'Admin' });
  }, [aktivFlik, navigation]);

  async function hämta() {
    setLaddar(true);
    // De fyra admin-anropen är oberoende – kör dem parallellt i stället för i sekvens.
    // allSettled behåller den tidigare per-anrop-isoleringen: ett fel på ett anrop får
    // inte hindra de andra listorna från att laddas.
    const [rapporterRes, privatRes, företagRes, faktureringRes, raderadeRes, bestridandeRes, privatStatRes] = await Promise.allSettled([
      api.allaRapporter('', ''),
      api.hämtaAllaPrivatpersoner(),
      api.hämtaAllaFöretag(),
      api.hämtaFaktureringsunderlag(),
      api.hämtaRaderadeKonton(),
      api.adminBestridanden(),
      api.adminPrivatpersonerStatistik(),
    ]);

    if (rapporterRes.status === 'fulfilled') setRapporter(rapporterRes.value);
    else console.error('Rapporter:', rapporterRes.reason);

    if (privatRes.status === 'fulfilled') setPrivatpersoner(privatRes.value);
    else console.error('Privatpersoner:', privatRes.reason);

    if (bestridandeRes.status === 'fulfilled') setBestridanden(bestridandeRes.value);
    else console.error('Bestridanden:', bestridandeRes.reason);

    if (privatStatRes.status === 'fulfilled') setPrivatpersonerStat(privatStatRes.value);
    else console.error('Privatpersoner (statistik):', privatStatRes.reason);

    if (företagRes.status === 'fulfilled') setFöretag(företagRes.value);
    else console.error('Företag:', företagRes.reason);

    if (faktureringRes.status === 'fulfilled') {
      setFaktureringsunderlag(faktureringRes.value);
      setFaktureringFel(null);
    } else {
      setFaktureringFel(faktureringRes.reason ? felText(faktureringRes.reason) : 'Kunde inte hämta faktureringsunderlag');
    }

    if (raderadeRes.status === 'fulfilled') setRaderadeKonton(raderadeRes.value);
    else console.error('Raderade konton:', raderadeRes.reason);

    setLaddar(false);
  }

  async function markeraRapportBetald(id) {
    Alert.alert(
      'Bekräfta',
      'Markera denna rapport som betald? Rapporten finns kvar i företagets och personens historik.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', onPress: async () => {
          try {
            await api.markeraTidrapportBetald(id);
            setRapporter(prev => prev.filter(r => r.id !== id));
          } catch (fel) {
            Alert.alert('Fel', felText(fel));
          }
        }},
      ]
    );
  }

  // Bulk: markera alla valda tidrapporter som betalda i ett svep.
  function markeraMarkeradeBetalda() {
    const idn = [...markerade];
    if (!idn.length) return;
    Alert.alert(
      'Bekräfta',
      `Markera ${idn.length} ${idn.length === 1 ? 'rapport' : 'rapporter'} som betalda?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', onPress: async () => {
          try {
            await Promise.all(idn.map(id => api.markeraTidrapportBetald(id)));
            setRapporter(prev => prev.filter(r => !markerade.has(r.id)));
            setMarkerade(new Set());
          } catch (fel) {
            Alert.alert('Fel', felText(fel));
          }
        }},
      ]
    );
  }

  function växlaMarkerad(id) {
    setMarkerade(prev => {
      const nästa = new Set(prev);
      nästa.has(id) ? nästa.delete(id) : nästa.add(id);
      return nästa;
    });
  }

  // Filtrerar tidrapporter på ett datumintervall. Bruten ut ur filtreraRapporter så att
  // snabbvalen kan filtrera direkt utan att invänta setState.
  async function filtreraMed(från, till) {
    setLaddar(true);
    try {
      const data = await api.allaRapporter(från || null, till || null);
      setRapporter(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  function snabbvalMånad(offset) {
    const nu = new Date();
    const start = new Date(nu.getFullYear(), nu.getMonth() + offset, 1);
    const slut = new Date(nu.getFullYear(), nu.getMonth() + offset + 1, 0);
    setFromDate(isoDatum(start));
    setToDate(isoDatum(slut));
    filtreraMed(isoDatum(start), isoDatum(slut));
  }

  function rensaFilter() {
    setFromDate('');
    setToDate('');
    filtreraMed('', '');
  }

  async function markeraFakturerad(id) {
    Alert.alert(
      'Bekräfta',
      'Markera detta underlag som fakturerat och klart?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', onPress: async () => {
          try {
            await api.markeraFakturerad(id);
            setFaktureringsunderlag(prev => prev.filter(f => f.id !== id));
          } catch (fel) {
            Alert.alert('Fel', felText(fel));
          }
        }},
      ]
    );
  }

  // Bulk: markera ett helt företags underlag som fakturerade.
  function markeraFöretagFakturerat(sektion) {
    const idn = sektion.data.map(u => u.id);
    Alert.alert(
      'Bekräfta',
      `Markera alla ${idn.length} underlag för ${sektion.företag.foretagsnamn ?? 'företaget'} som fakturerade?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', onPress: async () => {
          try {
            await Promise.all(idn.map(id => api.markeraFakturerad(id)));
            const kvar = new Set(idn);
            setFaktureringsunderlag(prev => prev.filter(f => !kvar.has(f.id)));
          } catch (fel) {
            Alert.alert('Fel', felText(fel));
          }
        }},
      ]
    );
  }

  async function godkännAvtal(id) {
    try {
      await api.godkännAvtal(id);
      setPrivatpersoner(prev => prev.map(p => p.id === id ? { ...p, avtal_godkant: true } : p));
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    }
  }

  // Återkallar ett godkänt avtal med en orsak (skickas till personen via mejl av backend).
  async function bekräftaÅterkalla() {
    const orsak = avtalOrsak.trim();
    if (!avtalModal || !orsak || återkallar) return;
    setÅterkallar(true);
    try {
      await api.återkallaAvtal(avtalModal.id, orsak);
      setPrivatpersoner(prev => prev.map(p => p.id === avtalModal.id ? { ...p, avtal_godkant: false } : p));
      setAvtalModal(null);
      setAvtalOrsak('');
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setÅterkallar(false);
    }
  }

  // Ta tillbaka ett godkänt avtal på ett redan raderat konto. Ett tryck, ingen orsak och
  // inget mejl (backend skippar det) – kontot är ändå inaktivt och kan inte söka jobb.
  function återkallaAvtalRaderat(id) {
    Alert.alert(
      'Ta tillbaka avtal',
      'Ta tillbaka det godkända avtalet för detta raderade konto?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Ta tillbaka', style: 'destructive', onPress: async () => {
          try {
            await api.återkallaAvtalRaderad(id);
            setRaderadeKonton(prev => prev.map(k => k.id === id ? { ...k, avtal_godkant: false } : k));
          } catch (fel) {
            Alert.alert('Fel', felText(fel));
          }
        }},
      ]
    );
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  // Dashboard-statistiken hämtas separat och körs om när perioden byts – användar-räknarna
  // är ändå totaler, bara aktivitet/ekonomi påverkas av from-datumet.
  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const data = await api.adminStatistik(frånDatumFörPeriod(tidsperiod));
        if (!avbruten) setStatistik(data);
      } catch (fel) {
        console.error('Statistik:', fel);
      }
    })();
    return () => { avbruten = true; };
  }, [tidsperiod]);

  function ändraBestridandeTimmar(id, värde) {
    setBestridandeTimmar(prev => ({ ...prev, [id]: värde }));
  }
  function växlaBestridandeFusk(id) {
    setBestridandeFusk(prev => ({ ...prev, [id]: !prev[id] }));
  }
  // Rensar radens utkast efter en avslutad åtgärd.
  function rensaBestridandeUtkast(id) {
    setBestridandeTimmar(prev => { const n = { ...prev }; delete n[id]; return n; });
    setBestridandeFusk(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  // Skickar en korrigerad tidrapport (nya timmar) via det vanliga tidrapportsflödet. Raden
  // lämnar listan när vi hämtar om – den ursprungliga rapporten markeras som hanterad i backend.
  async function skickaKorrigering(id) {
    const timmar = Number(bestridandeTimmar[id]);
    if (!timmar || timmar <= 0) {
      Alert.alert('Ange timmar', 'Fyll i korrekta timmar (större än 0) innan du skickar en korrigering.');
      return;
    }
    setSparBestridande(`korr-${id}`);
    try {
      await api.adminKorrigeraBestridande(id, timmar, !!bestridandeFusk[id]);
      rensaBestridandeUtkast(id);
      setBestridanden(prev => prev.filter(r => r.id !== id));
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setSparBestridande(null);
    }
  }

  // Godkänner företagets ursprungliga rapport – den blir utbetalbar och faller ur listan.
  async function godkännUrsprunglig(id) {
    setSparBestridande(`godk-${id}`);
    try {
      await api.adminGodkännBestridande(id, !!bestridandeFusk[id]);
      rensaBestridandeUtkast(id);
      setBestridanden(prev => prev.filter(r => r.id !== id));
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setSparBestridande(null);
    }
  }

  const totaltBelopp = rapporter.reduce((sum, r) => sum + (r.totalt_belopp ?? 0), 0);
  const totaltTimmar = rapporter.reduce((sum, r) => sum + (r.timmar ?? 0), 0);
  // Löneavdragen minskar vad personerna får ut, men inte vad företagen faktureras.
  const totaltAvdrag = rapporter.reduce((sum, r) => sum + (r.avdrag_belopp ?? 0), 0);
  // Totalt belopp att fakturera – summan av alla ej fakturerade underlag.
  const totaltFaktura = faktureringsunderlag.reduce((sum, f) => sum + (f.faktureringsbelopp ?? 0), 0);
  const antalVäntandeAvtal = privatpersoner.filter(p => !p.avtal_godkant).length;

  // Fakturering grupperas per företag: adressblocket visas EN gång per grupp (i sektions-
  // huvudet) med en subtotal, i stället för att upprepas på varje underlagskort.
  const faktureringSektioner = useMemo(() => {
    const grupper = new Map();
    for (const u of faktureringsunderlag) {
      const nyckel = u.organisationsnummer || u.foretagsnamn || `okänt-${u.id}`;
      if (!grupper.has(nyckel)) grupper.set(nyckel, { key: String(nyckel), företag: u, data: [], subtotal: 0 });
      const g = grupper.get(nyckel);
      g.data.push(u);
      g.subtotal += (u.faktureringsbelopp ?? 0);
    }
    return [...grupper.values()];
  }, [faktureringsunderlag]);

  const sökQ = sökFöretag.trim().toLowerCase();
  const filtreradeFöretag = sökQ
    ? företag.filter(f =>
        (f.Namn || '').toLowerCase().includes(sökQ) ||
        (f.organisationsnummer || '').toLowerCase().includes(sökQ) ||
        (f.Email || '').toLowerCase().includes(sökQ))
    : företag;

  const sökQP = sökPrivatperson.trim().toLowerCase();
  const filtradePrivatpersoner = sökQP
    ? privatpersoner.filter(p =>
        (p.Namn || '').toLowerCase().includes(sökQP) ||
        (p.Email || '').toLowerCase().includes(sökQP))
    : privatpersoner;

  const sökQPS = sökPrivatpersonStat.trim().toLowerCase();
  const filtradePrivatpersonerStat = sökQPS
    ? privatpersonerStat.filter(p =>
        (p.Namn || '').toLowerCase().includes(sökQPS) ||
        (p.Email || '').toLowerCase().includes(sökQPS))
    : privatpersonerStat;

  function renderFlik(id, etikett, antal) {
    const aktiv = aktivFlik === id;
    return (
      <TouchableOpacity style={[styles.flik, aktiv && styles.flikAktiv]} onPress={() => setAktivFlik(id)}>
        <Text numberOfLines={1} style={[styles.flikText, aktiv && styles.flikTextAktiv]}>{etikett}</Text>
        {antal != null && (
          <View style={[styles.flikBadge, aktiv && styles.flikBadgeAktiv]}>
            <Text style={[styles.flikBadgeText, aktiv && styles.flikBadgeTextAktiv]}>{antal}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.flikarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flikar}>
          {renderFlik('dashboard', 'Dashboard')}
          {renderFlik('rapporter', 'Tidrapporter', rapporter.length)}
          {renderFlik('bestridanden', 'Bestridanden', bestridanden.length)}
          {renderFlik('avtal', 'Avtal', antalVäntandeAvtal)}
          {renderFlik('företag', 'Företag', företag.length)}
          {renderFlik('fakturering', 'Fakturering', faktureringsunderlag.length)}
          {renderFlik('privatpersoner', 'Privatpersoner', privatpersonerStat.length)}
          {renderFlik('raderade', 'Raderade', raderadeKonton.length)}
        </ScrollView>
      </View>

      {laddar ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      ) : aktivFlik === 'dashboard' ? (
        <ScrollView contentContainerStyle={styles.dashLista}>
          <View style={styles.periodRad}>
            {TIDSPERIODER.map((p) => {
              const aktiv = tidsperiod === p.nyckel;
              return (
                <TouchableOpacity key={p.nyckel} onPress={() => setTidsperiod(p.nyckel)} style={[styles.periodPill, aktiv && styles.periodPillAktiv]}>
                  <Text style={[styles.periodText, aktiv && styles.periodTextAktiv]}>{p.etikett}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!statistik ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" />
          ) : (
            <>
              <Text style={styles.dashRubrik}>Användare</Text>
              <Text style={styles.dashUnder}>Totalsiffror – påverkas inte av perioden.</Text>
              <View style={styles.statRad}>
                <StatKort etikett="Totalt användare" värde={antal(statistik.antalAnvändare)} primär />
                <StatKort etikett="Företag" värde={antal(statistik.antalFöretag)} />
              </View>
              <View style={styles.statRad}>
                <StatKort etikett="Privatpersoner" värde={antal(statistik.antalPrivatpersoner)} />
                <StatKort etikett="Nya (30 dagar)" värde={antal(statistik.nyaAnvändare30d)} under="Senaste 30 dagarna" />
              </View>

              <Text style={styles.dashRubrik}>Aktivitet</Text>
              <Text style={styles.dashUnder}>Avser {periodEtikett(tidsperiod).toLowerCase()} (Pro är en totalsiffra).</Text>
              <View style={styles.statRad}>
                <StatKort etikett="Godkända pass" värde={antal(statistik.godkändaPass)} />
                <StatKort etikett="Jobbade timmar" värde={`${(Number(statistik.totaltTimmar) || 0).toLocaleString('sv-SE')} h`} />
              </View>
              <View style={styles.statRad}>
                <StatKort etikett="Pro-prenumeranter" värde={antal(statistik.proPrenumeranter)} primär />
                <View style={styles.statKortTom} />
              </View>

              <Text style={styles.dashRubrik}>Ekonomi</Text>
              <Text style={styles.dashUnder}>Avser {periodEtikett(tidsperiod).toLowerCase()}, baserat på godkända tidrapporter.</Text>
              <View style={styles.statRad}>
                <StatKort etikett="Total fakturerad summa" värde={kr(statistik.fakturerat)} primär />
                <StatKort etikett="Total bruttolön" värde={kr(statistik.bruttolön)} />
              </View>
              <View style={styles.statRad}>
                <StatKort etikett="Påslagsintäkt (FastGig)" värde={kr(statistik.påslagsintäkt)} under="Fakturerat − arbetskostnad" />
                <View style={styles.statKortTom} />
              </View>
            </>
          )}
        </ScrollView>
      ) : aktivFlik === 'bestridanden' ? (
        <FlatList
          data={bestridanden}
          keyExtractor={(item) => String(item.id)}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={bestridanden.length > 0 ? (
            <Text style={styles.bestridInfo}>Bestridanden som inte hanterats inom 24 timmar och eskalerats till FastGig.</Text>
          ) : null}
          ListEmptyComponent={<Text style={styles.tom}>Inga eskalerade bestridanden just nu</Text>}
          renderItem={({ item }) => {
            const fusk = !!bestridandeFusk[item.id];
            const sparKorr = sparBestridande === `korr-${item.id}`;
            const sparGodk = sparBestridande === `godk-${item.id}`;
            return (
              <View style={styles.kort}>
                <View style={styles.titelRad}>
                  <Text style={[styles.namn, { flex: 1 }]} numberOfLines={1}>{item.anvandareNamn ?? 'Okänd'}</Text>
                  <Text style={styles.bestriddBadge}>Bestridd</Text>
                  {item.ärSchemapass && <Text style={styles.schemaBadge}>Schemapass</Text>}
                </View>
                <Text style={styles.jobbTitel} numberOfLines={1}>{item.jobbTitel ?? 'Pass'}</Text>
                <Text style={styles.sekundär}>{visaDatum(item.datum)} · {item.foretagNamn ?? 'Okänt företag'}</Text>

                <View style={[styles.kortDetaljer, { marginTop: 10 }]}>
                  <View style={styles.detalj}><Text style={styles.detaljEtikett}>Timmar</Text><Text style={styles.detaljVärde}>{Number(item.timmar) || 0}</Text></View>
                  <View style={styles.detalj}><Text style={styles.detaljEtikett}>Timlön</Text><Text style={styles.detaljVärde}>{kr(item.timlon)}</Text></View>
                  <View style={[styles.detalj, styles.detaljFramhavd]}><Text style={styles.detaljEtikett}>Totalt</Text><Text style={styles.detaljVärdeStor}>{kr(item.totalt_belopp)}</Text></View>
                </View>

                <View style={styles.bestridRuta}>
                  <Text style={styles.bestridEtikett}>Bestridande</Text>
                  <Text style={styles.bestridTextInner}>{item.bestridande_orsak || 'Ingen förklaring angiven'}</Text>
                  {item.bestridande_starttid && item.bestridande_sluttid ? (
                    <Text style={styles.bestridTid}>Föreslagen tid: {item.bestridande_starttid}–{item.bestridande_sluttid}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.fuskRad}
                  onPress={() => växlaBestridandeFusk(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: fusk }}
                >
                  <Ionicons name={fusk ? 'checkbox' : 'square-outline'} size={22} color={fusk ? '#dc2626' : '#cbd5e1'} />
                  <Text style={styles.fuskText}>Markera som fusk (skicka varning)</Text>
                </TouchableOpacity>

                <View style={styles.bestridAktioner}>
                  <TextInput
                    style={styles.timmarInput}
                    placeholder={`${Number(item.timmar) || 0} tim`}
                    keyboardType="numeric"
                    value={bestridandeTimmar[item.id] ?? ''}
                    onChangeText={(v) => ändraBestridandeTimmar(item.id, v)}
                  />
                  <TouchableOpacity style={[styles.korrKnapp, sparKorr && styles.knappAv]} disabled={sparKorr} onPress={() => skickaKorrigering(item.id)}>
                    <Text style={styles.korrText}>{sparKorr ? 'Skickar…' : 'Skicka korrigering'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.godkUrsprKnapp, sparGodk && styles.knappAv]} disabled={sparGodk} onPress={() => godkännUrsprunglig(item.id)}>
                  <Text style={styles.godkUrsprText}>{sparGodk ? 'Godkänner…' : 'Godkänn ursprunglig'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      ) : aktivFlik === 'privatpersoner' ? (
        <>
          <View style={styles.sökContainer}>
            <Ionicons name="search-outline" size={18} color="#aaa" style={styles.sökIkon} accessible={false} importantForAccessibility="no" />
            <TextInput
              style={styles.sökInput}
              placeholder="Sök på namn eller mejl..."
              value={sökPrivatpersonStat}
              onChangeText={setSökPrivatpersonStat}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filtradePrivatpersonerStat}
            keyExtractor={(item) => String(item.id)}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={8}
            contentContainerStyle={styles.lista}
            ListEmptyComponent={<Text style={styles.tom}>Inga privatpersoner hittades</Text>}
            renderItem={({ item }) => {
              const godkänt = item.avtal_godkant === true;
              const varn = Number(item.varningar) || 0;
              return (
                <View style={styles.kort}>
                  <View style={styles.namnRad}>
                    <TouchableOpacity style={{ flexShrink: 1 }} onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.id, ansokningId: null })}>
                      <Text style={[styles.namn, styles.klickbart]} numberOfLines={1}>{item.Namn || 'Namnlös'}</Text>
                    </TouchableOpacity>
                    <View style={[styles.avtalBadge, godkänt ? styles.avtalBadgeOk : styles.avtalBadgeNej]}>
                      <Text style={godkänt ? styles.avtalBadgeOkText : styles.avtalBadgeNejText}>{godkänt ? '✓ Avtal godkänt' : '✗ Ej godkänt'}</Text>
                    </View>
                  </View>
                  <Text style={styles.email}>{item.Email ?? '–'}{item.telefonnummer ? ` · ${item.telefonnummer}` : ''}</Text>
                  <View style={styles.statRutor}>
                    {varn > 0 && (
                      <View style={[styles.statRuta, styles.statRutaVarning]}>
                        <Text style={styles.statRutaVarningVärde}>{varn}</Text>
                        <Text style={styles.statRutaVarningEtikett}>Varningar</Text>
                      </View>
                    )}
                    <View style={styles.statRuta}>
                      <Text style={styles.statRutaVärde}>{Number(item.genomfördaPass) || 0}</Text>
                      <Text style={styles.statRutaEtikett}>Pass</Text>
                    </View>
                    <View style={styles.statRuta}>
                      <Text style={styles.statRutaVärde}>{item.betygSnitt != null ? `${item.betygSnitt}★` : '–'}</Text>
                      <Text style={styles.statRutaEtikett}>Betyg{item.betygAntal ? ` (${item.betygAntal})` : ''}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : aktivFlik === 'rapporter' ? (
        <>
          <View style={styles.filter}>
            <View style={styles.snabbval}>
              <TouchableOpacity style={styles.snabbKnapp} onPress={() => snabbvalMånad(0)}>
                <Text style={styles.snabbText}>Denna månad</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snabbKnapp} onPress={() => snabbvalMånad(-1)}>
                <Text style={styles.snabbText}>Förra månaden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snabbKnapp} onPress={rensaFilter}>
                <Text style={styles.snabbText}>Rensa</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterRad}>
              <TextInput
                style={[styles.datumInput, styles.datumInputFlex]}
                placeholder="Från (ÅÅÅÅ-MM-DD)"
                value={fromDate}
                onChangeText={setFromDate}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.datumInput, styles.datumInputFlex]}
                placeholder="Till (ÅÅÅÅ-MM-DD)"
                value={toDate}
                onChangeText={setToDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <TouchableOpacity style={styles.filterKnapp} onPress={() => filtreraMed(fromDate, toDate)}>
              <Text style={styles.filterKnappText}>Filtrera</Text>
            </TouchableOpacity>
          </View>

          {/* Sticky sammanfattning – syns utan att skrolla till listans slut. */}
          {rapporter.length > 0 && (
            <View style={styles.topbar}>
              <Text style={styles.topbarText}>{rapporter.length} {rapporter.length === 1 ? 'rapport' : 'rapporter'} · {totaltTimmar} tim</Text>
              <Text style={styles.topbarStark}>{kr(totaltBelopp - totaltAvdrag)} att betala ut</Text>
            </View>
          )}

          {markerade.size > 0 && (
            <View style={styles.bulkbar}>
              <Text style={styles.bulkbarText}>{markerade.size} markerade</Text>
              <View style={styles.bulkbarKnappar}>
                <TouchableOpacity onPress={() => setMarkerade(new Set())}>
                  <Text style={styles.bulkbarAvmark}>Avmarkera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkbarKnapp} onPress={markeraMarkeradeBetalda}>
                  <Text style={styles.bulkbarKnappText}>Markera som betalda</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FlatList
            data={rapporter}
            keyExtractor={(item) => item.id}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={8}
            contentContainerStyle={styles.lista}
            ListEmptyComponent={<Text style={styles.tom}>Inga godkända rapporter hittades</Text>}
            ListFooterComponent={rapporter.length > 0 ? (
              <View style={styles.summering}>
                <View style={styles.summeringRad}>
                  <Text style={styles.summeringEtikett}>Totalt antal rapporter</Text>
                  <Text style={styles.summeringVärde}>{rapporter.length}</Text>
                </View>
                <View style={styles.summeringRad}>
                  <Text style={styles.summeringEtikett}>Totalt timmar</Text>
                  <Text style={styles.summeringVärde}>{totaltTimmar} tim</Text>
                </View>
                <View style={[styles.summeringRad, styles.totalRad]}>
                  <Text style={styles.totalEtikett}>Totalt belopp</Text>
                  <Text style={styles.totalVärde}>{kr(totaltBelopp)}</Text>
                </View>
                {totaltAvdrag > 0 && (
                  <>
                    <View style={styles.summeringRad}>
                      <Text style={styles.summeringEtikett}>Varav löneavdrag</Text>
                      <Text style={[styles.summeringVärde, { color: '#dc2626' }]}>−{kr(totaltAvdrag)}</Text>
                    </View>
                    <View style={styles.summeringRad}>
                      <Text style={styles.summeringEtikett}>Att betala ut</Text>
                      <Text style={[styles.summeringVärde, { color: '#16a34a', fontWeight: '700' }]}>{kr(totaltBelopp - totaltAvdrag)}</Text>
                    </View>
                  </>
                )}
              </View>
            ) : null}
            renderItem={({ item }) => {
              const vald = markerade.has(item.id);
              return (
                <View style={[styles.kort, vald && styles.kortVald]}>
                  <View style={styles.kortHuvud}>
                    <TouchableOpacity
                      onPress={() => växlaMarkerad(item.id)}
                      style={styles.kryssruta}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Markera ${item.anvandareNamn ?? 'tidrapport'}`}
                      accessibilityState={{ checked: vald }}
                    >
                      <Ionicons name={vald ? 'checkbox' : 'square-outline'} size={22} color={vald ? '#2563eb' : '#cbd5e1'} accessible={false} importantForAccessibility="no" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.namn}>{item.anvandareNamn ?? '–'}</Text>
                      <Text style={styles.email}>{item.anvandareEmail ?? '–'}</Text>
                      {item.anvandareTelefon ? <Text style={styles.telefon}>{item.anvandareTelefon}</Text> : null}
                    </View>
                    <Text style={styles.datum}>{visaDatum(item.datum)}</Text>
                  </View>
                  {(item.jobbTitel || item.ärSchemapass) && (
                    <View style={styles.titelRad}>
                      {item.jobbTitel ? <Text style={styles.jobbTitel} numberOfLines={1}>{item.jobbTitel}</Text> : <View style={{ flex: 1 }} />}
                      {item.ärSchemapass && <Text style={styles.schemaBadge}>Schemapass</Text>}
                    </View>
                  )}
                  <View style={styles.kortDetaljer}>
                    <View style={styles.detalj}>
                      <Text style={styles.detaljEtikett}>Timmar</Text>
                      <Text style={styles.detaljVärde}>{item.timmar}</Text>
                    </View>
                    <View style={styles.detalj}>
                      <Text style={styles.detaljEtikett}>Timlön</Text>
                      <Text style={styles.detaljVärde}>{kr(item.timlon)}</Text>
                    </View>
                    <View style={[styles.detalj, styles.detaljFramhavd]}>
                      <Text style={styles.detaljEtikett}>Totalt</Text>
                      <Text style={styles.detaljVärdeStor}>{kr(item.totalt_belopp)}</Text>
                    </View>
                  </View>
                  {item.avdrag_belopp > 0 && (
                    <Text style={styles.avdragRad}>
                      Löneavdrag −{kr(item.avdrag_belopp)}
                      {' → att betala ut '}
                      <Text style={styles.avdragNetto}>{kr((item.totalt_belopp ?? 0) - item.avdrag_belopp)}</Text>
                    </Text>
                  )}
                  {item.foretagNamn && <Text style={styles.foretag}>Företag: {item.foretagNamn}</Text>}
                  <TouchableOpacity style={styles.betaldKnapp} onPress={() => markeraRapportBetald(item.id)}>
                    <Text style={styles.betaldText}>Markera som betald</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </>
      ) : aktivFlik === 'fakturering' ? (
        <SectionList
          sections={faktureringSektioner}
          keyExtractor={(item) => item.id.toString()}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          contentContainerStyle={styles.lista}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={faktureringsunderlag.length > 0 ? (
            <View style={styles.topbar}>
              <Text style={styles.topbarText}>{faktureringsunderlag.length} underlag · {faktureringSektioner.length} företag</Text>
              <Text style={styles.topbarStark}>{kr(totaltFaktura)} att fakturera</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            faktureringFel
              ? <Text style={styles.felText}>Fel: {faktureringFel}</Text>
              : <Text style={styles.tom}>Inga ej fakturerade underlag</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sektionHeader}>
              <View style={styles.sektionRad}>
                <Text style={styles.sektionNamn} numberOfLines={1}>{section.företag.foretagsnamn ?? '–'}</Text>
                <Text style={styles.sektionSubtotal}>{kr(section.subtotal)}</Text>
              </View>
              <Text style={styles.sekundär}>Org.nr: {section.företag.organisationsnummer ?? '–'}</Text>
              <Text style={styles.sekundär}>{section.företag.fakturaadress ?? '–'}{section.företag.postnummer ? `, ${section.företag.postnummer}` : ''}{section.företag.ort ? ` ${section.företag.ort}` : ''}</Text>
              <Text style={styles.sekundär}>Fakturamail: {section.företag.fakturamail ?? '–'}</Text>
              <Text style={styles.sekundär}>Ref: {section.företag.referensperson ?? '–'}</Text>
              <TouchableOpacity style={styles.sektionBulk} onPress={() => markeraFöretagFakturerat(section)}>
                <Text style={styles.sektionBulkText}>Markera företagets {section.data.length} underlag som fakturerade</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.underlagKort}>
              <View style={styles.fakturaHuvud}>
                <Text style={styles.jobbTitel} numberOfLines={1}>{item.jobbTitel ?? 'Pass'}</Text>
                <Text style={styles.fakturaDatum}>{visaDatum(item.datum)}</Text>
              </View>
              {item.ärSchemapass && <Text style={[styles.schemaBadge, { alignSelf: 'flex-start', marginBottom: 8 }]}>Schemapass</Text>}
              <View style={styles.kortDetaljer}>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timmar</Text>
                  <Text style={styles.detaljVärde}>{item.timmar}</Text>
                </View>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timlön</Text>
                  <Text style={styles.detaljVärde}>{kr(item.timlon)}</Text>
                </View>
                <View style={[styles.detalj, styles.detaljFramhavd]}>
                  <Text style={styles.detaljEtikett}>Fakturabelopp</Text>
                  <Text style={styles.detaljVärdeStor}>{kr(item.faktureringsbelopp)}</Text>
                </View>
              </View>
              <View style={styles.fakturaMeta}>
                {item.ob_belopp > 0 && <Text style={styles.metaText}>OB ingår: {kr(item.ob_belopp)}</Text>}
                <Text style={styles.metaText}>Påslag: {Math.round((item.paslag ?? 0) * 100)} %</Text>
              </View>
              {item.avdrag_belopp > 0 && (
                <Text style={styles.avdragInfo}>
                  Personen har {kr(item.avdrag_belopp)} i löneavdrag
                  {item.avdrag?.length ? ` (${item.avdrag.map(a => a.namn).join(', ')})` : ''}.
                  {' '}Fakturabeloppet påverkas inte av det.
                </Text>
              )}
              <TouchableOpacity style={styles.faktureradKnappLiten} onPress={() => markeraFakturerad(item.id)}>
                <Text style={styles.faktureradTextLiten}>Markera detta underlag som fakturerat</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : aktivFlik === 'företag' ? (
        <>
          <View style={styles.sökContainer}>
            <Ionicons name="search-outline" size={18} color="#aaa" style={styles.sökIkon} accessible={false} importantForAccessibility="no" />
            <TextInput
              style={styles.sökInput}
              placeholder="Sök på namn, org.nr eller mejl..."
              value={sökFöretag}
              onChangeText={setSökFöretag}
              autoCapitalize="none"
            />
          </View>
          <FlatList
          data={filtreradeFöretag}
          keyExtractor={(item) => item.id.toString()}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.tom}>Inga företag hittades</Text>}
          renderItem={({ item }) => (
            <View style={styles.kort}>
              <View style={styles.kortHuvudFöretag}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => navigation.navigate('FöretagsProfil', { foretagId: item.id })}>
                    <Text style={[styles.namn, styles.klickbart]}>{item.Namn ?? '–'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.email}>{item.Email ?? '–'}</Text>
                  {item.telefonnummer ? <Text style={styles.telefon}>{item.telefonnummer}</Text> : null}
                  <View style={[styles.planBricka, item.prenumeration_status === 'pro' ? styles.planPro : styles.planGratis]}>
                    <Text style={item.prenumeration_status === 'pro' ? styles.planTextPro : styles.planTextGratis}>
                      {item.prenumeration_status === 'pro' ? 'Pro' : 'Gratis'}
                    </Text>
                  </View>
                </View>
                <View style={styles.jobbBricka}>
                  <Text style={styles.jobbAntal}>{item.antalJobb}</Text>
                  <Text style={styles.jobbEtikett}>annonser</Text>
                </View>
              </View>
              {item.organisationsnummer ? <Text style={styles.sekundär}>Org.nr: {item.organisationsnummer}</Text> : null}
              {item.fakturaadress ? <Text style={styles.sekundär}>{item.fakturaadress}{item.postnummer ? `, ${item.postnummer}` : ''}{item.ort ? ` ${item.ort}` : ''}</Text> : null}
              {item.fakturamail ? <Text style={styles.sekundär}>Fakturamail: {item.fakturamail}</Text> : null}
              {item.referensperson ? <Text style={styles.sekundär}>Ref: {item.referensperson}</Text> : null}
              {item.created_at ? (
                <Text style={styles.skapad}>{visaDatum(item.created_at)} ({dagarSedanText(item.created_at)})</Text>
              ) : null}
            </View>
          )}
        />
        </>
      ) : aktivFlik === 'raderade' ? (
        <FlatList
          data={raderadeKonton}
          keyExtractor={(item) => item.id.toString()}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.tom}>Inga raderade konton</Text>}
          renderItem={({ item }) => (
            <View style={styles.kort}>
              <Text style={styles.namn}>Konto #{item.id}</Text>
              <Text style={styles.sekundär}>{item.Typ === 'företag' ? 'Företag' : 'Privatperson'}</Text>
              {item.raderad_at ? (
                <Text style={styles.skapad}>Raderat {visaDatum(item.raderad_at)} ({dagarSedanText(item.raderad_at)})</Text>
              ) : null}
              {item.avtal_godkant && (
                <>
                  <Text style={[styles.godkäntEtikett, { textAlign: 'left', marginTop: 10 }]}>Avtal godkänt</Text>
                  <TouchableOpacity style={styles.återkallaKnapp} onPress={() => återkallaAvtalRaderat(item.id)}>
                    <Text style={styles.återkallaText}>Ta tillbaka avtal</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        />
      ) : (
        <>
          <View style={styles.sökContainer}>
            <Ionicons name="search-outline" size={18} color="#aaa" style={styles.sökIkon} accessible={false} importantForAccessibility="no" />
            <TextInput
              style={styles.sökInput}
              placeholder="Sök på namn eller mejl..."
              value={sökPrivatperson}
              onChangeText={setSökPrivatperson}
              autoCapitalize="none"
            />
          </View>
          <FlatList
          data={filtradePrivatpersoner}
          keyExtractor={(item) => item.id.toString()}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.tom}>Inga privatpersoner hittades</Text>}
          renderItem={({ item }) => (
            <View style={styles.kort}>
              <View style={styles.kortHuvud}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => navigation.navigate('SökanadeProfil', { sokandeId: item.id, ansokningId: null })}>
                    <Text style={[styles.namn, styles.klickbart]}>{item.Namn ?? '–'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.email}>{item.Email ?? '–'}</Text>
                  {item.telefonnummer ? <Text style={styles.telefon}>{item.telefonnummer}</Text> : null}
                  {item.created_at ? (
                    <Text style={styles.skapad}>{visaDatum(item.created_at)} ({dagarSedanText(item.created_at)})</Text>
                  ) : null}
                </View>
                {item.avtal_godkant ? (
                  <Ionicons name="checkmark-circle" size={26} color="#16a34a" accessibilityLabel="Avtal godkänt" />
                ) : (
                  <Ionicons name="close-circle" size={26} color="#ef4444" accessibilityLabel="Avtal ej godkänt" />
                )}
              </View>
              {!item.avtal_godkant && (
                <TouchableOpacity style={styles.godkännKnapp} onPress={() => godkännAvtal(item.id)}>
                  <Text style={styles.godkännText}>Markera avtal som godkänt</Text>
                </TouchableOpacity>
              )}
              {item.avtal_godkant && (
                <>
                  <Text style={styles.godkäntEtikett}>Avtal godkänt</Text>
                  <TouchableOpacity style={styles.återkallaKnapp} onPress={() => { setAvtalModal(item); setAvtalOrsak(''); }}>
                    <Text style={styles.återkallaText}>Ta tillbaka avtal</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        />
        </>
      )}

      <Modal visible={avtalModal !== null} transparent animationType="fade" onRequestClose={() => setAvtalModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalKort}>
            <Text style={styles.modalTitel}>Ta tillbaka avtal</Text>
            <Text style={styles.modalText}>
              {avtalModal?.Namn ?? 'Personen'} kommer inte längre kunna söka jobb och får ett mejl med anledningen nedan.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Anledning (skickas till personen)"
              value={avtalOrsak}
              onChangeText={setAvtalOrsak}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalKnappar}>
              <TouchableOpacity style={styles.modalAvbryt} onPress={() => { setAvtalModal(null); setAvtalOrsak(''); }}>
                <Text style={styles.modalAvbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBekräfta, (!avtalOrsak.trim() || återkallar) && styles.modalBekräftaAv]}
                disabled={!avtalOrsak.trim() || återkallar}
                onPress={bekräftaÅterkalla}
              >
                <Text style={styles.modalBekräftaText}>{återkallar ? 'Återkallar…' : 'Ta tillbaka avtal'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flikarWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  flikar: { paddingHorizontal: 4 },
  flik: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 3 },
  flikAktiv: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  flikText: { fontSize: 12, fontWeight: '600', color: '#999' },
  flikTextAktiv: { color: '#2563eb' },
  flikBadge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9, backgroundColor: '#eef2f7', alignItems: 'center' },
  flikBadgeAktiv: { backgroundColor: '#2563eb' },
  flikBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  flikBadgeTextAktiv: { color: '#fff' },

  filter: { backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  snabbval: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  snabbKnapp: { backgroundColor: '#eef2f7', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  snabbText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  filterRad: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  datumInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  datumInputFlex: { flex: 1, minWidth: 0 },
  filterKnapp: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  filterKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  topbarText: { fontSize: 13, color: '#475569' },
  topbarStark: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },

  bulkbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 10 },
  bulkbarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bulkbarKnappar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bulkbarAvmark: { color: '#cbd5e1', fontSize: 13 },
  bulkbarKnapp: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  bulkbarKnappText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  lista: { padding: 16, paddingBottom: 32 },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 15 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kortVald: { borderWidth: 1.5, borderColor: '#2563eb' },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kryssruta: { marginRight: 10 },
  namn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  klickbart: { color: '#2563eb', textDecorationLine: 'underline' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  telefon: { fontSize: 13, color: '#888', marginTop: 1 },
  skapad: { fontSize: 12, color: '#aaa', marginTop: 3 },
  datum: { fontSize: 13, color: '#999' },
  titelRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  jobbTitel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  schemaBadge: { fontSize: 11, fontWeight: '700', color: '#7c3aed', backgroundColor: '#f3e8ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  fakturaMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
  planBricka: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  planPro: { backgroundColor: '#dcfce7' },
  planGratis: { backgroundColor: '#f1f5f9' },
  planTextPro: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  planTextGratis: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  kortDetaljer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detalj: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, alignItems: 'center' },
  detaljFramhavd: { backgroundColor: '#eff6ff' },
  detaljEtikett: { fontSize: 11, color: '#888', marginBottom: 4 },
  detaljVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  detaljVärdeStor: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  totalText: { color: '#2563eb' },
  foretag: { fontSize: 12, color: '#aaa' },
  avdragRad: { fontSize: 12, color: '#b91c1c', marginBottom: 4 },
  avdragNetto: { fontWeight: '700', color: '#16a34a' },
  avdragInfo: { fontSize: 12, color: '#b91c1c', marginTop: 6, lineHeight: 17 },
  summering: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#e0e7ff' },
  summeringRad: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summeringEtikett: { fontSize: 14, color: '#555' },
  summeringVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalRad: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 4 },
  totalEtikett: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  totalVärde: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  godkännKnapp: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  godkännText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  godkäntEtikett: { fontSize: 13, color: '#16a34a', fontWeight: '600', textAlign: 'center' },
  återkallaKnapp: { marginTop: 10, borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  återkallaText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalKort: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 88, backgroundColor: '#fafafa', marginBottom: 16 },
  modalKnappar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignItems: 'center' },
  modalAvbryt: { paddingVertical: 10, paddingHorizontal: 14 },
  modalAvbrytText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  modalBekräfta: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  modalBekräftaAv: { backgroundColor: '#fca5a5' },
  modalBekräftaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  betaldKnapp: { marginTop: 10, borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  betaldText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  kortHuvudFöretag: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  jobbBricka: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', marginLeft: 8 },
  jobbAntal: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  jobbEtikett: { fontSize: 11, color: '#93c5fd' },
  sekundär: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Fakturering – sektionshuvud per företag + lättare underlagskort
  sektionHeader: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 6, borderWidth: 1, borderColor: '#e0e7ff' },
  sektionRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sektionNamn: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginRight: 8 },
  sektionSubtotal: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  sektionBulk: { marginTop: 10, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  sektionBulkText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  underlagKort: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, marginLeft: 10, borderLeftWidth: 3, borderLeftColor: '#dbeafe' },
  fakturaHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fakturaDatum: { fontSize: 13, color: '#999' },
  felText: { textAlign: 'center', color: '#ef4444', marginTop: 60, fontSize: 14, paddingHorizontal: 16 },
  faktureradKnappLiten: { marginTop: 8, borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  faktureradTextLiten: { color: '#16a34a', fontWeight: '600', fontSize: 12 },
  sökContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 },
  sökIkon: { marginRight: 8 },
  sökInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#1a1a1a' },

  // Dashboard
  dashLista: { padding: 16, paddingBottom: 32 },
  periodRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  periodPill: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  periodPillAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  periodTextAktiv: { color: '#fff' },
  dashRubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 20, marginBottom: 2 },
  dashUnder: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  statRad: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statKort: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderTopWidth: 3, borderTopColor: '#e5e7eb', padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statKortPrimär: { borderTopColor: '#2563eb' },
  statKortTom: { flex: 1 },
  statEtikett: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  statVärde: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginTop: 8 },
  statUnder: { fontSize: 12, color: '#94a3b8', marginTop: 6 },

  // Bestridanden
  bestridInfo: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
  bestriddBadge: { fontSize: 11, fontWeight: '700', color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  bestridRuta: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginTop: 10 },
  bestridEtikett: { fontSize: 11, fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.3 },
  bestridTextInner: { fontSize: 14, color: '#1a1a1a', marginTop: 4 },
  bestridTid: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  fuskRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  fuskText: { fontSize: 14, color: '#1a1a1a' },
  bestridAktioner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  timmarInput: { width: 90, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, backgroundColor: '#fafafa' },
  korrKnapp: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  korrText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  godkUrsprKnapp: { marginTop: 10, backgroundColor: '#eef2ff', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  godkUrsprText: { color: '#4338ca', fontWeight: '700', fontSize: 14 },
  knappAv: { opacity: 0.6 },

  // Privatpersoner (statistik)
  namnRad: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  avtalBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  avtalBadgeOk: { backgroundColor: '#dcfce7' },
  avtalBadgeNej: { backgroundColor: '#fee2e2' },
  avtalBadgeOkText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  avtalBadgeNejText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  statRutor: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statRuta: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  statRutaVärde: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  statRutaEtikett: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  statRutaVarning: { backgroundColor: '#fee2e2' },
  statRutaVarningVärde: { fontSize: 17, fontWeight: '800', color: '#dc2626' },
  statRutaVarningEtikett: { fontSize: 11, fontWeight: '700', color: '#dc2626', textTransform: 'uppercase' },
});
