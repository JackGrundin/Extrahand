import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegistreraScreen({ navigation }) {
  const { registrera } = useAuth();
  const [namn, setNamn] = useState('');
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [typ, setTyp] = useState('privatperson');
  const [telefonnummer, setTelefonnummer] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [bransch, setBransch] = useState('');
  const [stad, setStad] = useState('');
  const [hemsida, setHemsida] = useState('');
  const [organisationsnummer, setOrganisationsnummer] = useState('');
  const [fakturaadress, setFakturaadress] = useState('');
  const [postnummer, setPostnummer] = useState('');
  const [ort, setOrt] = useState('');
  const [fakturamail, setFakturamail] = useState('');
  const [referensperson, setReferensperson] = useState('');
  const [laddar, setLaddar] = useState(false);

  async function hanteraRegistrering() {
    if (!namn || !email || !lösenord) {
      Alert.alert('Fel', 'Fyll i namn, email och lösenord');
      return;
    }
    if (!telefonnummer.trim()) {
      Alert.alert('Fel', 'Telefonnummer krävs');
      return;
    }
    if (typ === 'företag') {
      if (!organisationsnummer.trim() || !fakturaadress.trim() || !postnummer.trim() || !ort.trim() || !fakturamail.trim() || !referensperson.trim()) {
        Alert.alert('Fel', 'Alla fält för företag är obligatoriska');
        return;
      }
      if (!/^\d{6}-\d{4}$/.test(organisationsnummer.trim())) {
        Alert.alert('Fel', 'Organisationsnummer måste ha format XXXXXX-XXXX');
        return;
      }
    }
    setLaddar(true);
    try {
      const företagsInfo = typ === 'företag'
        ? {
            beskrivning: beskrivning.trim() || null,
            bransch: bransch.trim() || null,
            stad: stad.trim() || null,
            hemsida: hemsida.trim() || null,
            organisationsnummer: organisationsnummer.trim(),
            fakturaadress: fakturaadress.trim(),
            postnummer: postnummer.trim(),
            ort: ort.trim(),
            fakturamail: fakturamail.trim(),
            referensperson: referensperson.trim(),
          }
        : {};
      await registrera(namn, email, lösenord, typ, { ...företagsInfo, telefonnummer: telefonnummer.trim() || null });
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.innehåll} keyboardShouldPersistTaps="handled">
        <Text style={styles.rubrik}>Skapa konto</Text>

        {typ === 'privatperson' && (
          <TextInput style={styles.input} placeholder="Namn" value={namn} onChangeText={setNamn} />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
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

        {typ === 'privatperson' && (
          <TextInput
            style={styles.input}
            placeholder="Telefonnummer *"
            value={telefonnummer}
            onChangeText={setTelefonnummer}
            keyboardType="phone-pad"
          />
        )}

        <Text style={styles.label}>Kontotyp</Text>
        <View style={styles.typVäljare}>
          {['privatperson', 'företag'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typKnapp, typ === t && styles.typKnappAktiv]}
              onPress={() => setTyp(t)}
            >
              <Text style={[styles.typText, typ === t && styles.typTextAktiv]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {typ === 'företag' && (
          <>
            <Text style={styles.sektionsRubrik}>Företagsuppgifter *</Text>
            <TextInput
              style={styles.input}
              placeholder="Företagsnamn *"
              value={namn}
              onChangeText={setNamn}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefonnummer *"
              value={telefonnummer}
              onChangeText={setTelefonnummer}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Organisationsnummer (XXXXXX-XXXX) *"
              value={organisationsnummer}
              onChangeText={setOrganisationsnummer}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Fakturaadress (gatuadress) *"
              value={fakturaadress}
              onChangeText={setFakturaadress}
            />
            <View style={styles.rad}>
              <TextInput
                style={[styles.input, styles.radFältLitet]}
                placeholder="Postnummer *"
                value={postnummer}
                onChangeText={setPostnummer}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.radFältStort]}
                placeholder="Ort *"
                value={ort}
                onChangeText={setOrt}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Fakturamail *"
              value={fakturamail}
              onChangeText={setFakturamail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Referensperson (kontaktperson) *"
              value={referensperson}
              onChangeText={setReferensperson}
            />
            <Text style={styles.sektionsRubrik}>Om företaget</Text>
            <TextInput
              style={styles.input}
              placeholder="Bransch (t.ex. Restaurang, Bygg)"
              value={bransch}
              onChangeText={setBransch}
            />
            <TextInput
              style={styles.input}
              placeholder="Stad"
              value={stad}
              onChangeText={setStad}
            />
            <TextInput
              style={styles.input}
              placeholder="Hemsida (t.ex. www.foretaget.se)"
              value={hemsida}
              onChangeText={setHemsida}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Berätta om företaget..."
              value={beskrivning}
              onChangeText={setBeskrivning}
              multiline
              textAlignVertical="top"
            />
          </>
        )}

        <TouchableOpacity style={styles.knapp} onPress={hanteraRegistrering} disabled={laddar}>
          {laddar ? <ActivityIndicator color="#fff" /> : <Text style={styles.knappText}>Skapa konto</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.länk}>Har du redan ett konto? Logga in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  innehåll: { padding: 24, paddingBottom: 48 },
  rubrik: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 28, color: '#1a1a1a' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#fafafa' },
  textArea: { height: 110, textAlignVertical: 'top' },
  rad: { flexDirection: 'row', gap: 10 },
  radFältLitet: { flex: 2 },
  radFältStort: { flex: 3 },
  label: { fontSize: 15, color: '#444', marginBottom: 8 },
  sektionsRubrik: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 10, marginTop: 4 },
  typVäljare: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typKnapp: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typKnappAktiv: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typText: { color: '#444', fontWeight: '500' },
  typTextAktiv: { color: '#fff' },
  knapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16, marginTop: 8 },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  länk: { textAlign: 'center', color: '#2563eb', fontSize: 15 },
});
