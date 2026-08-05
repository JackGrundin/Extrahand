import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import TidVäljare from './TidVäljare';
import ObRedigerare from './ObRedigerare';
import { normalisera } from '../utils/konstanter';

// Fälten som beskriver ETT pass utöver datumet: tider, roll och OB.
//
// Delas av SchemaPassModal (ett enskilt pass) och av standardpanelen i schemapubliceringens
// steg 3 (värden som ska tillämpas på flera pass samtidigt). Utan utbrytningen hade
// chips-logiken för rollförslag blivit en andra kopia.
//
// Helt kontrollerad – komponenten håller inget eget state, så samma värden kan redigeras
// från två håll utan att de glider isär.
export default function PassDetaljFält({
  starttid,
  sluttid,
  kategori,
  obTillagg,
  onStarttid,
  onSluttid,
  onKategori,
  onObTillagg,
  egnaKategorier = [],
  standardKategorier = [],
  timlön = 0,
  paslag,
  obRubrik = 'OB-tillägg',
}) {
  // Företagets egna roller först – det är nästan alltid dem de vill ha – sedan
  // standardlistan. Diakritokänsligt, och exakt träff filtreras bort eftersom den redan
  // står i fältet.
  const sökterm = normalisera(kategori);
  const förslag = [
    ...egnaKategorier,
    ...standardKategorier.filter(k => !egnaKategorier.includes(k)),
  ]
    .filter(k => sökterm.length === 0 || normalisera(k).includes(sökterm))
    .filter(k => normalisera(k) !== sökterm)
    .slice(0, 6);

  return (
    <>
      <Text style={styles.etikett}>Tider</Text>
      <View style={styles.tidRad}>
        <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={starttid} onChange={onStarttid} />
        <Text style={styles.streck}>–</Text>
        <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={sluttid} onChange={onSluttid} />
      </View>

      <Text style={styles.etikett}>Roll / avdelning</Text>
      <TextInput
        style={styles.input}
        placeholder="t.ex. Liftvärd"
        value={kategori}
        onChangeText={onKategori}
        maxLength={40}
        autoCorrect={false}
      />
      {förslag.length > 0 && (
        <View style={styles.chipRad}>
          {förslag.map(k => (
            <TouchableOpacity key={k} style={styles.chip} onPress={() => onKategori(k)} activeOpacity={0.7}>
              <Text style={styles.chipText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.hjälp}>Egen text går bra – rollen visas i schemat och i kalendern.</Text>

      <View style={{ marginTop: 16 }}>
        <ObRedigerare
          värde={obTillagg}
          onÄndra={onObTillagg}
          timlön={timlön}
          paslag={paslag}
          rubrik={obRubrik}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  etikett: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  tidRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streck: { fontSize: 16, color: '#9ca3af' },
  chipRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
});
