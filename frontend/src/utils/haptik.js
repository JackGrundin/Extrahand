import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Tunn wrapper runt expo-haptics. Två skäl att inte anropa Haptics direkt i skärmarna:
//
//  1. Haptik finns inte på web (run-fastgig-web) och saknar vibrationsmotor på vissa
//     enheter/emulatorer. Vi no-op:ar på web och sväljer alla fel – en taktil bekräftelse
//     får ALDRIG krascha eller blockera ett flöde (godkänna, skicka, publicera).
//  2. Varje anropsställe slipper upprepa Platform-kontrollen och import-typerna.
//
// Anropas synkront utan await: vibrationen ska kännas parallellt med resten av flödet,
// inte fördröja det.
function kör(fn) {
  if (Platform.OS === 'web') return;
  try { fn(); } catch {}
}

export const haptik = {
  // Lyckad, avslutad handling: godkänna, betygsätta, publicera, skicka tidrapport, ansöka.
  lyckat: () => kör(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // Misslyckad handling – paras med Alert:en som ändå visas.
  fel: () => kör(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  // Lätt, subtil knuff för högfrekventa handlingar som att skicka ett chattmeddelande.
  lätt: () => kör(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Val/toggle – t.ex. markera i en lista.
  val: () => kör(() => Haptics.selectionAsync()),
};
