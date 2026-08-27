import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_ANTAL_KRAV, MAX_LÄNGD_KRAV, normaliseraKrav } from '../utils/behorighet';

// Företagets inmatning av behörighetskrav – fri text, en rad i taget.
//
// Kontrollerat värde med eget formulärstate, precis som ObRedigerare: listan ägs av
// formuläret, textfältet av komponenten. Delas av publicering och redigering för både jobb
// och schema, så reglerna finns på ett ställe.
export default function BehörighetsKravRedigerare({ värde = [], onÄndra }) {
  const [text, setText] = useState('');

  const lista = Array.isArray(värde) ? värde : [];
  const fullt = lista.length >= MAX_ANTAL_KRAV;

  function läggTill() {
    const krav = text.trim();
    if (!krav) return;
    // Dubbletter tyst ignorerade i stället för att felmeddela: samma krav två gånger är
    // ingen felhandling, det är bara inget att göra. normaliseraKrav speglar backend.
    setText('');
    const ny = normaliseraKrav([...lista, krav]);
    if (ny.length !== lista.length) onÄndra(ny);
  }

  return (
    <View>
      {lista.length > 0 && (
        <View style={styles.lista}>
          {lista.map((krav, i) => (
            <View key={`${krav}-${i}`} style={styles.rad}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#b45309" />
              <Text style={styles.kravText}>{krav}</Text>
              <TouchableOpacity onPress={() => onÄndra(lista.filter((_, j) => j !== i))} hitSlop={8}>
                <Ionicons name="close-circle" size={19} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {fullt ? (
        <Text style={styles.hjälp}>Högst {MAX_ANTAL_KRAV} krav.</Text>
      ) : (
        <View style={styles.inmatning}>
          <TextInput
            style={styles.input}
            placeholder="t.ex. Truckkort A"
            value={text}
            onChangeText={setText}
            maxLength={MAX_LÄNGD_KRAV}
            onSubmitEditing={läggTill}
            returnKeyType="done"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.läggTillKnapp, !text.trim() && styles.knappInaktiv]}
            onPress={läggTill}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.läggTillText}>Lägg till</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hjälp}>
        Valfritt. Den som söker måste kryssa i varje krav och intyga att hen uppfyller det.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 8, marginBottom: 10 },
  rad: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  kravText: { flex: 1, fontSize: 14, color: '#78350f', fontWeight: '500' },
  inmatning: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },
  läggTillKnapp: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  läggTillText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hjälp: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
});
