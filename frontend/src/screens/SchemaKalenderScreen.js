import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useRealtidsPing } from '../context/RealtidsContext';
import MånadsKalender from '../components/MånadsKalender';
import { datumTillIso, formatDagDatum, veckodagsNamn } from '../utils/datumHelper';
import { rollFärg } from '../utils/konstanter';

// Grupperar dagens pass per roll. Rubriken visas ALLTID för en namngiven roll, även när
// dagen bara har en – tidigare krävdes två roller, vilket gjorde att rollen i praktiken
// aldrig syntes för ett schema med en avdelning.
//
// Pass utan roll hamnar i en grupp utan rubrik i stället för under en påhittad
// "Övrigt"-rubrik: ett schema där ingen roll angetts ska inte få en meningslös rubrik
// över varje dag.
//
// Ordningen MÅSTE vara densamma som rollerFörDag i components/MånadsKalender.js, annars
// radar kalenderns prickar och den här listan upp rollerna olika för samma dag.
function grupperaPerKategori(pass) {
  const grupper = {};
  for (const p of pass) {
    const kategori = p.kategori || null;
    (grupper[kategori ?? ''] ??= { kategori, pass: [] }).pass.push(p);
  }
  return Object.values(grupper).sort((a, b) => {
    if (!a.kategori) return 1;   // namnlösa sist
    if (!b.kategori) return -1;
    return a.kategori.localeCompare(b.kategori, 'sv');
  });
}

// Rollerna i den visade månaden, vanligast först. Matar förklaringsraden som kopplar
// kalenderns färgprickar till namn – utan den är färgerna obegripliga.
function rollerIMånaden(pass, år, månad) {
  const prefix = `${år}-${String(månad + 1).padStart(2, '0')}`;
  const antal = {};
  for (const p of pass) {
    if (!p.datum?.startsWith(prefix) || !p.kategori) continue;
    antal[p.kategori] = (antal[p.kategori] || 0) + 1;
  }
  return Object.entries(antal)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
    .map(([namn, n]) => ({ namn, antal: n, färg: rollFärg(namn) }));
}

// Räknar dagar som är bemannade respektive väntar på personal. En dag med både och räknas
// i BÅDA talen – den är delvis bemannad, och att tvinga in den i ett av talen skulle dölja
// att där finns pass kvar att tillsätta.
function räknaDagar(passPerDatum, år, månad) {
  const prefix = `${år}-${String(månad + 1).padStart(2, '0')}`;
  let bemannade = 0;
  let väntande = 0;
  for (const [datum, dagensPass] of Object.entries(passPerDatum)) {
    if (!datum.startsWith(prefix)) continue;
    if (dagensPass.some(p => p.personId != null)) bemannade += 1;
    if (dagensPass.some(p => p.personId == null)) väntande += 1;
  }
  return { bemannade, väntande };
}

