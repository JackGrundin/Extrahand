import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useJobblistaPing } from '../context/RealtidsContext';

import { KATEGORIER, SCHEMATYPER, schematypEtikett, normalisera } from '../utils/konstanter';
import { parsaArbetstider, formatDagDatum, parsaObTillagg } from '../utils/datumHelper';
import { normaliseraKrav } from '../utils/behorighet';
import StadInput from '../components/StadInput';
import RollBrickor from '../components/RollBrickor';
import Kort from '../components/Kort';
import { useLoggaRefresh } from '../components/LoggaRefresh';
import SkeletonLista from '../components/SkeletonKort';
import TomtTillstånd from '../components/TomtTillstånd';
import { hämtaStäder, läggTillStad, lyssnaPåSökhistorik } from '../utils/sokhistorik';
import { FÄRG, RADIE, STIL } from '../utils/tema';

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
    <TouchableOpacity
      onPress={onPress}
      style={styles.filterVal}
      activeOpacity={0.7}
      accessibilityRole={multiSelect ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={{ checked: !!vald, selected: !!vald }}
    >
      <Text style={styles.filterValText}>{label}</Text>
      {multiSelect ? (
        <View style={[styles.checkbox, vald && styles.checkboxAktiv]}>
          {vald && <Ionicons name="checkmark" size={14} color="#fff" accessible={false} importantForAccessibility="no" />}
        </View>
      ) : (
        vald && <Ionicons name="checkmark" size={20} color="#2563eb" accessible={false} importantForAccessibility="no" />
      )}
    </TouchableOpacity>
  );
}

function KategoriRad({ label, värde, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.kategoriRad} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={värde ? `${label}: ${värde}` : label}>
      <Text style={styles.kategoriRadText}>{label}</Text>
      <View style={styles.kategoriRadHöger}>
        {värde ? <Text style={styles.kategoriRadVärde} numberOfLines={1}>{värde}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" accessible={false} importantForAccessibility="no" />
      </View>
    </TouchableOpacity>
  );
}

// Signalerar bara ATT det finns behörighetskrav – själva listan hör hemma i detaljvyn,
// där den också går att kryssa i. Renderar ingenting när jobbet saknar krav.
function KravBricka({ krav }) {
  const antal = normaliseraKrav(krav).length;
  if (!antal) return null;
  return (
    <View style={styles.kravBadge}>
      <Ionicons name="shield-checkmark" size={11} color="#b45309" accessible={false} importantForAccessibility="no" />
      <Text style={styles.kravBadgeText}>{antal} krav</Text>
    </View>
  );
}

