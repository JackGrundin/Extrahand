import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useJobblistaPing } from '../context/RealtidsContext';

import { TYPER_FILTER as TYPER, KATEGORIER, normalisera } from '../utils/konstanter';
import { parsaArbetstider, formatDagDatum, parsaObTillagg } from '../utils/datumHelper';
import StadInput from '../components/StadInput';

const SORTERING = ['Närmast datum', 'Nyast', 'Högst lön', 'Flest dagar'];

function närmasteDatum(jobb) {
  const schema = parsaArbetstider(jobb.arbetstider);
  if (!schema) return null;
  const datum = schema
    .map(d => d.datum)
    .filter(Boolean)
    .map(d => new Date(d + 'T12:00:00'))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  return datum[0] ?? null;
}


function FilterVal({ label, vald, onPress, multiSelect }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.filterVal} activeOpacity={0.7}>
      <Text style={styles.filterValText}>{label}</Text>
      {multiSelect ? (
        <View style={[styles.checkbox, vald && styles.checkboxAktiv]}>
          {vald && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      ) : (
        vald && <Ionicons name="checkmark" size={20} color="#2563eb" />
      )}
    </TouchableOpacity>
  );
}

function KategoriRad({ label, värde, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.kategoriRad} activeOpacity={0.7}>
      <Text style={styles.kategoriRadText}>{label}</Text>
      <View style={styles.kategoriRadHöger}>
        {värde ? <Text style={styles.kategoriRadVärde} numberOfLines={1}>{värde}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );
}

