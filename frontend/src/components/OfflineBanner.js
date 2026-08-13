import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnslutning } from '../context/AnslutningsContext';

// Ligger överst i appen så länge servern inte går att nå. Enskilda skärmar visar
// dessutom felmeddelandet från anropet i sin vanliga Alert – bannern är det som
// förklarar VARFÖR ingenting laddar, även när användaren inte tryckt på något.
export default function OfflineBanner() {
  const { uppkopplad } = useAnslutning();
  const insets = useSafeAreaInsets();

  if (uppkopplad) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 10 }]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>
        Ingen internetanslutning – kontrollera din anslutning och försök igen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#dc2626',
  },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
