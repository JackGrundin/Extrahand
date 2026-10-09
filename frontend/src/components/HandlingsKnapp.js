import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FÄRG, RADIE, SKUGGA } from '../utils/tema';
import { haptik } from '../utils/haptik';

// Delad chatt-/betygsknapp. Tidigare kopierades knappstilen till varje skärm och
// divergerade, vilket gjorde att knapparna blev ocentrerade eller full skärmbredd på
// olika ställen. All styling bor nu här – rätta på ett ställe, rätt överallt.
//
// Centreringen är AVSIKTLIGT förälder-oberoende: yttre View:n stretchar över hela
// förälderns bredd och centrerar sedan själva knappen. Det gör att knappen hamnar rätt
// oavsett om den placeras i en kolumn, en rad, eller en förälder med alignItems: 'center'.
//
// Färger/radie/skugga kommer från tema.js och `fylld` använder gradienten, så den här
// knappen propagerar den moderna looken till alla skärmar som redan använder den.
export default function HandlingsKnapp({ text, onPress, variant = 'lank', ikon, style }) {
  const fylld = variant === 'fylld';
  const skala = useRef(new Animated.Value(1)).current;
  const till = (v) => Animated.spring(skala, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  const innehåll = (
    <>
      {/* Ikonen är dekorativ – knappens text läses redan upp via labeln. */}
      {ikon && (
        <Ionicons name={ikon} size={18} color={fylld ? '#fff' : FÄRG.primär} style={styles.ikon} accessible={false} importantForAccessibility="no" />
      )}
      <Text style={[styles.text, fylld ? styles.textFylld : styles.textLank]}>{text}</Text>
    </>
  );

  return (
    <View style={[styles.yttre, style]}>
      <Animated.View style={{ transform: [{ scale: skala }], width: '100%', maxWidth: MAXBREDD }}>
        <Pressable
          onPress={() => { haptik.lätt(); onPress?.(); }}
          onPressIn={() => till(0.96)}
          onPressOut={() => till(1)}
          accessibilityRole="button"
          accessibilityLabel={text}
          style={styles.press}
        >
          {fylld ? (
            <LinearGradient colors={FÄRG.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.knapp, styles.fylld]}>
              {innehåll}
            </LinearGradient>
          ) : (
            <View style={[styles.knapp, styles.lank]}>{innehåll}</View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const MAXBREDD = 400;

const styles = StyleSheet.create({
  // Stretchar över förälderns bredd och centrerar knappen. alignSelf: 'stretch' vinner
  // även över en förälder med alignItems: 'center', så centreringen är alltid konsekvent.
  yttre: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  press: { width: '100%', borderRadius: RADIE.sm },
  knapp: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIE.sm,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  lank: { backgroundColor: FÄRG.primärMjuk },
  fylld: { ...SKUGGA.lyft, shadowColor: FÄRG.primärDjup },
  ikon: { marginRight: 8 },
  text: { fontWeight: '700' },
  textLank: { color: FÄRG.primär, fontSize: 14 },
  textFylld: { color: '#fff', fontSize: 15 },
});