// Företagets bemanningsöversikt: vilka dagar de har personal och vem som jobbar när.
// Hämtar tre månader åt gången (föregående, visad, nästa) så att grannmånadernas data
// redan finns medan en ny hämtning pågår. Varje månadsbyte hämtar om – marginalen ger
// överlappande data, inte färre anrop.
export default function SchemaKalenderScreen({ navigation }) {
  const idag = new Date();
  const [år, setÅr] = useState(idag.getFullYear());
  const [månad, setMånad] = useState(idag.getMonth());
  const [valtDatum, setValtDatum] = useState(datumTillIso(idag));
  const [pass, setPass] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  const hämta = useCallback(async () => {
    try {
      // Från första dagen i föregående månad till sista dagen i nästa.
      const från = datumTillIso(new Date(år, månad - 1, 1));
      const till = datumTillIso(new Date(år, månad + 2, 0));
      setPass(await api.schemaKalender(från, till));
    } catch (fel) {
      console.error('Kalender fel:', fel);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }, [år, månad]);

  useEffect(() => { hämta(); }, [hämta]);
  // Filtrera på 'ansokan': hämta() drar tre månaders kalenderdata, och ska inte köras om
  // för varje chattping. Samma resonemang som i MinaJobbScreen.
  useRealtidsPing((payload) => { if (payload?.typ === 'ansokan') hämta(); });

  const passPerDatum = useMemo(() => {
    const grupper = {};
    for (const p of pass) (grupper[p.datum] ??= []).push(p);
    return grupper;
  }, [pass]);

  function bytMånad(steg) {
    const ny = new Date(år, månad + steg, 1);
    setÅr(ny.getFullYear());
    setMånad(ny.getMonth());
    // Valt datum MÅSTE följa med. Annars matchar ingen dag i den nya månaden och kalendern
    // ser omarkerad ut, samtidigt som dagslistan står kvar på den gamla dagen. Landar man i
    // innevarande månad väljs idag, annars den 1:a.
    const nu = new Date();
    const ärDennaMånad = ny.getFullYear() === nu.getFullYear() && ny.getMonth() === nu.getMonth();
    setValtDatum(datumTillIso(ärDennaMånad ? nu : ny));
  }

  const rollerIVisadMånad = useMemo(() => rollerIMånaden(pass, år, månad), [pass, år, månad]);
  const dagensPass = passPerDatum[valtDatum] ?? [];
  const { bemannade, väntande } = useMemo(
    () => räknaDagar(passPerDatum, år, månad),
    [passPerDatum, år, månad]
  );

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
    >
      <MånadsKalender
        år={år}
        månad={månad}
        passPerDatum={passPerDatum}
        valtDatum={valtDatum}
        onVäljDag={setValtDatum}
        onBytMånad={bytMånad}
      />

      {/* Förklaring till kalenderns färgprickar. Utan den säger färgerna ingenting, och
          färgen får aldrig vara enda signalen. */}
      {rollerIVisadMånad.length > 0 && (
        <View style={styles.förklaring}>
          {rollerIVisadMånad.map(r => (
            <View key={r.namn} style={styles.förklaringPost}>
              <View style={[styles.förklaringPrick, { backgroundColor: r.färg }]} />
              <Text style={styles.förklaringText}>{r.namn}</Text>
              <Text style={styles.förklaringAntal}>{r.antal}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sammanfattning}>
        <Ionicons name="people-outline" size={16} color="#2563eb" />
        <Text style={styles.sammanfattningText}>
          {bemannade === 0 && väntande === 0
            ? 'Inga pass inbokade den här månaden'
            : [
                bemannade > 0 && `${bemannade} ${bemannade === 1 ? 'dag' : 'dagar'} bemannade`,
                väntande > 0 && `${väntande} ${väntande === 1 ? 'dag' : 'dagar'} väntar på personal`,
              ].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View style={styles.dagSektion}>
        <Text style={styles.dagRubrik}>
          {veckodagsNamn(valtDatum)} {formatDagDatum(valtDatum)}
        </Text>

        {dagensPass.length === 0 ? (
          <Text style={styles.tomText}>Ingen personal inbokad den här dagen.</Text>
        ) : (
          // Grupperat per roll så att företaget ser vilka avdelningar som är bemannade –
          // det är hela poängen med kategori per pass.
          grupperaPerKategori(dagensPass).map(grupp => (
            <View key={grupp.kategori ?? 'utan-roll'}>
              {grupp.kategori && (
                <View style={styles.kategoriRubrikRad}>
                  <View style={[styles.kategoriPrick, { backgroundColor: rollFärg(grupp.kategori) }]} />
                  <Text style={[styles.kategoriRubrik, { color: rollFärg(grupp.kategori) }]}>
                    {grupp.kategori}
                  </Text>
                  <Text style={styles.kategoriAntal}>{grupp.pass.length} st</Text>
                </View>
              )}
              {grupp.pass.map((p, i) => (
                <TouchableOpacity
                  key={`${p.datum}-${p.personId}-${i}`}
                  style={styles.passKort}
                  onPress={() => p.schemaId && navigation.navigate('SchemaDetalj', { schemaId: p.schemaId })}
                  activeOpacity={0.7}
                >
                  <View style={styles.passHuvud}>
                    <Text style={[styles.passNamn, !p.personNamn && styles.passNamnTom]}>
                      {p.personNamn ?? 'Ej tillsatt'}
                    </Text>
                    {p.status === 'rapporterad' && (
                      <View style={styles.genomfördBricka}>
                        <Text style={styles.genomfördText}>Genomfört</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.passRad}>
                    <Ionicons name="time-outline" size={14} color="#6b7280" />
                    <Text style={styles.passTid}>{p.starttid ?? '–'} – {p.sluttid ?? '–'}</Text>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={16} color="#c7ccd4" />
                  </View>
                  {p.titel ? <Text style={styles.passTitel} numberOfLines={1}>{p.titel}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  sammanfattning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sammanfattningText: { fontSize: 13, color: '#6b7280', flex: 1 },

  dagSektion: { padding: 16 },
  dagRubrik: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textTransform: 'capitalize' },
  tomText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },
  kategoriRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 8 },
  kategoriPrick: { width: 7, height: 7, borderRadius: 4 },
  kategoriRubrik: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  kategoriAntal: { fontSize: 12, color: '#9ca3af' },

  förklaring: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12 },
  förklaringPost: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  förklaringPrick: { width: 8, height: 8, borderRadius: 4 },
  förklaringText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  förklaringAntal: { fontSize: 11, color: '#9ca3af' },

  passKort: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passHuvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  passNamn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  passNamnTom: { color: '#9ca3af', fontStyle: 'italic' },
  genomfördBricka: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  genomfördText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  passRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passTid: { fontSize: 14, color: '#374151' },
  passTitel: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
});
