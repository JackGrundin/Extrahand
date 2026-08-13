import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/klient';

// Begär en återställningslänk via mejl. Själva lösenordsbytet sker på webbsidan som
// länken öppnar (backendens /aterstall-losenord) – appen har ingen deep link, och en
// webbsida fungerar även när mejlet läses på en dator.
export default function GlömtLösenordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [skickat, setSkickat] = useState(false);

  async function skickaLänk() {
    const rensad = email.trim();
    if (!rensad) {
      Alert.alert('Fel', 'Fyll i din e-postadress');
      return;
    }

    setLaddar(true);
    try {
      await api.glömtLösenord(rensad);
      // Servern svarar likadant oavsett om adressen finns – annars går endpointen att
      // använda för att ta reda på vilka som har konto hos oss. Kvittensen här måste
      // därför vara formulerad på samma sätt i båda fallen.
      setSkickat(true);
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  if (skickat) {
    return (
      <View style={styles.container}>
        <View style={styles.klarIkon}>
          <Ionicons name="mail-outline" size={36} color="#2563eb" />
        </View>
        <Text style={styles.rubrik}>Kolla din inkorg</Text>
        <Text style={styles.brödtext}>
          Om det finns ett konto kopplat till {email.trim()} har vi skickat en länk för att
          välja ett nytt lösenord. Länken är giltig i en timme.
        </Text>
        <Text style={styles.finstilt}>
          Hittar du inget mail? Kolla skräpposten, eller försök igen med en annan adress.
        </Text>

        <TouchableOpacity style={styles.knapp} onPress={() => navigation.navigate('LoggaIn')}>
          <Text style={styles.knappText}>Tillbaka till inloggning</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setSkickat(false)}>
          <Text style={styles.länk}>Skicka till en annan adress</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.rubrik}>Glömt lösenord?</Text>
      <Text style={styles.brödtext}>
        Skriv in e-postadressen du registrerade dig med, så skickar vi en länk där du kan
        välja ett nytt lösenord.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onSubmitEditing={skickaLänk}
        returnKeyType="send"
      />

      <TouchableOpacity style={styles.knapp} onPress={skickaLänk} disabled={laddar}>
        {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Skicka återställningslänk</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.länk}>Tillbaka till inloggning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  klarIkon: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  rubrik: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#1a1a1a' },
  brödtext: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  finstilt: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 16, color: '#1a1a1a' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16, minHeight: 52, justifyContent: 'center' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  länk: { textAlign: 'center', color: '#2563eb', fontSize: 15 },
});
