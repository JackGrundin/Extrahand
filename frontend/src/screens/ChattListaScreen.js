import { useCallback, useState } from 'react';
import { View, Text, SectionList, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { api, felText } from '../api/klient';
import { useLoggaRefresh } from '../components/LoggaRefresh';
import SkeletonLista from '../components/SkeletonKort';
import TomtTillstånd from '../components/TomtTillstånd';
import JobbforfraganKort from '../components/JobbforfraganKort';
import { haptik } from '../utils/haptik';

// Sorterar så att olästa chattar hamnar högst upp, därefter de med senaste meddelande
function sorteraOlästaFörst(poster, olästaIds) {
  const tidsstämpel = (p) => {
    const t = p.senasteMeddelande?.created_at;
    return t ? new Date(t).getTime() : 0;
  };
  return [...poster].sort((a, b) => {
    const aOläst = olästaIds.has(a.id);
    const bOläst = olästaIds.has(b.id);
    if (aOläst !== bOläst) return aOläst ? -1 : 1;
    return tidsstämpel(b) - tidsstämpel(a);
  });
}

function byggSektioner(poster, ärFöretag, olästaIds) {
  const förfrågan = poster.filter(p => p.harVäntandeFörfragan);
  const övriga = poster.filter(p => !p.harVäntandeFörfragan);
  const attGodkänna = övriga.filter(p => p.harVäntandeTidrapport);
  const rest = övriga.filter(p => !p.harVäntandeTidrapport);
  const avslutade = rest.filter(p => p.harAvslutat && !p.harAktivtPass);
  const aktiva = rest.filter(p => !(p.harAvslutat && !p.harAktivtPass));

  const sektioner = [];
  const brådskandeTitel = ärFöretag ? 'Väntar på godkännande' : 'Att godkänna';

  if (förfrågan.length) sektioner.push({ titel: 'Jobbförfrågan', data: sorteraOlästaFörst(förfrågan, olästaIds), brådskande: true });
  if (attGodkänna.length) sektioner.push({ titel: brådskandeTitel, data: sorteraOlästaFörst(attGodkänna, olästaIds), brådskande: true });
  if (aktiva.length) sektioner.push({ titel: 'Aktiva', data: sorteraOlästaFörst(aktiva, olästaIds), brådskande: false });
  if (avslutade.length) sektioner.push({ titel: 'Avslutade', data: sorteraOlästaFörst(avslutade, olästaIds), brådskande: false });

  return sektioner;
}

function statusEtikett(p, ärFöretag) {
  if (p.harVäntandeFörfragan) return 'Ny jobbförfrågan';
  if (p.harVäntandeTidrapport) return ärFöretag ? 'Väntar på godkännande' : 'Tidrapport att godkänna';
  if (p.harAktivtPass) return 'Aktivt pass';
  if (p.harAvslutat) return 'Avslutat';
  return 'Aktiv konversation';
}

// Kort för en inkommen inbjudan (länk/mejl) i Förfrågningar-fliken. Acceptera skapar +
// godkänner ansökan direkt via inbjudans id (klartext-token finns inte i appen).
function InbjudanKort({ inbjudan, onAccepterad }) {
  const [sparar, setSparar] = useState(false);
  const datum = inbjudan.datum
    ? new Date(inbjudan.datum + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  async function acceptera() {
    setSparar(true);
    try {
      const svar = await api.accepteraInbjudanViaId(inbjudan.id);
      haptik.lyckat();
      onAccepterad(svar);
    } catch (fel) {
      haptik.fel();
      Alert.alert('Fel', felText(fel));
    } finally {
      setSparar(false);
    }
  }

  return (
    <View style={styles.förfråganKort}>
      <View style={styles.förfråganHuvud}>
        <Ionicons name="mail-outline" size={18} color="#2563eb" accessible={false} importantForAccessibility="no" />
        <Text style={styles.förfråganRubrik}>Inbjudan</Text>
        <View style={styles.förfråganBricka}>
          <Text style={styles.förfråganBrickaText}>{inbjudan.typ === 'schema' ? 'Schema' : 'Pass'}</Text>
        </View>
      </View>
      {inbjudan.titel ? <View style={styles.förfråganRad}><Text style={styles.förfråganEtikett}>{inbjudan.typ === 'schema' ? 'Schema' : 'Pass'}</Text><Text style={styles.förfråganVärde}>{inbjudan.titel}</Text></View> : null}
      {inbjudan.företagNamn ? <View style={styles.förfråganRad}><Text style={styles.förfråganEtikett}>Företag</Text><Text style={styles.förfråganVärde}>{inbjudan.företagNamn}</Text></View> : null}
      {datum ? <View style={styles.förfråganRad}><Text style={styles.förfråganEtikett}>{inbjudan.typ === 'schema' ? 'Start' : 'Datum'}</Text><Text style={styles.förfråganVärde}>{datum}</Text></View> : null}
      {inbjudan.timlon != null ? <View style={styles.förfråganRad}><Text style={styles.förfråganEtikett}>Timlön</Text><Text style={styles.förfråganVärde}>{Number(inbjudan.timlon).toLocaleString('sv-SE')} kr/tim</Text></View> : null}
      <TouchableOpacity style={[styles.acceptKnapp, sparar && { opacity: 0.5 }]} onPress={acceptera} disabled={sparar}>
        <Text style={styles.acceptKnappText}>Acceptera förfrågan</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ChattListaScreen({ navigation }) {
  const { användare } = useAuth();
  const { uppdateraOlästa, olästaIds } = useNotifikationer();
  const ärFöretag = användare?.typ === 'företag';

  const [poster, setPoster] = useState([]);
  const [inbjudningar, setInbjudningar] = useState([]);
  const [jobbförfrågningar, setJobbförfrågningar] = useState([]);
  const [flik, setFlik] = useState('konversationer');
  const [laddar, setLaddar] = useState(true);
  const [söktext, setSöktext] = useState('');

  async function hämta() {
    try {
      // Förfrågningar (inbjudningar + jobbförfrågningar) är bara relevanta för privatpersoner.
      const [data, inbj, jobbf] = await Promise.all([
        api.hämtaKonversationer(),
        ärFöretag ? Promise.resolve([]) : api.hämtaMinaInbjudningar().catch(() => []),
        ärFöretag ? Promise.resolve([]) : api.väntandeJobbforfragningar().catch(() => []),
      ]);
      setPoster(data);
      setInbjudningar(Array.isArray(inbj) ? inbj : []);
      setJobbförfrågningar(Array.isArray(jobbf) ? jobbf : []);
      uppdateraOlästa(data, användare?.id);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  // Efter accept av en inbjudan: avtal godkänt → till chatten; annars väntmeddelande.
  function efterAcceptInbjudan(svar) {
    hämta();
    if (svar?.avtalGodkant && svar.ansokanId) {
      navigation.navigate('Chatt', { ansokningId: svar.ansokanId });
    } else {
      Alert.alert('Jobbet är ditt!', 'Vi väntar bara på att ditt avtal godkänns av FastGig. Så fort det är klart kan du börja chatta med företaget.');
    }
  }

  const refresh = useLoggaRefresh(hämta);

  useFocusEffect(useCallback(() => { hämta(); }, []));

  const q = söktext.trim().toLowerCase();
  const filtrerade = q
    ? poster.filter((p) => {
        const namn = (p.motpartNamn ?? '').toLowerCase();
        const titlar = (p.jobbTitlar ?? []).join(' ').toLowerCase();
        return namn.includes(q) || titlar.includes(q);
      })
    : poster;

  const sektioner = byggSektioner(filtrerade, ärFöretag, olästaIds);

  // Förfrågningar-fliken: inbjudningar + jobbförfrågningar, nyast först.
  const förfrågningar = [
    ...inbjudningar.map((i) => ({ typ: 'inbjudan', data: i, key: `i-${i.id}`, sort: i.skapad_datum || i.datum || '' })),
    ...jobbförfrågningar.map((j) => ({ typ: 'jobbforfragan', data: j, key: `j-${j.id}`, sort: j.skapad_datum || j.datum || '' })),
  ].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
  const antalFörfrågningar = förfrågningar.length;
  const visaFörfrågningar = !ärFöretag && flik === 'forfragningar';

  return (
    <View style={styles.container}>
      {refresh.LoggaOverlay}

      {!ärFöretag && (
        <View style={styles.flikRad}>
          <TouchableOpacity style={[styles.flik, flik === 'konversationer' && styles.flikAktiv]} onPress={() => setFlik('konversationer')}>
            <Text style={[styles.flikText, flik === 'konversationer' && styles.flikTextAktiv]}>Konversationer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.flik, flik === 'forfragningar' && styles.flikAktiv]} onPress={() => setFlik('forfragningar')}>
            <Text style={[styles.flikText, flik === 'forfragningar' && styles.flikTextAktiv]}>
              Förfrågningar{antalFörfrågningar > 0 ? ` (${antalFörfrågningar})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {visaFörfrågningar ? (
        laddar ? (
          <SkeletonLista style={styles.listaInnehåll} />
        ) : (
          <FlatList
            style={styles.lista}
            data={förfrågningar}
            keyExtractor={(item) => item.key}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={8}
            contentContainerStyle={styles.listaInnehåll}
            refreshControl={refresh.refreshControl}
            onScroll={refresh.onScroll}
            scrollEventThrottle={refresh.scrollEventThrottle}
            onLayout={refresh.onListLayout}
            ListEmptyComponent={
              <TomtTillstånd
                ikon="mail-outline"
                rubrik="Inga förfrågningar"
                text="Inbjudningar och passerbjudanden från företag dyker upp här."
              />
            }
            renderItem={({ item }) =>
              item.typ === 'inbjudan' ? (
                <InbjudanKort inbjudan={item.data} onAccepterad={efterAcceptInbjudan} />
              ) : (
                <JobbforfraganKort förfrågan={item.data} ärPrivatperson onUppdaterad={hämta} />
              )
            }
          />
        )
      ) : (
      <>
      <View style={styles.sökRad}>
        <Ionicons name="search" size={18} color="#9ca3af" accessible={false} importantForAccessibility="no" />
        <TextInput
          style={styles.sökInput}
          placeholder={ärFöretag ? 'Sök medarbetare eller jobbtitel' : 'Sök företag eller jobbtitel'}
          value={söktext}
          onChangeText={setSöktext}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {söktext.length > 0 && (
          <TouchableOpacity onPress={() => setSöktext('')} accessibilityRole="button" accessibilityLabel="Rensa sökning">
            <Ionicons name="close-circle" size={18} color="#9ca3af" accessible={false} importantForAccessibility="no" />
          </TouchableOpacity>
        )}
      </View>

      {laddar ? (
        <SkeletonLista style={styles.listaInnehåll} />
      ) : (
      <SectionList
        style={styles.lista}
        sections={sektioner}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        contentContainerStyle={styles.listaInnehåll}
        refreshControl={refresh.refreshControl}
        onScroll={refresh.onScroll}
        scrollEventThrottle={refresh.scrollEventThrottle}
        onLayout={refresh.onListLayout}
        ListEmptyComponent={
          q ? (
            <TomtTillstånd
              ikon="search-outline"
              rubrik={`Inga träffar för "${söktext.trim()}"`}
              text="Prova ett annat namn eller en annan jobbtitel."
            />
          ) : (
            <TomtTillstånd
              ikon="chatbubbles-outline"
              rubrik="Inga aktiva chattar ännu"
              text="När du matchas med ett jobb dyker konversationen upp här."
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sektionHuvud, section.brådskande && styles.sektionHuvudBrådskande]}>
            {section.brådskande && <View style={styles.brådskandePunkt} />}
            <Text style={[styles.sektionRubrik, section.brådskande && styles.sektionRubrikBrådskande]}>
              {section.titel}
            </Text>
            <Text style={[styles.sektionAntal, section.brådskande && styles.sektionAntalBrådskande]}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          const rubrik = item.motpartNamn ?? (ärFöretag ? 'Okänd' : 'Okänt företag');
          const initial = rubrik[0]?.toUpperCase() ?? '?';
          const harOlästa = olästaIds.has(item.id);
          const förhandsvisning = item.senasteMeddelande?.innehall ?? statusEtikett(item, ärFöretag);

          return (
            <TouchableOpacity
              style={[styles.kort, section.brådskande && styles.kortBrådskande, harOlästa && styles.kortOläst]}
              onPress={() => navigation.navigate('Chatt', {
                medAnvandareId: item.motpartId,
                ansokningId: item.aktivAnsokanId,
                motpartNamn: item.motpartNamn,
              })}
              activeOpacity={0.85}
            >
              <View style={styles.kortHuvud}>
                <View style={{ position: 'relative' }}>
                  <View style={[styles.avatar, section.brådskande && styles.avatarBrådskande]}>
                    <Text style={[styles.avatarText, section.brådskande && styles.avatarTextBrådskande]}>
                      {initial}
                    </Text>
                  </View>
                  {harOlästa && <View style={styles.oläsPrick} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.titel, harOlästa && styles.titelOläst]} numberOfLines={1}>{rubrik}</Text>
                  <Text style={[styles.förhandsgranskning, harOlästa && styles.förhandsOläst]} numberOfLines={1}>
                    {förhandsvisning}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      )}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  sökRad: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sökInput: { flex: 1, fontSize: 15, color: '#1a1a1a', padding: 0, letterSpacing: 0 },
  lista: { flex: 1, backgroundColor: '#f8fafc' },
  listaInnehåll: { padding: 16, paddingBottom: 32 },

  sektionHuvud: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, paddingHorizontal: 2 },
  sektionHuvudBrådskande: { backgroundColor: '#fffbeb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginHorizontal: -2, borderWidth: 1, borderColor: '#fde68a' },
  brådskandePunkt: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 6 },
  sektionRubrik: { flex: 1, fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' },
  sektionRubrikBrådskande: { color: '#92400e' },
  sektionAntal: { fontSize: 12, fontWeight: '600', color: '#9ca3af', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  sektionAntalBrådskande: { backgroundColor: '#fde68a', color: '#92400e' },

  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortBrådskande: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  kortOläst: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  kortHuvud: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarBrådskande: { backgroundColor: '#fef3c7' },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 18 },
  avatarTextBrådskande: { color: '#d97706' },
  oläsPrick: { position: 'absolute', top: 0, right: 10, width: 11, height: 11, borderRadius: 6, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
  titel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  titelOläst: { fontWeight: '700' },
  förhandsgranskning: { fontSize: 14, color: '#888', marginTop: 2 },
  förhandsOläst: { color: '#374151', fontWeight: '500' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },

  flikRad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  flik: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  flikAktiv: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  flikText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  flikTextAktiv: { color: '#2563eb' },

  förfråganKort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  förfråganHuvud: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  förfråganRubrik: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  förfråganBricka: { backgroundColor: '#eff6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  förfråganBrickaText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  förfråganRad: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  förfråganEtikett: { fontSize: 14, color: '#6b7280' },
  förfråganVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  acceptKnapp: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  acceptKnappText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
