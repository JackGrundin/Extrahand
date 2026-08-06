import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { datumTillIso } from '../utils/datumHelper';
import { rollFärg } from '../utils/konstanter';

// Cellen är 38×38 px. Tre 5px-prickar med 3px mellanrum är ~21px och får plats under
// dagsiffran; fler än så blir en "+N".
const MAX_PRICKAR = 3;

// Distinkta roller en given dag, med färg, om alla pass i rollen är genomförda och om
// någon av dem saknar person.
//
// Sorteringen MÅSTE vara densamma som grupperaPerKategori i SchemaKalenderScreen.js:
// namnlösa sist. Tidigare gav `(a.namn ?? '')` motsatt ordning här, så prickarna och
// dagslistan under kalendern radade upp rollerna olika – och med MAX_PRICKAR kunde den
// namnlösa gruppen tränga undan en namngiven roll till "+N".
function rollerFörDag(pass) {
  const grupper = {};
  for (const p of pass) {
    const namn = p.kategori || null;
    (grupper[namn ?? ''] ??= { namn, färg: rollFärg(namn), pass: [] }).pass.push(p);
  }
  return Object.values(grupper)
    .sort((a, b) => {
      if (!a.namn) return 1;
      if (!b.namn) return -1;
      return a.namn.localeCompare(b.namn, 'sv');
    })
    .map(g => ({
      ...g,
      alltGenomfört: g.pass.every(p => p.status === 'rapporterad'),
      saknarPerson: g.pass.some(p => p.personId == null),
    }));
}

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

// Kalendern har två lägen:
//   Läsvy (SchemaKalenderScreen): valtDatum = EN dag, prickar visar bemanningen.
//   Flerval (schemapubliceringen): valdaDatum = Set med alla valda datum, inga prickar.
// Flervalet är additivt – valtDatum-vägen och prickfärgslogiken är orörda, eftersom
// kalenderskärmens förklaringsrad är beroende av dem.
//
// minDatum/maxDatum släcker datum utanför perioden. Läsvyn skickar dem inte och kan därför
// fortsätta visa bakåt i tiden.
export default function MånadsKalender({
  år,
  månad,
  passPerDatum = {},
  valtDatum,
  valdaDatum,
  minDatum,
  maxDatum,
  onVäljDag,
  onBytMånad = () => {},
}) {
  const celler = byggCeller(år, månad);
  const idag = datumTillIso(new Date());
  // Tål att en anropare skickar en array i stället för ett Set – annars smäller .has().
  const valda = valdaDatum == null ? null : (valdaDatum instanceof Set ? valdaDatum : new Set(valdaDatum));

  // Pilarna släcks när hela grannmånaden ligger utanför perioden.
  const förstaIMånaden = `${år}-${String(månad + 1).padStart(2, '0')}-01`;
  const sistaIMånaden = `${år}-${String(månad + 1).padStart(2, '0')}-${String(new Date(år, månad + 1, 0).getDate()).padStart(2, '0')}`;
  const kanBakåt = !minDatum || minDatum < förstaIMånaden;
  const kanFramåt = !maxDatum || maxDatum > sistaIMånaden;

  return (
    <View style={styles.container}>
      <View style={styles.rubrikRad}>
        <TouchableOpacity onPress={() => onBytMånad(-1)} hitSlop={12} style={styles.pil} disabled={!kanBakåt}>
          <Ionicons name="chevron-back" size={22} color={kanBakåt ? '#2563eb' : '#e5e7eb'} />
        </TouchableOpacity>
        <Text style={styles.månadRubrik}>{MÅNADER[månad]} {år}</Text>
        <TouchableOpacity onPress={() => onBytMånad(1)} hitSlop={12} style={styles.pil} disabled={!kanFramåt}>
          <Ionicons name="chevron-forward" size={22} color={kanFramåt ? '#2563eb' : '#e5e7eb'} />
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
          // I flervalsläge avgör Set:et, annars den enskilt valda dagen.
          const ärVald = valda ? valda.has(datum) : datum === valtDatum;
          const släckt = (minDatum && datum < minDatum) || (maxDatum && datum > maxDatum);
          const roller = rollerFörDag(pass);

          return (
            <TouchableOpacity
              key={datum}
              style={styles.cell}
              onPress={() => onVäljDag(datum)}
              activeOpacity={0.7}
              disabled={släckt}
            >
              <View style={[
                styles.dagRuta,
                ärIdag && styles.dagRutaIdag,
                // Ljus fyllning på allt valbart, bara i flervalsläge. Utan den syns det
                // inte att rutnätet går att trycka i – en ovald dag vore enbart en siffra.
                // De släckta datumen utanför perioden får medvetet ingen fyllning, så
                // kontrasten mot dem visar var man kan trycka.
                valda && !släckt && !ärVald && styles.dagRutaValbar,
                ärVald && styles.dagRutaVald,
              ]}>
                <Text style={[
                  styles.dagText,
                  ärVald && styles.dagTextVald,
                  // Blek text betyder olika saker i de två lägena: i läsvyn "ingen
                  // bemanning", i flervalsläge "utanför perioden".
                  !valda && pass.length === 0 && styles.dagTextTom,
                  släckt && styles.dagTextSläckt,
                ]}>
                  {dag}
                </Text>
                {/* Bockraden har fast höjd och renderas för ALLA celler i flervalsläge.
                    dagRuta centrerar sitt innehåll, så om raden bara fanns på valda dagar
                    skulle dagsiffran hoppa uppåt vid varje tryck. */}
                {valda && (
                  <View style={styles.bockRad}>
                    {ärVald && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                )}
                {roller.length > 0 && (
                  <View style={styles.prickRad}>
                    {roller.slice(0, MAX_PRICKAR).map(roll => (
                      <View
                        key={roll.namn ?? 'utan'}
                        style={[
                          styles.prick,
                          // Tre tillstånd, i prioritetsordning: ring = rollen saknar person
                          // (hålet som ska fyllas), nedtonad fylld = allt genomfört, fylld =
                          // bemannad och planerad. Ett genomfört pass är alltid bemannat, så
                          // de två första kan aldrig krocka. Statusen får inte konkurrera med
                          // rollfärgen, därför form och opacitet i stället för egen färg.
                          roll.saknarPerson
                            ? { borderColor: ärVald ? '#fff' : roll.färg, borderWidth: 1.5, backgroundColor: 'transparent' }
                            : { backgroundColor: ärVald ? '#fff' : roll.färg, opacity: roll.alltGenomfört ? 0.4 : 1 },
                        ]}
                      />
                    ))}
                    {roller.length > MAX_PRICKAR && (
                      <Text style={[styles.fler, ärVald && styles.flerVald]}>
                        +{roller.length - MAX_PRICKAR}
                      </Text>
                    )}
                  </View>
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
  dagRutaValbar: { backgroundColor: '#f1f5f9' },
  dagRutaVald: { backgroundColor: '#2563eb' },
  bockRad: { height: 12, justifyContent: 'center' },
  dagText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  dagTextVald: { color: '#fff', fontWeight: '700' },
  dagTextTom: { color: '#9ca3af', fontWeight: '400' },
  dagTextSläckt: { color: '#e5e7eb', fontWeight: '400' },
  prickRad: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  prick: { width: 5, height: 5, borderRadius: 3 },
  fler: { fontSize: 8, color: '#6b7280', fontWeight: '700' },
  flerVald: { color: '#fff' },
});
