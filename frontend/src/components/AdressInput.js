import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';

// Adressfält med sökförslag från /api/adress/sok (Nominatim via backend-proxy).
//
// Samma propform som StadInput, så de två kan stå intill varandra i formulären utan att
// anropsstället behöver se att den ena är lokal och den andra går över nätet.
//
// TILL SKILLNAD FRÅN StadInput tvingas inget val: en nybyggd adress, ett portnummer eller
// "Norra grinden vid lastkajen" måste gå att skriva. Förslagen förebygger stavfel för de
// allra flesta, men ett hårt krav skulle blockera publicering när tjänsten inte känner till
// arbetsplatsen.
//
// Staden fylls medvetet INTE i automatiskt när man väljer ett förslag. plats måste finnas i
// SVENSKA_ORTER för att ärGiltigStad ska godkänna den, och Nominatims ortnamn följer inte
// den listan – ett automatiskt "Åre kommun" hade gjort formuläret osparbart. Staden styr
// sökningen, inte tvärtom.
const DEBOUNCE_MS = 400;
const MIN_TECKEN = 3;

export default function AdressInput({
  värde,
  onÄndra,
  stad,
  placeholder = 't.ex. Storgatan 12',
  inputStyle,
  containerStyle,
  fel = false,
  absolutLista = false,
}) {
  const [förslag, setFörslag] = useState([]);
  const [öppen, setÖppen] = useState(false);
  const [laddar, setLaddar] = useState(false);

  // Räknare i stället för att jämföra söksträngar: bara det senaste anropet får skriva
  // förslagen. Utan detta kan ett långsamt svar på "Stor" landa efter ett snabbare på
  // "Storgatan 12" och skriva över det.
  const senasteAnrop = useRef(0);
  // Sätts när användaren valt ett förslag, så att det efterföljande onÄndra inte startar
  // en ny sökning på texten vi just fyllde i.
  const hoppaÖverNästa = useRef(false);

  useEffect(() => {
    const text = (värde ?? '').trim();

    if (hoppaÖverNästa.current) {
      hoppaÖverNästa.current = false;
      return;
    }
    if (text.length < MIN_TECKEN) {
      setFörslag([]);
      setÖppen(false);
      setLaddar(false);
      return;
    }

    // Debounce: Nominatim tillåter ungefär en förfrågan per sekund, så ett anrop per
    // tangenttryckning bryter mot villkoren.
    const id = senasteAnrop.current + 1;
    senasteAnrop.current = id;
    setLaddar(true);

    const timer = setTimeout(async () => {
      try {
        const träffar = await api.sökAdress(text, stad);
        if (senasteAnrop.current !== id) return;
        setFörslag(träffar ?? []);
        setÖppen((träffar ?? []).length > 0);
      } catch {
        // Nätverksfel ska inte synas: fältet fungerar som vanlig fri text utan förslag.
        if (senasteAnrop.current !== id) return;
        setFörslag([]);
        setÖppen(false);
      } finally {
        if (senasteAnrop.current === id) setLaddar(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [värde, stad]);

  function välj(f) {
    hoppaÖverNästa.current = true;
    onÄndra(f.etikett);
    setFörslag([]);
    setÖppen(false);
  }

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View>
        <TextInput
          style={[styles.input, fel && styles.inputFel, inputStyle]}
          placeholder={placeholder}
          value={värde}
          onChangeText={onÄndra}
          autoCorrect={false}
        />
        {laddar && <ActivityIndicator size="small" color="#2563eb" style={styles.spinner} />}
      </View>

      {öppen && förslag.length > 0 && (
        <View style={[styles.dropdown, absolutLista && styles.dropdownAbsolut]}>
          <View style={styles.dropdownHeader}>
            <Ionicons name="navigate" size={13} color="#2563eb" style={{ marginRight: 6 }} />
            <Text style={styles.dropdownHeaderText}>Välj adress eller skriv fritt</Text>
          </View>
          {förslag.map((f, i) => (
            <TouchableOpacity
              key={`${f.etikett}-${i}`}
              style={[styles.rad, i === förslag.length - 1 && styles.radSista]}
              onPress={() => välj(f)}
              activeOpacity={0.6}
            >
              <Ionicons name="location-outline" size={16} color="#2563eb" style={{ marginRight: 10 }} />
              <Text style={styles.radText} numberOfLines={2}>{f.etikett}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 9 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  inputFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  spinner: { position: 'absolute', right: 14, top: 0, bottom: 0 },
  dropdown: {
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  dropdownAbsolut: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 29 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  dropdownHeaderText: { fontSize: 12, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.4 },
  rad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  radSista: { borderBottomWidth: 0 },
  radText: { flex: 1, fontSize: 15, color: '#1a1a1a' },
});
