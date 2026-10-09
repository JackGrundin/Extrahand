import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import TidVäljare from './TidVäljare';
import ObRedigerare from './ObRedigerare';
import { normalisera } from '../utils/konstanter';

// Snabbval för rast. "Ingen rast" = 0, inte null: ett aktivt val som markerar knappen.
const RAST_VAL = [
  { etikett: 'Ingen rast', värde: 0 },
  { etikett: '30 min', värde: 30 },
  { etikett: '60 min', värde: 60 },
];

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
  // Rast i minuter. null = orörd (används av massredigeringen för att inte skriva över),
  // 0 = ingen rast. onRastMinuter får alltid ett tal (0 när fältet töms).
  rastMinuter = null,
  onRastMinuter,
  // Steg 3 visar tiderna direkt på passkortet och sätter därför visaTider={false} så att
  // de inte dubbleras i den utfällda editorn. Övriga anropare behåller tiderna här.
  visaTider = true,
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
      {visaTider && (
        <>
          <Text style={styles.etikett}>Tider</Text>
          <View style={styles.tidRad}>
            <TidVäljare style={{ flex: 1 }} placeholder="08:00" value={starttid} onChange={onStarttid} />
            <Text style={styles.streck}>–</Text>
            <TidVäljare style={{ flex: 1 }} placeholder="17:00" value={sluttid} onChange={onSluttid} />
          </View>
        </>
      )}

      <Text style={styles.etikett}>Rast</Text>
      <View style={styles.rastRad}>
        {RAST_VAL.map(({ etikett, värde }) => {
          const vald = rastMinuter === värde;
          return (
            <TouchableOpacity
              key={värde}
              style={[styles.rastKnapp, vald && styles.rastKnappVald]}
              onPress={() => onRastMinuter?.(värde)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: vald }}
              accessibilityLabel={`Rast: ${etikett}`}
            >
              <Text style={[styles.rastKnappText, vald && styles.rastKnappTextVald]}>{etikett}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        placeholder="Egen tid i minuter, t.ex. 45"
        value={rastMinuter ? String(rastMinuter) : ''}
        onChangeText={(t) => {
          const siffror = t.replace(/[^0-9]/g, '');
          onRastMinuter?.(siffror === '' ? 0 : Number(siffror));
        }}
        keyboardType="numeric"
        maxLength={4}
      />
      <Text style={styles.hjälp}>Rasten dras av automatiskt från passets timmar på tidrapporten.</Text>

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
            <TouchableOpacity
              key={k}
              style={styles.chip}
              onPress={() => onKategori(k)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Välj roll: ${k}`}
            >
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
  rastRad: { flexDirection: 'row', gap: 8 },
  rastKnapp: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 10, backgroundColor: '#fafafa' },
  rastKnappVald: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  rastKnappText: { fontSize: 14, color: '#444', fontWeight: '600' },
  rastKnappTextVald: { color: '#2563eb' },
});
