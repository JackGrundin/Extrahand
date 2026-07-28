import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { datumTillIso } from '../utils/datumHelper';

// Måndagsbaserad månadskalender byggd av vanliga View:er. Appen har inget
// kalenderbibliotek och all datumlogik ligger i datumHelper.js, så ett nytt beroende
// vore mer att underhålla än de dryga hundra raderna nedan.

const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
const MÅNADER = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

// Bygger rutnätet: null för tomma celler före den 1:a och efter månadens sista dag.
function byggCeller(år, månad) {
  // getDay(): 0=söndag. Räkna om till 0=måndag så veckan börjar rätt.
  const förstaVeckodag = (new Date(år, månad, 1).getDay() + 6) % 7;
  const antalDagar = new Date(år, månad + 1, 0).getDate();

  const celler = Array(förstaVeckodag).fill(null);
  for (let dag = 1; dag <= antalDagar; dag++) celler.push(dag);
  // Fyll ut sista veckan så att rutnätet blir rektangulärt.
  while (celler.length % 7 !== 0) celler.push(null);
  return celler;
}

export default function MånadsKalender({ år, månad, passPerDatum, valtDatum, onVäljDag, onBytMånad }) {
  const celler = byggCeller(år, månad);
  const idag = datumTillIso(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.rubrikRad}>
        <TouchableOpacity onPress={() => onBytMånad(-1)} hitSlop={12} style={styles.pil}>
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.månadRubrik}>{MÅNADER[månad]} {år}</Text>
        <TouchableOpacity onPress={() => onBytMånad(1)} hitSlop={12} style={styles.pil}>
          <Ionicons name="chevron-forward" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.veckodagsRad}>
        {VECKODAGAR.map(d => (
          <Text key={d} style={styles.veckodag}>{d}</Text>
        ))}
      </View>

      <View style={styles.rutnät}>
        {celler.map((dag, i) => {
          if (dag == null) return <View key={`tom-${i}`} style={styles.cell} />;

          const datum = `${år}-${String(månad + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
          const pass = passPerDatum[datum] ?? [];
          const ärIdag = datum === idag;
          const ärVald = datum === valtDatum;
          // En dag där allt är genomfört markeras grönt, annars blått för planerat.
          const alltGenomfört = pass.length > 0 && pass.every(p => p.status === 'rapporterad');

          return (
            <TouchableOpacity
              key={datum}
              style={styles.cell}
              onPress={() => onVäljDag(datum)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.dagRuta,
                ärIdag && styles.dagRutaIdag,
                ärVald && styles.dagRutaVald,
              ]}>
                <Text style={[
                  styles.dagText,
                  ärVald && styles.dagTextVald,
                  pass.length === 0 && styles.dagTextTom,
                ]}>
                  {dag}
                </Text>
                {pass.length > 0 && (
                  <View style={[
                    styles.prick,
                    alltGenomfört && styles.prickGenomförd,
                    ärVald && styles.prickVald,
                  ]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingBottom: 12 },

  rubrikRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  pil: { padding: 4 },
  månadRubrik: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textTransform: 'capitalize' },

  veckodagsRad: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  veckodag: { flexBasis: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' },

  rutnät: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: { flexBasis: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dagRuta: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dagRutaIdag: { borderWidth: 1.5, borderColor: '#2563eb' },
  dagRutaVald: { backgroundColor: '#2563eb' },
  dagText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  dagTextVald: { color: '#fff', fontWeight: '700' },
  dagTextTom: { color: '#9ca3af', fontWeight: '400' },
  prick: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2563eb', marginTop: 2 },
  prickGenomförd: { backgroundColor: '#16a34a' },
  prickVald: { backgroundColor: '#fff' },
});
