import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';

const statusFärger = {
  väntar: { bg: '#fef9c3', text: '#854d0e', etikett: 'Väntar' },
  godkänd: { bg: '#dcfce7', text: '#16a34a', etikett: 'Godkänd' },
  bestridd: { bg: '#fee2e2', text: '#dc2626', etikett: 'Bestridd' },
};

export default function MinaJobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [tidigarePass, setTidigarePass] = useState([]);
  const [aktivFlik, setAktivFlik] = useState('aktiva');
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  async function taBort(id) {
    Alert.alert('Ta bort annons', 'Är du säker? Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: async () => {
        try {
          await api.taBortJobb(id);
          setJobb(prev => prev.filter(j => j.id !== id));
        } catch (fel) {
          Alert.alert('Fel', fel.message);
        }
      }},
    ]);
  }

  function öppnaÅtgärder(item) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Avbryt', 'Redigera', 'Ta bort'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) navigation.navigate('RedigeraJobb', { jobb: item });
          if (index === 2) taBort(item.id);
        }
      );
    } else {
      Alert.alert(item.Titel, null, [
        { text: 'Redigera', onPress: () => navigation.navigate('RedigeraJobb', { jobb: item }) },
        { text: 'Ta bort', style: 'destructive', onPress: () => taBort(item.id) },
        { text: 'Avbryt', style: 'cancel' },
      ]);
    }
  }

  async function hämta() {
    try {
      const jobbData = await api.minaJobb();
      setJobb(jobbData);
    } catch (fel) {
      console.error('Jobb fel:', fel);
    }
    try {
      const rapporterData = await api.tidrapporterFörFöretag();
      setTidigarePass(rapporterData);
    } catch (fel) {
      console.error('Tidrapporter fel:', fel);
    }
    setLaddar(false);
    setUppdaterar(false);
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.flikar}>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'aktiva' && styles.flikAktiv]}
          onPress={() => setAktivFlik('aktiva')}
        >
          <Text style={[styles.flikText, aktivFlik === 'aktiva' && styles.flikTextAktiv]}>
            Aktiva ({jobb.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'tidigare' && styles.flikAktiv]}
          onPress={() => setAktivFlik('tidigare')}
        >
          <Text style={[styles.flikText, aktivFlik === 'tidigare' && styles.flikTextAktiv]}>
            Tidigare pass ({tidigarePass.length})
          </Text>
        </TouchableOpacity>
      </View>

      {aktivFlik === 'aktiva' ? (
        <FlatList
          style={styles.lista}
          data={jobb}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
          ListEmptyComponent={
            <View style={styles.tomContainer}>
              <Text style={styles.tomText}>Du har inte publicerat några jobb ännu</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.kort}
              onPress={() => navigation.navigate('JobbAnsokningar', { jobbId: item.id, titel: item.Titel })}
            >
              <View style={styles.kortHuvud}>
                <Text style={styles.titel} numberOfLines={1}>{item.Titel}</Text>
                <Text style={styles.datum}>{new Date(item.created_at).toLocaleDateString('sv-SE')}</Text>
              </View>
              <Text style={styles.info}>{item.Plats ? `${item.Plats} · ` : ''}{item.Typ}</Text>
              {(item.antal_dagar != null || item.arbetstider) && (
                <View style={styles.extraRad}>
                  {item.antal_dagar != null && <Text style={styles.extra}>{item.antal_dagar} dagar</Text>}
                  {item.arbetstider ? <Text style={styles.extra}>{item.arbetstider}</Text> : null}
                </View>
              )}
              <View style={styles.kortBotten}>
                <Text style={styles.seAnsokningar}>Se ansökningar →</Text>
                <TouchableOpacity style={styles.menyKnapp} onPress={() => öppnaÅtgärder(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.menyIkon}>•••</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          style={styles.lista}
          data={tidigarePass}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
          ListEmptyComponent={
            <View style={styles.tomContainer}>
              <Text style={styles.tomText}>Inga avslutade pass ännu</Text>
            </View>
          }
          renderItem={({ item }) => {
            const färg = statusFärger[item.status] ?? statusFärger.väntar;
            return (
              <View style={styles.passKort}>
                <View style={styles.passKortHuvud}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passTitel}>{item.jobbTitel ?? '–'}</Text>
                    <Text style={styles.passNamn}>{item.privatpersonNamn ?? '–'}</Text>
                  </View>
                  <View style={[styles.statusBricka, { backgroundColor: färg.bg }]}>
                    <Text style={[styles.statusText, { color: färg.text }]}>{färg.etikett}</Text>
                  </View>
                </View>
                <View style={styles.passDetaljer}>
                  <View style={styles.passDetalj}>
                    <Text style={styles.passEtikett}>Datum</Text>
                    <Text style={styles.passVärde}>{new Date(item.datum).toLocaleDateString('sv-SE')}</Text>
                  </View>
                  <View style={styles.passDetalj}>
                    <Text style={styles.passEtikett}>Timmar</Text>
                    <Text style={styles.passVärde}>{item.timmar} tim</Text>
                  </View>
                  <View style={styles.passDetalj}>
                    <Text style={styles.passEtikett}>Totalt</Text>
                    <Text style={[styles.passVärde, { color: '#2563eb' }]}>{item.totalt_belopp?.toLocaleString('sv-SE')} kr</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Chatt', { ansokningId: item.ansokan_id })}>
                  <Text style={styles.chattLänk}>Öppna chatt →</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flikar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  flik: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  flikAktiv: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  flikText: { fontSize: 14, fontWeight: '600', color: '#999' },
  flikTextAktiv: { color: '#2563eb' },
  lista: { flex: 1, padding: 16 },
  // Aktiva jobb
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  titel: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  datum: { fontSize: 13, color: '#999', marginLeft: 8 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  extraRad: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  extra: { fontSize: 13, color: '#888' },
  kortBotten: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  seAnsokningar: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  menyKnapp: { padding: 4 },
  menyIkon: { fontSize: 16, color: '#9ca3af', letterSpacing: 1 },
  tomContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  tomText: { fontSize: 16, color: '#999' },
  // Tidigare pass
  passKort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passKortHuvud: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  passTitel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  passNamn: { fontSize: 14, color: '#666' },
  statusBricka: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  passDetaljer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  passDetalj: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, alignItems: 'center' },
  passEtikett: { fontSize: 11, color: '#888', marginBottom: 4 },
  passVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  chattLänk: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
});
