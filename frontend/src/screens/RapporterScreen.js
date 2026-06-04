import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';

export default function RapporterScreen({ navigation }) {
  const [aktivFlik, setAktivFlik] = useState('rapporter');
  const [rapporter, setRapporter] = useState([]);
  const [privatpersoner, setPrivatpersoner] = useState([]);
  const [företag, setFöretag] = useState([]);
  const [faktureringsunderlag, setFaktureringsunderlag] = useState([]);
  const [faktureringFel, setFaktureringFel] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sökPrivatperson, setSökPrivatperson] = useState('');
  const [sökFöretag, setSökFöretag] = useState('');

  async function hämta() {
    setLaddar(true);
    try {
      const data = await api.allaRapporter('', '');
      setRapporter(data);
    } catch (fel) { console.error('Rapporter:', fel); }
    try {
      const data = await api.hämtaAllaPrivatpersoner();
      setPrivatpersoner(data);
    } catch (fel) { console.error('Privatpersoner:', fel); }
    try {
      const data = await api.hämtaAllaFöretag();
      setFöretag(data);
    } catch (fel) { console.error('Företag:', fel); }
    try {
      const data = await api.hämtaFaktureringsunderlag();
      setFaktureringsunderlag(data);
      setFaktureringFel(null);
    } catch (fel) { setFaktureringFel(fel.message); }
    setLaddar(false);
  }

  async function taBortRapport(id) {
    Alert.alert(
      'Bekräfta',
      'Är du säker på att du vill markera denna rapport som betald och ta bort den?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', style: 'destructive', onPress: async () => {
          try {
            await api.taBortTidrapport(id);
            setRapporter(prev => prev.filter(r => r.id !== id));
          } catch (fel) {
            Alert.alert('Fel', fel.message);
          }
        }},
      ]
    );
  }

  async function filtreraRapporter() {
    setLaddar(true);
    try {
      const data = await api.allaRapporter(fromDate || null, toDate || null);
      setRapporter(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
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
            Alert.alert('Fel', fel.message);
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
      Alert.alert('Fel', fel.message);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  const totaltBelopp = rapporter.reduce((sum, r) => sum + (r.totalt_belopp ?? 0), 0);
  const totaltTimmar = rapporter.reduce((sum, r) => sum + (r.timmar ?? 0), 0);

  const filtreradeFöretag = sökFöretag.trim()
    ? företag.filter(f => f.Email?.toLowerCase().includes(sökFöretag.toLowerCase()))
    : företag;

  const filtradePrivatpersoner = sökPrivatperson.trim()
    ? privatpersoner.filter(p => p.Email?.toLowerCase().includes(sökPrivatperson.toLowerCase()))
    : privatpersoner;

  return (
    <View style={styles.container}>
      <View style={styles.flikar}>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'rapporter' && styles.flikAktiv]}
          onPress={() => setAktivFlik('rapporter')}
        >
          <Text style={[styles.flikText, aktivFlik === 'rapporter' && styles.flikTextAktiv]}>Tidrapporter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'avtal' && styles.flikAktiv]}
          onPress={() => setAktivFlik('avtal')}
        >
          <Text style={[styles.flikText, aktivFlik === 'avtal' && styles.flikTextAktiv]}>
            Avtal ({privatpersoner.filter(p => !p.avtal_godkant).length} väntande)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'företag' && styles.flikAktiv]}
          onPress={() => setAktivFlik('företag')}
        >
          <Text style={[styles.flikText, aktivFlik === 'företag' && styles.flikTextAktiv]}>
            Företag ({företag.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flik, aktivFlik === 'fakturering' && styles.flikAktiv]}
          onPress={() => setAktivFlik('fakturering')}
        >
          <Text style={[styles.flikText, aktivFlik === 'fakturering' && styles.flikTextAktiv]}>
            Fakturering ({faktureringsunderlag.length})
          </Text>
        </TouchableOpacity>
      </View>

      {laddar ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      ) : aktivFlik === 'rapporter' ? (
        <>
          <View style={styles.filter}>
            <TextInput
              style={styles.datumInput}
              placeholder="Från (ÅÅÅÅ-MM-DD)"
              value={fromDate}
              onChangeText={setFromDate}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.datumInput}
              placeholder="Till (ÅÅÅÅ-MM-DD)"
              value={toDate}
              onChangeText={setToDate}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.filterKnapp} onPress={filtreraRapporter}>
              <Text style={styles.filterKnappText}>Filtrera</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={rapporter}
            keyExtractor={(item) => item.id}
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
                  <Text style={styles.totalVärde}>{totaltBelopp.toLocaleString('sv-SE')} kr</Text>
                </View>
              </View>
            ) : null}
            renderItem={({ item }) => (
              <View style={styles.kort}>
                <View style={styles.kortHuvud}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.namn}>{item.anvandareNamn ?? '–'}</Text>
                    <Text style={styles.email}>{item.anvandareEmail ?? '–'}</Text>
                    {item.anvardareTelefon ? <Text style={styles.telefon}>{item.anvardareTelefon}</Text> : null}
                  </View>
                  <Text style={styles.datum}>{new Date(item.datum).toLocaleDateString('sv-SE')}</Text>
                </View>
                <View style={styles.kortDetaljer}>
                  <View style={styles.detalj}>
                    <Text style={styles.detaljEtikett}>Timmar</Text>
                    <Text style={styles.detaljVärde}>{item.timmar}</Text>
                  </View>
                  <View style={styles.detalj}>
                    <Text style={styles.detaljEtikett}>Timlön</Text>
                    <Text style={styles.detaljVärde}>{item.timlon?.toLocaleString('sv-SE')} kr</Text>
                  </View>
                  <View style={styles.detalj}>
                    <Text style={styles.detaljEtikett}>Totalt</Text>
                    <Text style={[styles.detaljVärde, styles.totalText]}>{item.totalt_belopp?.toLocaleString('sv-SE')} kr</Text>
                  </View>
                </View>
                {item.foretagNamn && (
                  <Text style={styles.foretag}>Företag: {item.foretagNamn}</Text>
                )}
                <TouchableOpacity style={styles.betaldKnapp} onPress={() => taBortRapport(item.id)}>
                  <Text style={styles.betaldText}>Markera som betald och ta bort</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      ) : aktivFlik === 'fakturering' ? (
        <FlatList
          data={faktureringsunderlag}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            faktureringFel
              ? <Text style={styles.felText}>Fel: {faktureringFel}</Text>
              : <Text style={styles.tom}>Inga ej fakturerade underlag</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.kort}>
              <View style={styles.fakturaHuvud}>
                <Text style={styles.namn}>{item.foretagsnamn ?? '–'}</Text>
                <Text style={styles.fakturaDatum}>{item.datum ? new Date(item.datum).toLocaleDateString('sv-SE') : '–'}</Text>
              </View>
              {item.organisationsnummer ? <Text style={styles.fakturaRad}>Org.nr: {item.organisationsnummer}</Text> : null}
              {item.fakturaadress ? <Text style={styles.fakturaRad}>{item.fakturaadress}{item.postnummer ? `, ${item.postnummer}` : ''}{item.ort ? ` ${item.ort}` : ''}</Text> : null}
              {item.fakturamail ? <Text style={styles.fakturaRad}>Fakturamail: {item.fakturamail}</Text> : null}
              {item.referensperson ? <Text style={styles.fakturaRad}>Ref: {item.referensperson}</Text> : null}
              <View style={styles.kortDetaljer}>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timmar</Text>
                  <Text style={styles.detaljVärde}>{item.timmar}</Text>
                </View>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Timlön</Text>
                  <Text style={styles.detaljVärde}>{item.timlon?.toLocaleString('sv-SE')} kr</Text>
                </View>
                <View style={styles.detalj}>
                  <Text style={styles.detaljEtikett}>Fakturabelopp</Text>
                  <Text style={[styles.detaljVärde, styles.totalText]}>{item.faktureringsbelopp?.toLocaleString('sv-SE')} kr</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.faktureradKnapp} onPress={() => markeraFakturerad(item.id)}>
                <Text style={styles.faktureradText}>Markera som fakturerad och klar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : aktivFlik === 'företag' ? (
        <>
          <View style={styles.sökContainer}>
            <Ionicons name="search-outline" size={18} color="#aaa" style={styles.sökIkon} />
            <TextInput
              style={styles.sökInput}
              placeholder="Sök på mejladress..."
              value={sökFöretag}
              onChangeText={setSökFöretag}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <FlatList
          data={filtreradeFöretag}
          keyExtractor={(item) => item.id.toString()}
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
                </View>
                <View style={styles.jobbBricka}>
                  <Text style={styles.jobbAntal}>{item.antalJobb}</Text>
                  <Text style={styles.jobbEtikett}>annonser</Text>
                </View>
              </View>
              {item.organisationsnummer ? <Text style={styles.företagsDetalj}>Org.nr: {item.organisationsnummer}</Text> : null}
              {item.fakturaadress ? <Text style={styles.företagsDetalj}>{item.fakturaadress}{item.postnummer ? `, ${item.postnummer}` : ''}{item.ort ? ` ${item.ort}` : ''}</Text> : null}
              {item.fakturamail ? <Text style={styles.företagsDetalj}>Fakturamail: {item.fakturamail}</Text> : null}
              {item.referensperson ? <Text style={styles.företagsDetalj}>Ref: {item.referensperson}</Text> : null}
              {item.created_at ? (() => {
                const skapad = new Date(item.created_at);
                const dag = String(skapad.getDate()).padStart(2, '0');
                const mån = String(skapad.getMonth() + 1).padStart(2, '0');
                const år = skapad.getFullYear();
                const dagarSedan = Math.floor((Date.now() - skapad.getTime()) / (1000 * 60 * 60 * 24));
                return <Text style={styles.skapad}>{dag}/{mån}/{år} ({dagarSedan} {dagarSedan === 1 ? 'dag' : 'dagar'} sedan)</Text>;
              })() : null}
            </View>
          )}
        />
        </>
      ) : (
        <>
          <View style={styles.sökContainer}>
            <Ionicons name="search-outline" size={18} color="#aaa" style={styles.sökIkon} />
            <TextInput
              style={styles.sökInput}
              placeholder="Sök på mejladress..."
              value={sökPrivatperson}
              onChangeText={setSökPrivatperson}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <FlatList
          data={filtradePrivatpersoner}
          keyExtractor={(item) => item.id.toString()}
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
                  {item.created_at ? (() => {
                    const skapad = new Date(item.created_at);
                    const dag = String(skapad.getDate()).padStart(2, '0');
                    const mån = String(skapad.getMonth() + 1).padStart(2, '0');
                    const år = skapad.getFullYear();
                    const dagarSedan = Math.floor((Date.now() - skapad.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <Text style={styles.skapad}>{dag}/{mån}/{år} ({dagarSedan} {dagarSedan === 1 ? 'dag' : 'dagar'} sedan)</Text>
                    );
                  })() : null}
                </View>
                {item.avtal_godkant ? (
                  <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                ) : (
                  <Ionicons name="close-circle" size={26} color="#ef4444" />
                )}
              </View>
              {!item.avtal_godkant && (
                <TouchableOpacity style={styles.godkännKnapp} onPress={() => godkännAvtal(item.id)}>
                  <Text style={styles.godkännText}>Markera avtal som godkänt</Text>
                </TouchableOpacity>
              )}
              {item.avtal_godkant && (
                <Text style={styles.godkäntEtikett}>Avtal godkänt</Text>
              )}
            </View>
          )}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flikar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  flik: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  flikAktiv: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  flikText: { fontSize: 13, fontWeight: '600', color: '#999' },
  flikTextAktiv: { color: '#2563eb' },
  filter: { backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  datumInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  filterKnapp: { backgroundColor: '#2563eb', borderRadius: 8, padding: 10, alignItems: 'center' },
  filterKnappText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  lista: { padding: 16, paddingBottom: 32 },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 15 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kortHuvud: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  namn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  klickbart: { color: '#2563eb', textDecorationLine: 'underline' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  telefon: { fontSize: 13, color: '#888', marginTop: 1 },
  skapad: { fontSize: 12, color: '#aaa', marginTop: 3 },
  datum: { fontSize: 13, color: '#999' },
  kortDetaljer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detalj: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, alignItems: 'center' },
  detaljEtikett: { fontSize: 11, color: '#888', marginBottom: 4 },
  detaljVärde: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalText: { color: '#2563eb' },
  foretag: { fontSize: 12, color: '#aaa' },
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
  betaldKnapp: { marginTop: 10, borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  betaldText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  kortHuvudFöretag: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  jobbBricka: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', marginLeft: 8 },
  jobbAntal: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  jobbEtikett: { fontSize: 11, color: '#93c5fd' },
  företagsDetalj: { fontSize: 12, color: '#555', marginTop: 2 },
  fakturaHuvud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fakturaDatum: { fontSize: 13, color: '#999' },
  fakturaRad: { fontSize: 12, color: '#555', marginBottom: 2 },
  felText: { textAlign: 'center', color: '#ef4444', marginTop: 60, fontSize: 14, paddingHorizontal: 16 },
  faktureradKnapp: { marginTop: 10, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  faktureradText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sökContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 },
  sökIkon: { marginRight: 8 },
  sökInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#1a1a1a' },
});
