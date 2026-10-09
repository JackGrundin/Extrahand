import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, felText } from '../api/klient';
import Knapp from '../components/Knapp';
import { FÄRG, TEXT, STIL, RADIE } from '../utils/tema';

export default function LoggaInScreen({ navigation }) {
  const { loggaIn } = useAuth();
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [laddar, setLaddar] = useState(false);
  const [ejVerifierad, setEjVerifierad] = useState(false);
  const [skickarMail, setSkickarMail] = useState(false);
  const [fokus, setFokus] = useState(null);

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
        Alert.alert('Fel', felText(fel));
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
      Alert.alert('Kunde inte skicka mejl', 'Vi kunde inte skicka verifieringsmejlet. Kontrollera att e-postadressen stämmer och försök igen om en stund.');
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
        accessibilityLabel="FastGig"
      />
      <Text style={styles.rubrik}>FastGig</Text>
      <Text style={styles.underrubrik}>Logga in</Text>

      <TextInput
        style={[styles.input, fokus === 'email' && STIL.inputFokus]}
        placeholder="Email"
        placeholderTextColor={FÄRG.textSvag}
        value={email}
        onChangeText={(v) => { setEmail(v); setEjVerifierad(false); }}
        onFocus={() => setFokus('email')}
        onBlur={() => setFokus(null)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, fokus === 'losen' && STIL.inputFokus]}
        placeholder="Lösenord"
        placeholderTextColor={FÄRG.textSvag}
        value={lösenord}
        onChangeText={setLösenord}
        onFocus={() => setFokus('losen')}
        onBlur={() => setFokus(null)}
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
              ? <ActivityIndicator color={FÄRG.primär} size="small" />
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

      <Knapp text="Logga in" onPress={hanteraInloggning} laddar={laddar} style={styles.loggaInKnapp} />

      <TouchableOpacity onPress={() => navigation.navigate('Registrera')} style={styles.länkKnapp}>
        <Text style={styles.länk}>Inget konto? Registrera dig</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: FÄRG.bakgrund },
  // Mindre än på JS-splashen (96) med flit: skärmen är en vanlig View utan ScrollView,
  // och med tangentbordet uppe på en liten telefon finns knappt plats för innehållet som
  // redan finns. En större logga trycker ut registreringslänken utanför skärmkanten.
  logga: { width: 64, height: 64, alignSelf: 'center', marginBottom: 12 },
  rubrik: { ...TEXT.rubrikXL, fontSize: 34, textAlign: 'center', marginBottom: 4, color: FÄRG.primär },
  underrubrik: { fontSize: 18, textAlign: 'center', marginBottom: 32, color: FÄRG.textDämpad },
  input: { ...STIL.input, fontSize: 16, marginBottom: 12, letterSpacing: 0 },
  loggaInKnapp: { marginBottom: 16, marginTop: 4 },
  // Centrerad ovanför inloggningsknappen, med generös tryckyta.
  glömtKnapp: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, marginBottom: 10 },
  glömtText: { color: FÄRG.primär, fontSize: 14, fontWeight: '600' },
  länkKnapp: { paddingVertical: 4 },
  länk: { textAlign: 'center', color: FÄRG.primär, fontSize: 15, fontWeight: '600' },
  verifieringsRuta: { backgroundColor: '#fef9c3', borderRadius: RADIE.sm, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a' },
  verifieringsText: { fontSize: 14, color: '#92400e', marginBottom: 10, lineHeight: 20 },
  resendKnapp: { alignSelf: 'flex-start' },
  resendText: { fontSize: 14, color: FÄRG.primär, fontWeight: '600' },
});
