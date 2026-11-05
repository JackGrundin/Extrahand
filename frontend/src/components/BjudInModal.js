import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api, felText } from '../api/klient';
import { haptik } from '../utils/haptik';

// Enhetlig "Bjud in"-modal för både jobb (typ="jobb") och schema (typ="schema"). Två flikar:
//  - "Ny på FastGig": generera en delbar länk (kopieras till urklipp). Personen skapar konto via länken.
//  - "Redan på FastGig": skriv e-post, vi skickar inbjudan direkt (push om konto finns, annars mejl).
// Att generera/skicka gör annonsen privat, därför anropas onÄndrad så att skärmen hämtar om sig.
export default function BjudInModal({ visible, onStäng, typ, id, onÄndrad }) {
  const [flik, setFlik] = useState('ny');

  const [url, setUrl] = useState('');
  const [genererar, setGenererar] = useState(false);
  const [kopierad, setKopierad] = useState(false);

  const [email, setEmail] = useState('');
  const [skickar, setSkickar] = useState(false);
  const [bekräftelse, setBekräftelse] = useState('');

  const [fel, setFel] = useState('');

  const vad = typ === 'schema' ? 'Schemat' : 'Jobbet';

  function generera(epost) {
    return typ === 'schema'
      ? api.genereraSchemaInbjudan(id, epost)
      : api.genereraJobbInbjudan(id, epost);
  }

  function stäng() {
    // Nollställ så nästa öppning börjar rent.
    setFlik('ny');
    setUrl('');
    setKopierad(false);
    setEmail('');
    setBekräftelse('');
    setFel('');
    onStäng?.();
  }

  async function genereraLänk() {
    setFel('');
    setKopierad(false);
    setGenererar(true);
    try {
      const svar = await generera();
      setUrl(svar?.url || '');
      if (svar?.url) {
        await Clipboard.setStringAsync(svar.url);
        setKopierad(true);
        haptik.lyckat();
      }
      onÄndrad?.();
    } catch (f) {
      haptik.fel();
      setFel(felText(f));
    } finally {
      setGenererar(false);
    }
  }

  async function kopiera() {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setKopierad(true);
    haptik.lyckat();
  }

  async function skickaInbjudan() {
    const adress = email.trim();
    if (!adress) return;
    setFel('');
    setBekräftelse('');
    setSkickar(true);
    try {
      const svar = await generera(adress);
      setEmail('');
      setBekräftelse(
        svar?.hadeKonto
          ? 'Inbjudan skickad!'
          : 'Inbjudan skickad – personen har inget konto än, de får ett mejl med länken.'
      );
      haptik.lyckat();
      onÄndrad?.();
    } catch (f) {
      haptik.fel();
      setFel(felText(f));
    } finally {
      setSkickar(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={stäng}>
      <View style={styles.bakgrund}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.ark}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.rubrikRad}>
                <Text style={styles.rubrik}>Bjud in</Text>
                <TouchableOpacity onPress={stäng} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* Flikar */}
              <View style={styles.flikRad}>
                <TouchableOpacity
                  style={[styles.flik, flik === 'ny' && styles.flikAktiv]}
                  onPress={() => { setFlik('ny'); setFel(''); }}
                >
                  <Text style={[styles.flikText, flik === 'ny' && styles.flikTextAktiv]}>Ny på FastGig</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.flik, flik === 'konto' && styles.flikAktiv]}
                  onPress={() => { setFlik('konto'); setFel(''); }}
                >
                  <Text style={[styles.flikText, flik === 'konto' && styles.flikTextAktiv]}>Redan på FastGig</Text>
                </TouchableOpacity>
              </View>

              {fel ? <Text style={styles.fel}>{fel}</Text> : null}

              {flik === 'ny' ? (
                <View>
                  <Text style={styles.text}>
                    Generera en länk och skicka den hur du vill. Personen skapar ett konto via
                    länken. {vad} blir privat och syns inte i den öppna listan.
                  </Text>
                  {url ? (
                    <>
                      <View style={styles.urlRuta}>
                        <Text style={styles.urlText} numberOfLines={2}>{url}</Text>
                      </View>
                      <TouchableOpacity style={styles.knapp} onPress={kopiera}>
                        <Ionicons name="copy-outline" size={18} color="#fff" />
                        <Text style={styles.knappText}>{kopierad ? 'Kopierad!' : 'Kopiera länk'}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.knapp, genererar && { opacity: 0.6 }]}
                      onPress={genereraLänk}
                      disabled={genererar}
                    >
                      <Ionicons name="link-outline" size={18} color="#fff" />
                      <Text style={styles.knappText}>{genererar ? 'Genererar…' : 'Generera länk'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View>
                  <Text style={styles.text}>
                    Skriv in personens e-postadress så skickar vi inbjudan direkt till deras app.
                  </Text>
                  {bekräftelse ? (
                    <Text style={styles.bekräftelse}>{bekräftelse}</Text>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="namn@exempel.se"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[styles.knapp, (skickar || !email.trim()) && { opacity: 0.6 }]}
                        onPress={skickaInbjudan}
                        disabled={skickar || !email.trim()}
                      >
                        <Text style={styles.knappText}>{skickar ? 'Skickar…' : 'Skicka inbjudan'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
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
  rubrikRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  rubrik: { fontSize: 20, fontWeight: '700', color: '#111827' },
  flikRad: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  flik: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  flikAktiv: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  flikText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  flikTextAktiv: { color: '#2563eb' },
  text: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  fel: { fontSize: 14, color: '#dc2626', marginBottom: 12 },
  bekräftelse: { fontSize: 15, color: '#16a34a', fontWeight: '600', lineHeight: 21 },
  urlRuta: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12 },
  urlText: { fontSize: 13, color: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 12 },
  knapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13 },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
