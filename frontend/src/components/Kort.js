import { useRef } from 'react';
import { Pressable, Animated, View } from 'react-native';
import { STIL } from '../utils/tema';

// Delad kortyta med mjuk skugga och (när onPress finns) en subtil tryck-animation.
// Tidigare upprepades `styles.kort` med en knappt synlig skugga i varje skärm; nu utgår
// alla kort från STIL.kort så looken är enhetlig. Scale-animationen ger en modern,
// taktil känsla utan att något animationsbibliotek behövs – inbyggda Animated räcker.
export default function Kort({ children, onPress, style, tryckbar = true, ...rest }) {
  const skala = useRef(new Animated.Value(1)).current;

  // Statiskt kort (ingen onPress) renderas som en vanlig View – ingen Pressable-overhead.
  if (!onPress) {
    return <View style={[STIL.kort, style]} {...rest}>{children}</View>;
  }

  const till = (v) => Animated.spring(skala, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: skala }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => tryckbar && till(0.97)}
        onPressOut={() => tryckbar && till(1)}
        style={[STIL.kort, style]}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
