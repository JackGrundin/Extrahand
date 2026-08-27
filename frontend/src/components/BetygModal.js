import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import StjärnVal from './StjärnVal';

// Popupen som kommer upp när ett pass är avslutat och tidrapporten godkänd.
//
// Visas för BÅDA parter: företaget betygsätter personen, personen betygsätter uppdraget.
// "Hoppa över" är ett riktigt val och sparas – se BetygsContext – annars hade prompten
// tjatat om samma pass varje gång appen öppnades.
export default function BetygModal({ visible, post, ärFöretag, laddar, onSkicka, onHoppaÖver }) {
  const [stjarnor, setStjarnor] = useState(0);
  const [kommentar, setKommentar] = useState('');

  // Nollställ mellan poster – annars följer stjärnorna från förra passet med in i nästa.
  useEffect(() => {
    if (visible) { setStjarnor(0); setKommentar(''); }
  }, [visible, post?.ansokanId]);

  if (!post) return null;

  const rubrik = ärFöretag
    ? `Hur gick det med ${post.motpartNamn ?? 'personen'}?`
    : `Hur var uppdraget hos ${post.motpartNamn ?? 'företaget'}?`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onHoppaÖver}>
      <View style={styles.bakgrund}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.ark}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.rubrik}>{rubrik}</Text>
              {post.jobbTitel ? <Text style={styles.underrubrik}>{post.jobbTitel}</Text> : null}

              <StjärnVal värde={stjarnor} onÄndra={setStjarnor} />

              <TextInput
                style={styles.textArea}
                placeholder="Kommentar (valfritt)"
                value={kommentar}
                onChangeText={setKommentar}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.knapp, (stjarnor === 0 || laddar) && styles.knappInaktiv]}
                onPress={() => onSkicka({ stjarnor, kommentar: kommentar.trim() || undefined })}
                disabled={stjarnor === 0 || laddar}
                activeOpacity={0.85}
              >
                {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Skicka betyg</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={onHoppaÖver} disabled={laddar} style={styles.hoppaÖver} hitSlop={8}>
                <Text style={styles.hoppaÖverText}>Hoppa över</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  ark: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 34, maxHeight: '85%' },
  rubrik: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
  underrubrik: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, height: 90, backgroundColor: '#fafafa', marginTop: 12, marginBottom: 20 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  knappInaktiv: { backgroundColor: '#93c5fd' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hoppaÖver: { alignItems: 'center', marginTop: 14 },
  hoppaÖverText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
});