export default function JobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [valtTyp, setValtTyp] = useState('Alla');
  const [valtaKategorier, setValtaKategorier] = useState([]);
  const [stadFilter, setStadFilter] = useState('');
  const [minLön, setMinLön] = useState('');
  const [minDagar, setMinDagar] = useState('');
  const [sortering, setSortering] = useState('Närmast datum');
  const [modalVisas, setModalVisas] = useState(false);
  const [aktivSektion, setAktivSektion] = useState(null);
  const [sokKategori, setSokKategori] = useState('');

  async function hämta() {
    try {
      const data = await api.hämtaJobb();
      setJobb(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }

  useEffect(() => { hämta(); }, []);

  // Realtid: uppdatera listan direkt när ett jobb publiceras, ändras, tas bort eller
  // blir tillsatt/ledigt – utan att privatpersonen behöver dra för att ladda om.
  useJobblistaPing(() => { hämta(); });

  const aktivaFilter = [
    valtTyp !== 'Alla',
    valtaKategorier.length > 0,
    minLön !== '',
    minDagar !== '',
    sortering !== 'Närmast datum',
  ].filter(Boolean).length;

  const filtrerade = jobb
    .filter((j) => {
      const typOk = valtTyp === 'Alla' || j.Typ === valtTyp;
      const kategoriOk = valtaKategorier.length === 0 || valtaKategorier.includes(j.Kategori);
      const stadOk = !stadFilter.trim() || (j.Plats ?? '').toLowerCase().includes(stadFilter.trim().toLowerCase());
      const lönOk = !minLön || (j.Lon != null && j.Lon >= parseInt(minLön));
      const dagarOk = !minDagar || (j.antal_dagar != null && j.antal_dagar >= parseInt(minDagar));
      return typOk && kategoriOk && stadOk && lönOk && dagarOk;
    })
    .sort((a, b) => {
      if (sortering === 'Högst lön') return (b.Lon ?? 0) - (a.Lon ?? 0);
      if (sortering === 'Flest dagar') return (b.antal_dagar ?? 0) - (a.antal_dagar ?? 0);
      if (sortering === 'Nyast') return new Date(b.created_at) - new Date(a.created_at);
      const dA = närmasteDatum(a);
      const dB = närmasteDatum(b);
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return dA - dB;
    });

  function stängModal() {
    setModalVisas(false);
    setAktivSektion(null);
    setSokKategori('');
  }

  function återställFilter() {
    setValtTyp('Alla');
    setValtaKategorier([]);
    setMinLön('');
    setMinDagar('');
    setSortering('Närmast datum');
  }

  function växlaKategori(k) {
    setValtaKategorier(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    );
  }

  function lönTidSummering() {
    const delar = [];
    if (minLön) delar.push(`${minLön} kr/tim`);
    if (minDagar) delar.push(`${minDagar} dagar`);
    return delar.join(', ');
  }

  const filtreradeKategorier = KATEGORIER.filter(k =>
    normalisera(k).includes(normalisera(sokKategori))
  );

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.headerContainer}>
        <StadInput
          värde={stadFilter}
          onÄndra={setStadFilter}
          placeholder="Sök på stad..."
          inputStyle={styles.stadInput}
          containerStyle={styles.stadInputWrapper}
          absolutLista
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.filterKnapp} onPress={() => setModalVisas(true)} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={16} color="#2563eb" />
          <Text style={styles.filterKnappText}>Filter</Text>
          {aktivaFilter > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{aktivaFilter}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtrerade}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListEmptyComponent={<Text style={styles.tom}>Inga jobb matchar filtret</Text>}
        renderItem={({ item }) => {
          const schema = parsaArbetstider(item.arbetstider);
          const datum = schema ? schema.map(d => d.datum).filter(Boolean) : [];
          const visaDatum = datum.slice(0, 3);
          const flerDatum = datum.length > 3 ? datum.length - 3 : 0;
          return (
            <TouchableOpacity style={styles.kort} onPress={() => navigation.navigate('JobbDetalj', { jobb: item })}>
              <View style={styles.kortTopp}>
                <Text style={styles.titel} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
                {item.Kategori && <Text style={styles.kategoriTag}>{item.Kategori}</Text>}
              </View>
              <Text style={styles.jobbTitel} numberOfLines={1}>{item.Titel}</Text>

              {datum.length > 0 && (
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

              <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
              <View style={styles.extraRad}>
                {item.Lon && <Text style={styles.lön}>{item.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
                {parsaObTillagg(item.ob_tillagg).length > 0 && (
                  <View style={styles.obBadge}><Text style={styles.obBadgeText}>OB</Text></View>
                )}
                {item.antal_dagar != null && <Text style={styles.extraInfo}>{item.antal_dagar} dagar</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={modalVisas} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={stängModal} />
          <View style={styles.modalPanel}>
            <View style={styles.modalHandtag} />

            {aktivSektion === null ? (
              <>
                <Text style={styles.modalTitel}>Filtrera jobb</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <KategoriRad
                    label="Sortering"
                    värde={sortering !== 'Nyast' ? sortering : null}
                    onPress={() => setAktivSektion('sortering')}
                  />
                  <KategoriRad
                    label="Typ"
                    värde={valtTyp !== 'Alla' ? valtTyp.charAt(0).toUpperCase() + valtTyp.slice(1) : null}
                    onPress={() => setAktivSektion('typ')}
                  />
                  <KategoriRad
                    label="Kategori"
                    värde={valtaKategorier.length > 0 ? valtaKategorier.join(', ') : null}
                    onPress={() => setAktivSektion('kategori')}
                  />
                  <KategoriRad
                    label="Lön och tid"
                    värde={lönTidSummering() || null}
                    onPress={() => setAktivSektion('lonTid')}
                  />
                </ScrollView>
                <View style={styles.modalKnappar}>
                  <TouchableOpacity style={styles.återställKnapp} onPress={återställFilter} activeOpacity={0.8}>
                    <Text style={styles.återställText}>Återställ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.visaKnapp} onPress={stängModal} activeOpacity={0.8}>
                    <Text style={styles.visaText}>Visa {filtrerade.length} jobb</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.tillbakaKnapp}
                  onPress={() => { setAktivSektion(null); setSokKategori(''); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={20} color="#2563eb" />
                  <Text style={styles.tillbakaText}>
                    {aktivSektion === 'sortering' ? 'Sortering'
                      : aktivSektion === 'typ' ? 'Typ'
                      : aktivSektion === 'kategori' ? 'Kategori'
                      : 'Lön och tid'}
                  </Text>
                </TouchableOpacity>

                {aktivSektion === 'kategori' && (
                  <TextInput
                    style={styles.sokInput}
                    placeholder="Sök kategori..."
                    placeholderTextColor="#9ca3af"
                    value={sokKategori}
                    onChangeText={setSokKategori}
                    clearButtonMode="while-editing"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                )}

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {aktivSektion === 'sortering' && SORTERING.map((s) => (
                    <FilterVal key={s} label={s} vald={sortering === s} onPress={() => setSortering(s)} />
                  ))}

                  {aktivSektion === 'typ' && TYPER.map((t) => (
                    <FilterVal
                      key={t}
                      label={t === 'Alla' ? 'Alla typer' : t.charAt(0).toUpperCase() + t.slice(1)}
                      vald={valtTyp === t}
                      onPress={() => setValtTyp(t)}
                    />
                  ))}

                  {aktivSektion === 'kategori' && (
                    <>
                      {valtaKategorier.length > 0 && (
                        <TouchableOpacity onPress={() => setValtaKategorier([])} style={styles.rensaKnapp} activeOpacity={0.7}>
                          <Text style={styles.rensaText}>Rensa val ({valtaKategorier.length})</Text>
                        </TouchableOpacity>
                      )}
                      {filtreradeKategorier.length === 0 ? (
                        <Text style={styles.ingaResultat}>Inga kategorier hittades</Text>
                      ) : (
                        filtreradeKategorier.map((k) => (
                          <FilterVal
                            key={k}
                            label={k}
                            vald={valtaKategorier.includes(k)}
                            onPress={() => växlaKategori(k)}
                            multiSelect
                          />
                        ))
                      )}
                    </>
                  )}

                  {aktivSektion === 'lonTid' && (
                    <View style={{ paddingTop: 8 }}>
                      <Text style={styles.inputEtikett}>Min lön (kr/tim)</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="t.ex. 150"
                        value={minLön}
                        onChangeText={setMinLön}
                        keyboardType="numeric"
                        clearButtonMode="while-editing"
                      />
                      <Text style={styles.inputEtikett}>Min antal dagar</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="t.ex. 5"
                        value={minDagar}
                        onChangeText={setMinDagar}
                        keyboardType="numeric"
                        clearButtonMode="while-editing"
                      />
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.väljKnapp}
                  onPress={() => { setAktivSektion(null); setSokKategori(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.visaText}>Välj</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', zIndex: 30 },
  stadInputWrapper: { flex: 1, zIndex: 30 },
  stadInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a', letterSpacing: 0 },
  filterKnapp: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  filterKnappText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  badge: { backgroundColor: '#2563eb', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  lista: { padding: 16 },
  kort: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kortTopp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titel: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  jobbTitel: { fontSize: 14, color: '#555', marginBottom: 4 },
  kategoriTag: { fontSize: 12, color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  info: { fontSize: 14, color: '#666', marginBottom: 4 },
  lön: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  datumRad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginTop: 6 },
  datumChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  datumChipText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  flerDatumText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  extraRad: { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' },
  extraInfo: { fontSize: 13, color: '#888' },
  obBadge: { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#fed7aa' },
  obBadgeText: { fontSize: 11, fontWeight: '700', color: '#ea580c' },
  tom: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '85%' },
  modalHandtag: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 20 },

  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kategoriRadText: { fontSize: 16, color: '#1a1a1a' },
  kategoriRadHöger: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  kategoriRadVärde: { fontSize: 14, color: '#2563eb', maxWidth: 140 },

  tillbakaKnapp: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  tillbakaText: { fontSize: 17, fontWeight: '600', color: '#2563eb' },

  sokInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa', marginBottom: 10, letterSpacing: 0 },

  filterVal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterValText: { fontSize: 16, color: '#1a1a1a' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkboxAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },

  rensaKnapp: { paddingVertical: 10, marginBottom: 4 },
  rensaText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  ingaResultat: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 24 },

  inputEtikett: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 4, letterSpacing: 0 },

  modalKnappar: { flexDirection: 'row', gap: 12, marginTop: 20 },
  återställKnapp: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  återställText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  visaKnapp: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  väljKnapp: { paddingVertical: 14, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', marginTop: 16 },
  visaText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