export default function JobbScreen({ navigation }) {
  const [jobb, setJobb] = useState([]);
  const [scheman, setScheman] = useState([]);
  // 'pass' = enstaka pass, 'scheman' = längre uppdrag. Scheman har egen datamodell och
  // egna filterbehov, därför en egen lista i stället för att blandas in bland passen.
  const [läge, setLäge] = useState('pass');
  const [laddar, setLaddar] = useState(true);
  // Tom lista = alla typer, precis som valtaKategorier fungerar.
  const [valdaSchematyper, setValdaSchematyper] = useState([]);
  const [valtaKategorier, setValtaKategorier] = useState([]);
  const [stadFilter, setStadFilter] = useState('');
  const [minLön, setMinLön] = useState('');
  const [minDagar, setMinDagar] = useState('');
  const [sortering, setSortering] = useState('Närmast datum');
  const [modalVisas, setModalVisas] = useState(false);
  const [aktivSektion, setAktivSektion] = useState(null);
  const [sokKategori, setSokKategori] = useState('');
  // De senaste städerna användaren sökt efter, som snabbval under sökfältet.
  const [historikStäder, setHistorikStäder] = useState([]);

  async function hämta() {
    try {
      const [jobbData, schemaData] = await Promise.all([
        api.hämtaJobb(),
        api.hämtaScheman().catch(() => []),
      ]);
      setJobb(jobbData);
      setScheman(schemaData);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  const refresh = useLoggaRefresh(hämta);

  useEffect(() => { hämta(); }, []);

  // Läs in sökhistoriken och håll den uppdaterad när ett nytt val sparas.
  useEffect(() => {
    hämtaStäder().then(setHistorikStäder);
    return lyssnaPåSökhistorik(setHistorikStäder);
  }, []);

  // Sätter sökfältet till en tidigare stad och lyfter den till toppen av historiken.
  function väljHistorikStad(stad) {
    setStadFilter(stad);
    läggTillStad(stad);
  }

  // Realtid: uppdatera listan direkt när ett jobb publiceras, ändras, tas bort eller
  // blir tillsatt/ledigt – utan att privatpersonen behöver dra för att ladda om.
  useJobblistaPing(() => { hämta(); });

  const aktivaFilter = [
    valtaKategorier.length > 0,
    minLön !== '',
    minDagar !== '',
    sortering !== 'Närmast datum',
  ].filter(Boolean).length;

  const filtrerade = jobb
    .filter((j) => {
      const kategoriOk = valtaKategorier.length === 0 || valtaKategorier.includes(j.Kategori);
      const stadOk = !stadFilter.trim() || (j.Plats ?? '').toLowerCase().includes(stadFilter.trim().toLowerCase());
      const lönOk = !minLön || (j.Lon != null && j.Lon >= parseInt(minLön));
      const dagarOk = !minDagar || (j.antal_dagar != null && j.antal_dagar >= parseInt(minDagar));
      return kategoriOk && stadOk && lönOk && dagarOk;
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

  const filtreradeScheman = scheman.filter(s =>
    (!stadFilter.trim() || (s.plats ?? '').toLowerCase().includes(stadFilter.trim().toLowerCase())) &&
    (valdaSchematyper.length === 0 || valdaSchematyper.includes(s.typ))
  );

  return (
    <View style={{ flex: 1, backgroundColor: FÄRG.bakgrund }}>
      {refresh.LoggaOverlay}
      <View style={styles.lägeVäljare}>
        <TouchableOpacity
          style={[styles.lägeKnapp, läge === 'pass' && styles.lägeKnappAktiv]}
          onPress={() => setLäge('pass')}
          activeOpacity={0.8}
        >
          <Text style={[styles.lägeText, läge === 'pass' && styles.lägeTextAktiv]}>
            Enstaka pass ({jobb.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.lägeKnapp, läge === 'scheman' && styles.lägeKnappAktiv]}
          onPress={() => setLäge('scheman')}
          activeOpacity={0.8}
        >
          <Text style={[styles.lägeText, läge === 'scheman' && styles.lägeTextAktiv]}>
            Scheman ({scheman.length})
          </Text>
        </TouchableOpacity>
      </View>

      {laddar ? (
        <SkeletonLista style={styles.lista} />
      ) : läge === 'scheman' ? (
        <FlatList
          data={filtreradeScheman}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={refresh.refreshControl}
          onScroll={refresh.onScroll}
          scrollEventThrottle={refresh.scrollEventThrottle}
          onLayout={refresh.onListLayout}
          ListHeaderComponent={
            <>
              <View style={styles.schemaHeader}>
                <StadInput
                  värde={stadFilter}
                  onÄndra={setStadFilter}
                  placeholder="Sök på stad..."
                  inputStyle={styles.stadInput}
                  containerStyle={{ flex: 1 }}
                  absolutLista
                  autoCapitalize="none"
                />
              </View>
              {/* Utanför filtermodalen med flit: den är byggd för pass-läget, och dess
                  lön-, dagar- och kategorifält gäller inte scheman. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typChipRad}
              >
                <TouchableOpacity
                  style={[styles.typChip, valdaSchematyper.length === 0 && styles.typChipAktiv]}
                  onPress={() => setValdaSchematyper([])}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typChipText, valdaSchematyper.length === 0 && styles.typChipTextAktiv]}>
                    Alla
                  </Text>
                </TouchableOpacity>
                {SCHEMATYPER.map(t => {
                  const vald = valdaSchematyper.includes(t.värde);
                  return (
                    <TouchableOpacity
                      key={t.värde}
                      style={[styles.typChip, vald && styles.typChipAktiv]}
                      onPress={() => setValdaSchematyper(prev =>
                        prev.includes(t.värde) ? prev.filter(x => x !== t.värde) : [...prev, t.värde]
                      )}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t.etikett}
                      accessibilityState={{ checked: vald }}
                    >
                      {vald && <Ionicons name="checkmark" size={13} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />}
                      <Text style={[styles.typChipText, vald && styles.typChipTextAktiv]}>
                        {t.etikett}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            stadFilter.trim() || valdaSchematyper.length > 0 ? (
              <TomtTillstånd
                ikon="calendar-outline"
                rubrik="Inga scheman matchar filtret"
                text="Prova en annan stad eller rensa filtret."
              />
            ) : (
              <TomtTillstånd
                ikon="calendar-outline"
                rubrik="Inga längre uppdrag just nu"
                text="Nya scheman dyker upp här när företag publicerar dem."
              />
            )
          }
          renderItem={({ item }) => (
            <Kort
              style={styles.kort}
              onPress={() => navigation.navigate('SchemaDetalj', { schemaId: item.id })}
            >
              <Text style={styles.foretag} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
              <Text style={styles.jobbTitel} numberOfLines={2}>{item.titel}</Text>
              {/* Ett schema har ingen egen kategori – rollerna sätts per pass. Visa de
                  vanligaste i stället (backend sorterar dem på frekvens). */}
              <RollBrickor roller={item.kategorier} style={{ marginBottom: 10, marginTop: 2 }} />

              <View style={styles.datumRad}>
                <Ionicons name="calendar" size={14} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
                <View style={styles.datumChip}>
                  <Text style={styles.datumChipText}>
                    {formatDagDatum(item.startdatum)} – {formatDagDatum(item.slutdatum)}
                  </Text>
                </View>
                <Text style={styles.flerDatumText}>{item.antalPass} pass</Text>
              </View>

              <View style={styles.platsRad}>
                <Ionicons name="location-outline" size={14} color={FÄRG.textSvag} accessible={false} importantForAccessibility="no" />
                <Text style={styles.info}>{item.plats} · {schematypEtikett(item.typ)}</Text>
              </View>
              <View style={styles.extraRad}>
                {item.timlon != null && (
                  <Text style={styles.lön}>{Number(item.timlon).toLocaleString('sv-SE')} kr/tim</Text>
                )}
                {parsaObTillagg(item.ob_tillagg).length > 0 && (
                  <View style={styles.obBadge}><Text style={styles.obBadgeText}>OB</Text></View>
                )}
                <KravBricka krav={item.behorighets_krav} />
              </View>
            </Kort>
          )}
        />
      ) : (
      <>
      <View style={styles.headerContainer}>
        <StadInput
          värde={stadFilter}
          onÄndra={setStadFilter}
          onVälj={läggTillStad}
          placeholder="Sök på stad..."
          inputStyle={styles.stadInput}
          containerStyle={styles.stadInputWrapper}
          absolutLista
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.filterKnapp} onPress={() => setModalVisas(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Filter">
          <Ionicons name="options-outline" size={16} color="#2563eb" accessible={false} importantForAccessibility="no" />
          <Text style={styles.filterKnappText}>Filter</Text>
          {aktivaFilter > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{aktivaFilter}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Snabbval: senaste sökta städer, bara när sökfältet är tomt. */}
      {!stadFilter.trim() && historikStäder.length > 0 && (
        <View style={styles.historikRad}>
          <Text style={styles.historikRubrik}>Senaste sökningar</Text>
          <View style={styles.historikChips}>
            {historikStäder.map((stad) => (
              <TouchableOpacity
                key={stad}
                style={styles.historikChip}
                onPress={() => väljHistorikStad(stad)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Sök i ${stad}`}
              >
                <Ionicons name="time-outline" size={13} color="#6b7280" accessible={false} importantForAccessibility="no" />
                <Text style={styles.historikChipText}>{stad}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={filtrerade}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={refresh.refreshControl}
        onScroll={refresh.onScroll}
        scrollEventThrottle={refresh.scrollEventThrottle}
        onLayout={refresh.onListLayout}
        ListEmptyComponent={
          aktivaFilter > 0 || stadFilter.trim() ? (
            <TomtTillstånd
              ikon="briefcase-outline"
              rubrik={stadFilter.trim() ? `Inga jobb i ${stadFilter.trim()}` : 'Inga jobb matchar filtret'}
              text="Prova en annan stad eller rensa filtret."
            />
          ) : (
            <TomtTillstånd
              ikon="briefcase-outline"
              rubrik="Inga jobb ute just nu"
              text="Dra neråt för att uppdatera – nya pass dyker upp här."
            />
          )
        }
        renderItem={({ item }) => {
          const schema = parsaArbetstider(item.arbetstider);
          const datum = schema ? schema.map(d => d.datum).filter(Boolean) : [];
          const visaDatum = datum.slice(0, 3);
          const flerDatum = datum.length > 3 ? datum.length - 3 : 0;
          return (
            <Kort style={styles.kort} onPress={() => navigation.navigate('JobbDetalj', { jobb: item })}>
              <View style={styles.kortTopp}>
                <Text style={styles.foretag} numberOfLines={1}>{item.foretagNamn ?? 'Okänt företag'}</Text>
                {item.Kategori && (
                  <View style={styles.kategoriTag}>
                    <Text style={styles.kategoriTagText} numberOfLines={1}>{item.Kategori}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.jobbTitel} numberOfLines={2}>{item.Titel}</Text>

              {datum.length > 0 && (
                <View style={styles.datumRad}>
                  <Ionicons name="calendar" size={14} color={FÄRG.primär} accessible={false} importantForAccessibility="no" />
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

              <View style={styles.platsRad}>
                <Ionicons name="location-outline" size={14} color={FÄRG.textSvag} accessible={false} importantForAccessibility="no" />
                <Text style={styles.info}>{item.Plats} · {item.Typ}</Text>
              </View>
              <View style={styles.extraRad}>
                {item.Lon && <Text style={styles.lön}>{item.Lon.toLocaleString('sv-SE')} kr/tim</Text>}
                {parsaObTillagg(item.ob_tillagg).length > 0 && (
                  <View style={styles.obBadge}><Text style={styles.obBadgeText}>OB</Text></View>
                )}
                <KravBricka krav={item.behorighets_krav} />
                {item.antal_dagar != null && <Text style={styles.extraInfo}>{item.antal_dagar} dagar</Text>}
              </View>
            </Kort>
          );
        }}
      />
      </>
      )}

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
                  accessibilityRole="button"
                  accessibilityLabel="Tillbaka"
                >
                  <Ionicons name="chevron-back" size={20} color="#2563eb" accessible={false} importantForAccessibility="no" />
                  <Text style={styles.tillbakaText}>
                    {aktivSektion === 'sortering' ? 'Sortering'
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
  lägeVäljare: { flexDirection: 'row', gap: 8, backgroundColor: FÄRG.yta, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  lägeKnapp: { flex: 1, paddingVertical: 10, borderRadius: RADIE.sm, alignItems: 'center', backgroundColor: FÄRG.ytaDämpad },
  lägeKnappAktiv: { backgroundColor: FÄRG.primär },
  lägeText: { fontSize: 14, fontWeight: '700', color: FÄRG.textDämpad },
  lägeTextAktiv: { color: '#fff' },
  schemaHeader: { flexDirection: 'row', marginBottom: 12, zIndex: 30 },
  typChipRad: { flexDirection: 'row', gap: 8, paddingBottom: 12, paddingRight: 4 },
  typChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: FÄRG.kant, borderRadius: RADIE.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: FÄRG.yta },
  typChipAktiv: { backgroundColor: FÄRG.primärMjuk, borderColor: FÄRG.primär },
  typChipText: { fontSize: 13, color: FÄRG.textDämpad, fontWeight: '600' },
  typChipTextAktiv: { color: FÄRG.primär },

  headerContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: FÄRG.yta, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: FÄRG.kant, zIndex: 30 },
  stadInputWrapper: { flex: 1, zIndex: 30 },
  stadInput: { borderWidth: 1, borderColor: FÄRG.kant, borderRadius: RADIE.sm, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: FÄRG.ytaDämpad, color: FÄRG.text, letterSpacing: 0 },
  filterKnapp: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: RADIE.sm, borderWidth: 1, borderColor: FÄRG.primärKant, backgroundColor: FÄRG.primärMjuk },
  filterKnappText: { fontSize: 14, fontWeight: '700', color: FÄRG.primär },
  badge: { backgroundColor: FÄRG.primär, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  historikRad: { backgroundColor: FÄRG.yta, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2, borderBottomWidth: 1, borderBottomColor: FÄRG.kant },
  historikRubrik: { fontSize: 12, fontWeight: '700', color: FÄRG.textSvag, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  historikChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historikChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: FÄRG.ytaDämpad, borderRadius: RADIE.pill, paddingHorizontal: 12, paddingVertical: 7 },
  historikChipText: { fontSize: 13, color: FÄRG.textDämpad, fontWeight: '600' },

  lista: { padding: 16, backgroundColor: FÄRG.bakgrund },
  kort: { marginBottom: 12 },
  kortTopp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  foretag: { fontSize: 13, fontWeight: '600', color: FÄRG.textDämpad, flex: 1 },
  jobbTitel: { fontSize: 17, fontWeight: '700', color: FÄRG.text, marginTop: 2, marginBottom: 10 },
  kategoriTag: { backgroundColor: FÄRG.primärMjuk, borderRadius: RADIE.pill, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 150 },
  kategoriTagText: { fontSize: 12, color: FÄRG.primär, fontWeight: '700' },
  platsRad: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  info: { fontSize: 14, color: FÄRG.textDämpad, flex: 1 },
  lön: { fontSize: 16, color: FÄRG.primär, fontWeight: '800' },
  datumRad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  datumChip: { backgroundColor: FÄRG.primärMjuk, borderRadius: RADIE.sm, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: FÄRG.primärKant },
  datumChipText: { fontSize: 13, fontWeight: '700', color: FÄRG.primär },
  flerDatumText: { fontSize: 13, color: FÄRG.textDämpad, fontWeight: '600' },
  extraRad: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  extraInfo: { fontSize: 13, color: FÄRG.textSvag, fontWeight: '500' },
  obBadge: { backgroundColor: FÄRG.varningMjuk, borderRadius: RADIE.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: FÄRG.varningKant },
  kravBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderRadius: RADIE.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#fde68a' },
  kravBadgeText: { fontSize: 11, color: FÄRG.varningText, fontWeight: '700' },
  obBadgeText: { fontSize: 11, fontWeight: '700', color: FÄRG.varning },
  tom: { textAlign: 'center', color: FÄRG.textSvag, marginTop: 60, fontSize: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalPanel: { backgroundColor: FÄRG.yta, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '85%' },
  modalHandtag: { width: 40, height: 4, backgroundColor: FÄRG.kantStark, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitel: { fontSize: 18, fontWeight: '700', color: FÄRG.text, textAlign: 'center', marginBottom: 20 },

  kategoriRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: FÄRG.kant },
  kategoriRadText: { fontSize: 16, color: FÄRG.text },
  kategoriRadHöger: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  kategoriRadVärde: { fontSize: 14, color: FÄRG.primär, maxWidth: 140 },

  tillbakaKnapp: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  tillbakaText: { fontSize: 17, fontWeight: '600', color: FÄRG.primär },

  sokInput: { ...STIL.input, paddingVertical: 11, marginBottom: 10, letterSpacing: 0 },

  filterVal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: FÄRG.kant },
  filterValText: { fontSize: 16, color: FÄRG.text },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: FÄRG.kantStark, alignItems: 'center', justifyContent: 'center' },
  checkboxAktiv: { backgroundColor: FÄRG.primär, borderColor: FÄRG.primär },

  rensaKnapp: { paddingVertical: 10, marginBottom: 4 },
  rensaText: { fontSize: 14, color: FÄRG.fel, fontWeight: '600' },
  ingaResultat: { fontSize: 15, color: FÄRG.textSvag, textAlign: 'center', marginTop: 24 },

  inputEtikett: { fontSize: 14, fontWeight: '600', color: FÄRG.textDämpad, marginBottom: 6, marginTop: 12 },
  modalInput: { ...STIL.input, paddingVertical: 11, marginBottom: 4, letterSpacing: 0 },

  modalKnappar: { flexDirection: 'row', gap: 12, marginTop: 20 },
  återställKnapp: { flex: 1, paddingVertical: 14, borderRadius: RADIE.sm, borderWidth: 1.5, borderColor: FÄRG.kant, alignItems: 'center' },
  återställText: { fontSize: 15, fontWeight: '700', color: FÄRG.textDämpad },
  visaKnapp: { flex: 2, paddingVertical: 14, borderRadius: RADIE.sm, backgroundColor: FÄRG.primär, alignItems: 'center' },
  väljKnapp: { paddingVertical: 15, borderRadius: RADIE.sm, backgroundColor: FÄRG.primär, alignItems: 'center', marginTop: 16 },
  visaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
