import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normaliseraKrav } from '../utils/behorighet';

export const INTYGANDE_TEXT =
  'Jag intygar att jag uppfyller ovanstående krav och är medveten om att falska uppgifter '
  + 'kan leda till omedelbar avslutning av uppdraget.';

// Behörighetskraven som de visas för den som läser annonsen.
//
// Två lägen i en komponent, med flit: kravlistan ska se likadan ut oavsett om man tittar
// eller kryssar, och den renderas på fyra ställen (jobbdetalj, schemadetalj,
// bekräftelsemodalen i Mina ansökningar och företagets sökandekort).
//
// läge="visning" – ren punktlista.
// läge="intyga"  – kryssrutor plus intygandetexten.
//
// Komponenten äger inte urvalet. ikryssade/onÄndra kommer utifrån, så skärmen kan låsa sin
// ansökningsknapp mot samma sanning som kryssrutorna visar.
export default function BehörighetsKrav({
  krav,
  läge = 'visning',
  ikryssade,
  onÄndra,
  rubrik = 'Behörighetskrav',
  style,
}) {
  const lista = normaliseraKrav(krav);
  if (!lista.length) return null;

  const valda = ikryssade instanceof Set ? ikryssade : new Set(ikryssade ?? []);
  const ärIntygande = läge === 'intyga';

  function toggla(k) {
    const ny = new Set(valda);
    if (ny.has(k)) ny.delete(k); else ny.add(k);
    onÄndra?.(ny);
  }

  return (
    <View style={[styles.kort, style]}>
      <View style={styles.rubrikRad}>
        <Ionicons name="shield-checkmark" size={16} color="#b45309" />
        <Text style={styles.rubrik}>{rubrik}</Text>
      </View>
      <Text style={styles.ingress}>
        {ärIntygande ? 'Kryssa i varje krav du uppfyller:' : 'Det här uppdraget kräver:'}
      </Text>

      {lista.map(k => (
        ärIntygande ? (
          <TouchableOpacity key={k} style={styles.rad} onPress={() => toggla(k)} activeOpacity={0.7}>
            <View style={[styles.kryssRuta, valda.has(k) && styles.kryssRutaAktiv]}>
              {valda.has(k) && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.kravText}>{k}</Text>
          </TouchableOpacity>
        ) : (
          <View key={k} style={styles.rad}>
            <Text style={styles.punkt}>•</Text>
            <Text style={styles.kravText}>{k}</Text>
          </View>
        )
      ))}

      {ärIntygande && <Text style={styles.intygande}>{INTYGANDE_TEXT}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  kort: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 14, marginTop: 16 },
  rubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rubrik: { fontSize: 15, fontWeight: '700', color: '#78350f' },
  ingress: { fontSize: 13, color: '#92400e', marginTop: 4, marginBottom: 10 },
  rad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  punkt: { fontSize: 15, color: '#b45309', width: 20, textAlign: 'center' },
  kryssRuta: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#b45309', justifyContent: 'center', alignItems: 'center' },
  kryssRutaAktiv: { backgroundColor: '#b45309' },
  kravText: { flex: 1, fontSize: 14, color: '#78350f', fontWeight: '500' },
  intygande: { fontSize: 12, color: '#92400e', lineHeight: 17, marginTop: 12, borderTopWidth: 1, borderTopColor: '#fde68a', paddingTop: 12 },
});
