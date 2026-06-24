import { useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { api } from '../api/klient';

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

export default function ChattListaScreen({ navigation }) {
  const { användare } = useAuth();
  const { uppdateraOlästa, olästaIds } = useNotifikationer();
  const ärFöretag = användare?.typ === 'företag';

  const [poster, setPoster] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [söktext, setSöktext] = useState('');

  async function hämta() {
    try {
      const data = await api.hämtaKonversationer();
      setPoster(data);
      uppdateraOlästa(data, användare?.id);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  const q = söktext.trim().toLowerCase();
  const filtrerade = q
    ? poster.filter((p) => {
        const namn = (p.motpartNamn ?? '').toLowerCase();
        const titlar = (p.jobbTitlar ?? []).join(' ').toLowerCase();
        return namn.includes(q) || titlar.includes(q);
      })
    : poster;

  const sektioner = byggSektioner(filtrerade, ärFöretag, olästaIds);

  return (
    <View style={styles.container}>
      <View style={styles.sökRad}>
        <Ionicons name="search" size={18} color="#9ca3af" />
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
          <TouchableOpacity onPress={() => setSöktext('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        style={styles.lista}
        sections={sektioner}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listaInnehåll}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga aktiva chattar</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  sökRad: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sökInput: { flex: 1, fontSize: 15, color: '#1a1a1a', padding: 0, letterSpacing: 0 },
  lista: { flex: 1, backgroundColor: '#f5f5f5' },
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
});
