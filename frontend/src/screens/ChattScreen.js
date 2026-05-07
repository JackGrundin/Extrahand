import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/klient';
import { useAuth } from '../context/AuthContext';

export default function ChattScreen({ route }) {
  const { ansokningId } = route.params;
  const { användare } = useAuth();
  const [meddelanden, setMeddelanden] = useState([]);
  const [text, setText] = useState('');
  const [laddar, setLaddar] = useState(true);
  const [skickar, setSkickar] = useState(false);
  const listRef = useRef(null);

  async function hämta() {
    try {
      const data = await api.hämtaMeddelanden(ansokningId);
      setMeddelanden(data);
    } catch (fel) {
      console.error(fel);
    } finally {
      setLaddar(false);
    }
  }

  useFocusEffect(useCallback(() => { hämta(); }, []));

  async function skicka() {
    if (!text.trim() || skickar) return;
    setSkickar(true);
    try {
      const nytt = await api.skicka(ansokningId, { innehall: text.trim() });
      setMeddelanden((prev) => [...prev, nytt]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (fel) {
      console.error(fel);
    } finally {
      setSkickar(false);
    }
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={meddelanden}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.meddelandeLista}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.tom}>Inga meddelanden ännu. Säg hej!</Text>}
        renderItem={({ item }) => {
          const ärMitt = item.avsandare_id === användare?.id;
          return (
            <View style={[styles.bubbla, ärMitt ? styles.mittBubbla : styles.deras]}>
              <Text style={[styles.bubblaText, ärMitt && styles.mittText]}>{item.innehall}</Text>
              <Text style={[styles.tid, ärMitt && styles.mittTid]}>
                {new Date(item.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inmatning}>
        <TextInput
          style={styles.input}
          placeholder="Skriv ett meddelande..."
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={[styles.skickaKnapp, !text.trim() && styles.inaktiv]} onPress={skicka} disabled={!text.trim() || skickar}>
          <Text style={styles.skickaText}>Skicka</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  meddelandeLista: { padding: 16, gap: 8 },
  bubbla: { maxWidth: '75%', padding: 12, borderRadius: 16, backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  mittBubbla: { alignSelf: 'flex-end', backgroundColor: '#2563eb', borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  deras: {},
  bubblaText: { fontSize: 15, color: '#1a1a1a', lineHeight: 21 },
  mittText: { color: '#fff' },
  tid: { fontSize: 11, color: '#aaa', marginTop: 4 },
  mittTid: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  tom: { textAlign: 'center', color: '#999', marginTop: 40 },
  inmatning: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, maxHeight: 100 },
  skickaKnapp: { backgroundColor: '#2563eb', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  inaktiv: { backgroundColor: '#c7d2fe' },
  skickaText: { color: '#fff', fontWeight: '600' },
});
