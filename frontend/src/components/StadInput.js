import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SVENSKA_ORTER } from '../utils/svenskaOrter';

// Kontrollerar om ett värde är en giltig stad vald från listan
export function ärGiltigStad(värde) {
  return SVENSKA_ORTER.includes((värde ?? '').trim());
}

// Återanvändbart sökfält för städer med autocomplete som tvingar val från listan
export default function StadInput({
  värde,
  onÄndra,
  placeholder = 't.ex. Stockholm',
  inputStyle,
  containerStyle,
  fel = false,
  absolutLista = false,
  autoCapitalize = 'words',
}) {
  const [förslag, setFörslag] = useState([]);
  const [öppen, setÖppen] = useState(false);

  // Filtrerar fram matchande orter när användaren skriver
  function hanteraInput(text) {
    onÄndra(text);
    if (text.trim().length >= 1) {
      const sökterm = text.trim().toLowerCase();
      const träffar = SVENSKA_ORTER
        .filter(o => o.toLowerCase().startsWith(sökterm))
        .slice(0, 8);
      setFörslag(träffar);
      setÖppen(träffar.length > 0);
    } else {
      setFörslag([]);
      setÖppen(false);
    }
  }

  // Användaren väljer en ort från listan
  function välj(ort) {
    onÄndra(ort);
    setFörslag([]);
    setÖppen(false);
  }

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        style={[styles.input, fel && styles.inputFel, inputStyle]}
        placeholder={placeholder}
        value={värde}
        onChangeText={hanteraInput}
        autoCorrect={false}
        autoCapitalize={autoCapitalize}
      />
      {öppen && förslag.length > 0 && (
        <View style={[styles.dropdown, absolutLista && styles.dropdownAbsolut]}>
          <View style={styles.dropdownHeader}>
            <Ionicons name="location" size={13} color="#2563eb" style={{ marginRight: 6 }} />
            <Text style={styles.dropdownHeaderText}>Välj en stad från listan</Text>
          </View>
          {förslag.map((ort, i) => (
            <TouchableOpacity
              key={ort}
              style={[styles.rad, i === förslag.length - 1 && styles.radSista]}
              onPress={() => välj(ort)}
              activeOpacity={0.6}
            >
              <Ionicons name="location-outline" size={16} color="#2563eb" style={{ marginRight: 10 }} />
              <Text style={styles.radText}>{ort}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', letterSpacing: 0 },
  inputFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
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
  dropdownAbsolut: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  dropdownHeaderText: { fontSize: 12, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.4 },
  rad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eef2f7', backgroundColor: '#fff' },
  radSista: { borderBottomWidth: 0 },
  radText: { fontSize: 15, color: '#111827', fontWeight: '500' },
});
