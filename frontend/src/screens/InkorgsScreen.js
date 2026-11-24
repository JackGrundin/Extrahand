import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';
import { useRealtidsPing } from '../context/RealtidsContext';
import { useInkorg } from '../context/InkorgsContext';
import { useLoggaRefresh } from '../components/LoggaRefresh';
import SkeletonLista from '../components/SkeletonKort';
import TomtTillstånd from '../components/TomtTillstånd';
import { FÄRG } from '../utils/tema';

// Ionicons-ikon per posttyp. Färgen sätts separat.
const IKON_PER_TYP = {
  tidrapport: 'time-outline',
  bestridande: 'alert-circle-outline',
  ansokningar: 'person-outline',
  betyg: 'star-outline',
  avtal: 'document-text-outline',
  godkänd_ansökan: 'checkmark-circle-outline',
  schema_inbjudan: 'calendar-outline',
  jobb_inbjudan: 'mail-outline',
};

// Inkorgen (åtgärdslista) i appen – samma härledda underlag som webbens /inkorg. Posterna
// försvinner automatiskt när åtgärden är utförd. Varje rad navigerar till rätt skärm utifrån
// posttyp och medskickade id:n.
export default function InkorgsScreen({ navigation }) {
  const [poster, setPoster] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const { uppdateraInkorg } = useInkorg();

  async function hämta() {
    try {
      const svar = await api.hämtaInkorg();
      setPoster(Array.isArray(svar?.poster) ? svar.poster : []);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  const refresh = useLoggaRefresh(hämta);

  // Hämta om vid fokus och räkna om flikbadgen (count nollas av sig själv när listan tömts).
  useFocusEffect(useCallback(() => { hämta(); uppdateraInkorg(); }, [uppdateraInkorg]));

  // Realtid: en ny ansökan/tidrapport/betyg kan skapa eller lösa en åtgärd.
  useRealtidsPing(() => { hämta(); });

  // Öppnar rätt skärm för en post. Målet skiljer sig per posttyp.
  async function öppna(post) {
    switch (post.typ) {
      case 'tidrapport':
      case 'bestridande':
      case 'betyg':
      case 'godkänd_ansökan':
        if (post.ansokanId != null) navigation.navigate('Chatt', { ansokningId: post.ansokanId });
        break;
      case 'ansokningar':
        if (post.schemaId != null) navigation.navigate('SchemaDetalj', { schemaId: post.schemaId });
        else if (post.jobbId != null) navigation.navigate('JobbAnsokningar', { jobbId: post.jobbId, titel: post.titel });
        break;
      case 'schema_inbjudan':
        if (post.schemaId != null) navigation.navigate('SchemaDetalj', { schemaId: post.schemaId });
        break;
      case 'jobb_inbjudan':
        // JobbDetalj tar ett helt jobb-objekt (inte id) – hämta det först, samma mönster som
        // push-hanteraren i navigation/index.js.
        if (post.jobbId != null) {
          try {
            const jobb = await api.hämtaJobbId(post.jobbId);
            navigation.navigate('JobbDetalj', { jobb });
          } catch (fel) {
            console.error(fel);
          }
        }
        break;
      case 'avtal':
        navigation.getParent()?.navigate('Profil');
        break;
      default:
        break;
    }
  }

  if (laddar) return <SkeletonLista style={styles.lista} />;

  return (
    <>
      {refresh.LoggaOverlay}
      <FlatList
        style={styles.lista}
        data={poster}
        keyExtractor={(item, i) => `${item.typ}-${item.ansokanId ?? item.jobbId ?? item.schemaId ?? i}`}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        refreshControl={refresh.refreshControl}
        onScroll={refresh.onScroll}
        scrollEventThrottle={refresh.scrollEventThrottle}
        onLayout={refresh.onListLayout}
        ListEmptyComponent={
          <TomtTillstånd
            ikon="mail-outline"
            rubrik="Inget att göra just nu 🎉"
            text="Nya åtgärder dyker upp här när något behöver din uppmärksamhet."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.kort} onPress={() => öppna(item)} activeOpacity={0.8}>
            <View style={styles.ikonCirkel}>
              <Ionicons name={IKON_PER_TYP[item.typ] ?? 'ellipse-outline'} size={20} color={FÄRG.primär} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.titel} numberOfLines={1}>{item.titel}</Text>
              <Text style={styles.undertext} numberOfLines={1}>{item.undertext}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={FÄRG.textSvag} />
          </TouchableOpacity>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  kort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ikonCirkel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FÄRG.primärMjuk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titel: { fontSize: 15, fontWeight: '700', color: FÄRG.text },
  undertext: { fontSize: 13, color: FÄRG.textSvag, marginTop: 2 },
});
