import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { FÄRG, RADIE, SKUGGA } from '../utils/tema';

// Skeleton-laddning: grå platshållarkort som antyder innehållet som är på väg, i stället
// för en tom snurra mitt på skärmen. Renderas medan listdatan hämtas första gången.
//
// En enda delad Animated-värde driver pulsen för HELA listan (0.4↔1 opacity). Att ge varje
// block en egen loop vore dussintals timers; en delad loop räcker eftersom alla block pulsar
// i takt. Loopen stoppas i cleanup (samma disciplin som LoggaRefresh) så inget snurrar kvar
// efter att datan kommit och skeleton avmonterats. useNativeDriver: opacity går på UI-tråden.

// En grå bit. Storlek/rundning styrs av anroparen via style.
function Skelett({ opacity, style }) {
  return <Animated.View style={[styles.skelett, style, { opacity }]} />;
}

// Ett kort som grovt speglar list-kortens layout: titelrad, två korta rader och en bricka.
function SkeletonKort({ opacity }) {
  return (
    <View style={styles.kort}>
      <Skelett opacity={opacity} style={styles.titel} />
      <Skelett opacity={opacity} style={styles.rad} />
      <Skelett opacity={opacity} style={styles.radKort} />
      <Skelett opacity={opacity} style={styles.bricka} />
    </View>
  );
}

// N platshållarkort. `style` skickas till ytterbehållaren så listytan kan matcha den
// riktiga listans contentContainerStyle (t.ex. styles.lista).
export default function SkeletonLista({ antal = 6, style }) {
  const puls = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(puls, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(puls, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [puls]);

  return (
    <View style={style} accessibilityLabel="Laddar" accessibilityRole="progressbar">
      {Array.from({ length: antal }, (_, i) => (
        <SkeletonKort key={i} opacity={puls} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skelett: { backgroundColor: FÄRG.ytaDämpad, borderRadius: 6 },
  kort: {
    backgroundColor: FÄRG.yta,
    borderRadius: RADIE.md,
    padding: 16,
    marginBottom: 12,
    ...SKUGGA.mjuk,
  },
  titel: { height: 18, width: '65%', marginBottom: 14 },
  rad: { height: 12, width: '90%', marginBottom: 8 },
  radKort: { height: 12, width: '45%', marginBottom: 14 },
  bricka: { height: 22, width: 90, borderRadius: 8 },
});
