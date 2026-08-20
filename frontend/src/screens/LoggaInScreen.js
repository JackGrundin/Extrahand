import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/klient';

export default function LoggaInScreen({ navigation }) {
  const { loggaIn } = useAuth();
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [ejVerifierad, setEjVerifierad] = useState(false);
  const [skickarMail, setSkickarMail] = useState(false);

  async function hanteraInloggning() {
    if (!email || !lösenord) {
      Alert.alert('Fel', 'Fyll i email och lösenord');
      return;
    }
    setEjVerifierad(false);
    setLaddar(true);
    try {
      await loggaIn(email, lösenord);
    } catch (fel) {
      if (fel.kod === 'EMAIL_EJ_VERIFIERAD') {
        setEjVerifierad(true);
      } else {
        Alert.alert('Fel', fel.message);
      }
    } finally {
      setLaddar(false);
    }
  }

  async function skickaVerifieringsmail() {
    setSkickarMail(true);
    try {
      await api.skickaVerifieringsmail(email);
      Alert.alert('Klart', 'Ett nytt verifieringsmail har skickats till ' + email);
    } catch {
      Alert.alert('Fel', 'Kunde inte skicka verifieringsmail. Försök igen.');
    } finally {
      setSkickarMail(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logotyp.png')}
        style={styles.logga}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.rubrik}>FastGig</Text>
      <Text style={styles.underrubrik}>Logga in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); setEjVerifierad(false); }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Lösenord"
        value={lösenord}
        onChangeText={setLösenord}
        secureTextEntry
      />

      {ejVerifierad && (
        <View style={styles.verifieringsRuta}>
          <Text style={styles.verifieringsText}>
            Verifiera din e-postadress först. Kolla din inkorg.
          </Text>
          <TouchableOpacity
            style={styles.resendKnapp}
            onPress={skickaVerifieringsmail}
            disabled={skickarMail}
          >
            {skickarMail
              ? <ActivityIndicator color="#2563eb" size="small" />
              : <Text style={styles.resendText}>Skicka nytt verifieringsmail</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.glömtKnapp}
        onPress={() => navigation.navigate('GlömtLösenord')}
      >
        <Text style={styles.glömtText}>Glömt lösenord?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.knapp} onPress={hanteraInloggning} disabled={laddar}>
        {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Logga in</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Registrera')}>
        <Text style={styles.länk}>Inget konto? Registrera dig</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  // Mindre än på JS-splashen (96) med flit: skärmen är en vanlig View utan ScrollView,
  // och med tangentbordet uppe på en liten telefon finns knappt plats för innehållet som
  // redan finns. En större logga trycker ut registreringslänken utanför skärmkanten.
  logga: { width: 64, height: 64, alignSelf: 'center', marginBottom: 12 },
  rubrik: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#2563eb' },
  underrubrik: { fontSize: 18, textAlign: 'center', marginBottom: 32, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, color: '#1a1a1a', letterSpacing: 0 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  // Centrerad ovanför inloggningsknappen, med generös tryckyta.
  glömtKnapp: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, marginBottom: 10 },
  glömtText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  länk: { textAlign: 'center', color: '#2563eb', fontSize: 15 },
  verifieringsRuta: { backgroundColor: '#fef9c3', borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a' },
  verifieringsText: { fontSize: 14, color: '#92400e', marginBottom: 10, lineHeight: 20 },
  resendKnapp: { alignSelf: 'flex-start' },
  resendText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
