import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, Animated, RefreshControl, StyleSheet } from 'react-native';

// Delad pull-to-refresh med FastGig-loggan i stället för standardspinnern.
//
// Loggan (assets/logotyp.png, 400x288 ≈ 1.389:1) ritas i två lager: ett grått baslager och
// ett färgat lager som avslöjas nerifrån och upp när `fyllnad` går 0 → 1. Fyllnaden görs med
// en Animated.View med overflow:'hidden' vars höjd växer – ingen mask/SVG behövs, så inget
// nytt beroende krävs.
//
// Gest och trigger ägs fortfarande av native RefreshControl (pålitligt på både iOS och
// Android); spinnern görs transparent. På iOS matar `onScroll` overscrollens negativa
// contentOffset.y in i fyllnaden, så loggan fylls i takt med draget och är ~full precis när
// RefreshControl triggar. På Android saknas dragdata – där fylls loggan i stället när
// laddningen startar.

const LOGO = require('../../assets/logotyp.png');
const LOGO_BREDD = 76;
const LOGO_HÖJD = Math.round(LOGO_BREDD / 1.389); // ~55
// Draglängd (px) där loggan når full färg. Tunad nära iOS RefreshControls triggavstånd.
const DRAG_TRÖSKEL = 90;

// Presentationslager – ritar den halvfyllda loggan utifrån en Animated.Value 0..1.
// `topp` är listans y-position i containern, så loggan hamnar precis där den vanliga
// spinnern satt (överst i den skrollbara ytan, under ev. flikar/sökfält) i stället för
// att lägga sig över sidhuvudets knappar.
function LoggaOverlayView({ fyllnad, topp }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          top: topp + 8,
          opacity: fyllnad.interpolate({ inputRange: [0, 0.06, 1], outputRange: [0, 0.7, 1] }),
          transform: [{ scale: fyllnad.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        },
      ]}
    >
      <View style={styles.loggaBox}>
        <Image source={LOGO} style={styles.baslager} resizeMode="contain" />
        <Animated.View
          style={[
            styles.fyllnadslager,
            { height: fyllnad.interpolate({ inputRange: [0, 1], outputRange: [0, LOGO_HÖJD] }) },
          ]}
        >
          <Image source={LOGO} style={styles.fyllnadsBild} resizeMode="contain" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// Hook som kapslar in refresh-staten och animationen. `onRefresh` är skärmens vanliga
// hämta-funktion.
export function useLoggaRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  // Listans y-position i containern (höjden på ev. flikar/sökfält ovanför). Mäts via
  // onListLayout så att loggan hamnar överst i den skrollbara ytan på varje skärm, utan
  // att skärmen behöver skickas något manuellt offset.
  const [listTopp, setListTopp] = useState(0);
  const fyllnad = useRef(new Animated.Value(0)).current;
  const pulsRef = useRef(null);

  const onListLayout = useCallback((e) => {
    setListTopp(e.nativeEvent.layout.y);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (fel) {
      console.error(fel);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Reagera på refreshing: fyll loggan helt och pulsa medan datan laddar, töm när den är klar.
  useEffect(() => {
    // aktiv-flaggan skyddar mot att den initiala 400 ms-timingens completion-callback
    // startar en oändlig loop EFTER att komponenten avmonterats (eller efter att
    // refreshing hunnit bli false igen). Utan den kan en loop leva kvar utan något som
    // stoppar den, eftersom pulsRef ännu är null när cleanup körs mitt under fyllnaden.
    let aktiv = true;
    if (refreshing) {
      Animated.timing(fyllnad, { toValue: 1, duration: 400, useNativeDriver: false }).start(({ finished }) => {
        if (!aktiv || !finished) return;
        pulsRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(fyllnad, { toValue: 0.82, duration: 500, useNativeDriver: false }),
            Animated.timing(fyllnad, { toValue: 1, duration: 500, useNativeDriver: false }),
          ])
        );
        pulsRef.current.start();
      });
    } else {
      pulsRef.current?.stop();
      pulsRef.current = null;
      Animated.timing(fyllnad, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    }
    return () => {
      aktiv = false;
      pulsRef.current?.stop();
      pulsRef.current = null;
      // Avbryt en ev. pågående initial-timing så att inget lever kvar efter unmount.
      fyllnad.stopAnimation();
    };
  }, [refreshing, fyllnad]);

  // iOS: overscroll ger negativ contentOffset.y → mata in i fyllnaden. Under laddning styr
  // pulsen i stället, så vi rör den inte då.
  const onScroll = useCallback((e) => {
    if (refreshing) return;
    const y = e.nativeEvent.contentOffset.y;
    const p = Math.min(1, Math.max(0, -y / DRAG_TRÖSKEL));
    fyllnad.setValue(p);
  }, [refreshing, fyllnad]);

  return {
    refreshing,
    // Sprids på scroll-komponenten: refreshControl (transparent native-spinner) + onScroll.
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor="transparent"
        colors={['transparent']}
        progressBackgroundColor="transparent"
      />
    ),
    onScroll,
    scrollEventThrottle: 16,
    // Läggs på listan (FlatList/SectionList/ScrollView) så loggan kan placeras överst i den.
    onListLayout,
    // Renderas absolut i skärmcontainern, positionerad överst i den skrollbara ytan.
    LoggaOverlay: <LoggaOverlayView fyllnad={fyllnad} topp={listTopp} />,
  };
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  loggaBox: { width: LOGO_BREDD, height: LOGO_HÖJD },
  baslager: { width: LOGO_BREDD, height: LOGO_HÖJD, opacity: 0.18 },
  fyllnadslager: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fyllnadsBild: { width: LOGO_BREDD, height: LOGO_HÖJD, position: 'absolute', bottom: 0 },
});
