import { useRef } from 'react';
import { Pressable, Animated, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FÄRG, RADIE, SKUGGA } from '../utils/tema';
import { haptik } from '../utils/haptik';

// Delad, modern knapp med tryck-animation. Ersätter de hopkopierade primärknapparna som
// låg inline i varje skärm (inloggning, spara, publicera …) och som divergerade i färg,
// radie och storlek. Varianter:
//   primär   – gradient-fylld (blå→indigo), för huvudhandlingen
//   sekundär – mjuk indigo-bakgrund, för sidohandlingar
//   kontur   – transparent med kant, lågmäld
//   fara     – kontur i rött, för destruktiva handlingar (logga ut, radera)
//
// Scale + haptik ger taktil återkoppling. Allt bygger på inbyggda Animated – inget
// reanimated krävs, och haptiken no-op:ar på web/enheter utan vibrationsmotor.
export default function Knapp({
  text, onPress, variant = 'primär', ikon, laddar = false, inaktiverad = false, style, textStyle,
}) {
  const skala = useRef(new Animated.Value(1)).current;
  const av = inaktiverad || laddar;
  const till = (v) => Animated.spring(skala, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  const ärFylld = variant === 'primär';
  const innehållsFärg = ärFylld ? '#fff' : variant === 'fara' ? FÄRG.fel : FÄRG.primär;

  const innehåll = (
    <>
      {laddar ? (
        <ActivityIndicator color={innehållsFärg} />
      ) : (
        <>
          {ikon && <Ionicons name={ikon} size={18} color={innehållsFärg} style={styles.ikon} accessible={false} importantForAccessibility="no" />}
          <Text style={[styles.text, { color: innehållsFärg }, textStyle]}>{text}</Text>
        </>
      )}
    </>
  );

  return (
    <Animated.View style={[styles.yttre, { transform: [{ scale: skala }] }, av && styles.av, style]}>
      <Pressable
        onPress={() => { if (av) return; haptik.lätt(); onPress?.(); }}
        onPressIn={() => !av && till(0.96)}
        onPressOut={() => !av && till(1)}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ disabled: av }}
        style={styles.press}
      >
        {ärFylld ? (
          <LinearGradient
            colors={FÄRG.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.knapp, styles.fylld]}
          >
            {innehåll}
          </LinearGradient>
        ) : (
          <Animated.View style={[styles.knapp, variantStil[variant]]}>{innehåll}</Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  yttre: { alignSelf: 'stretch', borderRadius: RADIE.sm },
  av: { opacity: 0.5 },
  press: { width: '100%', borderRadius: RADIE.sm },
  knapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIE.sm,
    paddingVertical: 15,
    paddingHorizontal: 18,
    minHeight: 50,
  },
  fylld: { ...SKUGGA.lyft, shadowColor: FÄRG.primärDjup },
  ikon: { marginRight: 8 },
  text: { fontWeight: '700', fontSize: 15 },
});

const variantStil = StyleSheet.create({
  primär: {},
  sekundär: { backgroundColor: FÄRG.primärMjuk },
  kontur: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: FÄRG.kant },
  fara: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: FÄRG.fel },
});
