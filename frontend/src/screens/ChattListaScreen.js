import { useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { api } from '../api/klient';
import { STATUSFÄRGER_ANSÖKAN as STATUSFÄRGER } from '../utils/konstanter';
import { parsaArbetstider, formatDagDatum } from '../utils/datumHelper';

function byggSektioner(poster, ärFöretag) {
  const medFörfrågan = poster.filter(p => p.harFörfrågan);
  const övriga = poster.filter(p => !p.harFörfrågan);
  const attGodkänna = övriga.filter(p => p.rapportStatus === 'väntar');
  const avslutade = övriga.filter(p => p.rapportStatus === 'godkänd' || p.status === 'avvisad');
  const aktiva = övriga.filter(p =>
    p.rapportStatus !== 'väntar' && p.rapportStatus !== 'godkänd' && p.status !== 'avvisad'
  );

  const sektioner = [];
  const brådskandeTitel = ärFöretag ? 'Väntar på godkännande' : 'Att godkänna';

  if (medFörfrågan.length) sektioner.push({ titel: 'Jobbförfrågan', data: medFörfrågan, brådskande: true });
  if (attGodkänna.length) sektioner.push({ titel: brådskandeTitel, data: attGodkänna, brådskande: true });
  if (aktiva.length) sektioner.push({ titel: 'Aktiva pass', data: aktiva, brådskande: false });
  if (avslutade.length) sektioner.push({ titel: 'Avslutade', data: avslutade, brådskande: false });

  return sektioner;
}

export default function ChattListaScreen({ navigation }) {
  const { användare } = useAuth();
  const { uppdateraOlästa, olästaIds } = useNotifikationer();
  const ärFöretag = användare?.typ === 'företag';

  const [poster, setPoster] = useState([]);
  const [väntandeFörfrågan, setVäntandeFörfrågan] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [söktext, setSöktext] = useState('');

  async function hämta() {
    try {
      const [data, väntande] = await Promise.all([
        ärFöretag ? api.företagsKonversationer() : api.minaAnsökningar(),
        api.väntandeJobbforfragningar().catch(() => []),
      ]);
      setPoster(data);
      setVäntandeFörfrågan(väntande);
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

  // Markera konversationer där det finns en väntande jobbförfrågan med motparten
  const minId = String(användare?.id);
  const förfråganParter = new Set(
    väntandeFörfrågan.map((f) => {
      const annan = String(f.fran_anvandare_id) === minId ? f.till_anvandare_id : f.fran_anvandare_id;
      return String(annan);
    })
  );
  const markerade = poster.map((p) => ({
    ...p,
    harFörfrågan: förfråganParter.has(String(ärFöretag ? p.sokande_id : p.foretagId)),
  }));

  const q = söktext.trim().toLowerCase();
  const filtrerade = q
    ? markerade.filter((p) => {
        const namn = (ärFöretag ? p.sökandeNamn : p.foretagNamn) ?? '';
        const titel = p.jobbTitel ?? '';
        return namn.toLowerCase().includes(q) || titel.toLowerCase().includes(q);
      })
    : markerade;

  const sektioner = byggSektioner(filtrerade, ärFöretag);

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
        const rubrik = ärFöretag ? (item.sökandeNamn ?? 'Okänd') : (item.foretagNamn ?? 'Okänt företag');
        const underRubrik = item.jobbTitel ?? '';
        const initial = rubrik[0]?.toUpperCase() ?? '?';
        const status = item.status ?? 'väntande';
        const statusFärg = STATUSFÄRGER[status] ?? STATUSFÄRGER.väntande;

        // Datumlogik — samma som jobbkorten och chattfönstret
        const dagSchema = parsaArbetstider(item.arbetstider);
        const allaDatum = dagSchema ? dagSchema.map(d => d.datum).filter(Boolean) : [];
        const visaDatum = allaDatum.slice(0, 3);
        const flerDatum = allaDatum.length > 3 ? allaDatum.length - 3 : 0;

        // Oläst-indikator
        const harOlästa = olästaIds.has(item.id);

        return (
          <TouchableOpacity
            style={[styles.kort, section.brådskande && styles.kortBrådskande, harOlästa && styles.kortOläst]}
            onPress={() => navigation.navigate('Chatt', { ansokningId: item.id })}
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
                <Text style={styles.underTitel} numberOfLines={1}>{underRubrik}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.datum, harOlästa && styles.datumOläst]}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusFärg.bg, marginTop: 4 }]}>
                  <Text style={[styles.statusText, { color: statusFärg.text }]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {allaDatum.length > 0 && (
              <View style={styles.datumRad}>
                <Ionicons name="calendar" size={14} color="#2563eb" />
                {visaDatum.map((d, i) => (
                  <View key={i} style={styles.datumChip}>
                    <Text style={styles.datumChipText}>{formatDagDatum(d)}</Text>
                  </View>
                ))}
                {flerDatum > 0 && (
                  <Text style={styles.flerDatumText}>+{flerDatum} till</Text>
                )}
              </View>
            )}

            {item.meddelande
              ? <Text style={styles.förhandsgranskning} numberOfLines={2}>{item.meddelande}</Text>
              : <Text style={styles.inget}>Ingen ansökningstext</Text>
            }
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

  sektionHuvud: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sektionHuvudBrådskande: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: -2,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  brådskandePunkt: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginRight: 6,
  },
  sektionRubrik: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sektionRubrikBrådskande: { color: '#92400e' },
  sektionAntal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sektionAntalBrådskande: { backgroundColor: '#fde68a', color: '#92400e' },

  kort: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kortBrådskande: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kortOläst: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarBrådskande: { backgroundColor: '#fef3c7' },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 18 },
  avatarTextBrådskande: { color: '#d97706' },
  oläsPrick: {
    position: 'absolute',
    top: 0,
    right: 10,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  titel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  titelOläst: { fontWeight: '700' },
  underTitel: { fontSize: 13, color: '#888', marginTop: 2 },
  datum: { fontSize: 12, color: '#aaa' },
  datumOläst: { color: '#ef4444', fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  datumRad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginTop: 6 },
  datumChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  datumChipText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  flerDatumText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  förhandsgranskning: { fontSize: 14, color: '#555', lineHeight: 20 },
  inget: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
});
