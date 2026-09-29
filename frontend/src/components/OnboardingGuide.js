import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HittaJobbBild, AnsökBild, ChattaBild, BetygBild } from './onboarding/illustrationer';
import { haptik } from '../utils/haptik';

// Korten som visas i onboarding-guiden. Illustrationen är en komponent (SVG) så den skalar
// skarpt. Texten är job-seeker-inriktad – guiden visas bara för privatpersoner (se
// OnboardingGate), eftersom flödet hitta → ansök → chatta → betyg beskriver deras resa.
const KORT = [
  {
    Bild: HittaJobbBild,
    rubrik: 'Hitta jobb nära dig',
    text: 'Bläddra bland enstaka pass och längre uppdrag. Filtrera på stad, lön och kategori för att hitta rätt.',
  },
  {
    Bild: AnsökBild,
    rubrik: 'Ansök med ett tryck',
    text: 'Skicka din ansökan direkt från annonsen och intyga att du uppfyller kraven.',
  },
  {
    Bild: ChattaBild,
    rubrik: 'Chatta med företaget',
    text: 'Kom överens om detaljerna direkt i appen – både före och under passet.',
  },
  {
    Bild: BetygBild,
    rubrik: 'Få betyg och bygg rykte',
    text: 'Efter avslutat pass betygsätter ni varandra. Bra omdömen ger fler jobb.',
  },
];

// Helskärmsguide som ScrollView med sidväxling. onKlar anropas när användaren trycker
// "Kom igång" på sista kortet eller "Hoppa över" – OnboardingGate sparar då flaggan i
// AsyncStorage och avmonterar guiden.
export default function OnboardingGuide({ onKlar }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const sista = index === KORT.length - 1;

  // Synkar index när användaren SVEPER manuellt. Notera: på webben (och ibland nativt)
  // fyras detta INTE för en programmatisk scrollTo, så knappen nedan får aldrig lita på
  // att den här callbacken uppdaterar index – den styr index själv.
  function vidScroll(e) {
    const nytt = Math.round(e.nativeEvent.contentOffset.x / width);
    if (nytt !== index) setIndex(nytt);
  }

  function nästa() {
    if (sista) {
      haptik.lyckat();
      onKlar();
      return;
    }
    // index är sanningskällan: räkna upp det explicit och scrolla dit. Att härleda målet
    // ur scroll-events låste tidigare pagern på kort 2 när onMomentumScrollEnd uteblev.
    const näst = index + 1;
    setIndex(näst);
    scrollRef.current?.scrollTo({ x: width * näst, animated: true });
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onKlar}>
      <View style={[styles.behållare, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.toppRad}>
          {!sista ? (
            <TouchableOpacity onPress={onKlar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Hoppa över introduktionen">
              <Text style={styles.hoppaÖver}>Hoppa över</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={vidScroll}
          scrollEventThrottle={16}
        >
          {KORT.map(({ Bild, rubrik, text }) => (
            <View key={rubrik} style={[styles.sida, { width }]}>
              <View style={styles.bild}>
                <Bild storlek={Math.min(width * 0.6, 240)} />
              </View>
              <Text style={styles.rubrik}>{rubrik}</Text>
              <Text style={styles.text}>{text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.botten}>
          <View style={styles.prickar}>
            {KORT.map((_, i) => (
              <View key={i} style={[styles.prick, i === index && styles.prickAktiv]} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.knapp}
            onPress={nästa}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={sista ? 'Kom igång' : 'Nästa'}
          >
            <Text style={styles.knappText}>{sista ? 'Kom igång' : 'Nästa'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  behållare: { flex: 1, backgroundColor: '#fff' },
  toppRad: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, height: 44, alignItems: 'center' },
  hoppaÖver: { fontSize: 15, color: '#9ca3af', fontWeight: '600' },

  sida: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  bild: { marginBottom: 40 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  text: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },

  botten: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  prickar: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  prick: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  prickAktiv: { backgroundColor: '#2563eb', width: 24 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  knappText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
