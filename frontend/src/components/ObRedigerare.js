import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TidVäljare from './TidVäljare';
import { beräknaFakturapris, påslagEller40, formateraPris } from '../utils/konstanter';

// Redigerbar lista med OB-tillägg. Utbruten ur AvslutaPassModal, som hade den mest
// kompletta varianten (med kostnadsraden per intervall).
//
// Anropas med hela listan och en onÄndra – komponenten håller bara formulärets eget
// state, aldrig värdet. Det gör den återanvändbar både i publiceringsformuläret och
// per pass i schemat, där flera instanser kan finnas samtidigt.
//
// Visar "er kostnad" bara när timlön finns; utan den går inget belopp att räkna ut.
export default function ObRedigerare({ värde = [], onÄndra, timlön = 0, paslag, rubrik = 'OB-tillägg' }) {
  const [formVisas, setFormVisas] = useState(false);
  const [start, setStart] = useState('');
  const [slut, setSlut] = useState('');
  const [typ, setTyp] = useState('procent');
  const [belopp, setBelopp] = useState('');

  const lista = Array.isArray(värde) ? värde : [];

  function nollställ() {
    setFormVisas(false);
    setStart('');
    setSlut('');
    setBelopp('');
  }

  function läggTill() {
    if (!start.trim() || !slut.trim() || !belopp.trim()) {
      Alert.alert('Fel', 'Fyll i alla OB-fält');
      return;
    }
    const v = parseFloat(belopp);
    if (!v || v <= 0) {
      Alert.alert('Fel', 'Ange ett giltigt OB-värde');
      return;
    }
    if (slut.trim() <= start.trim()) {
      Alert.alert('Fel', 'Sluttiden måste vara efter starttiden');
      return;
    }
    onÄndra([...lista, { start: start.trim(), slut: slut.trim(), typ, värde: v }]);
    nollställ();
  }

  return (
    <View style={styles.sektion}>
      <Text style={styles.rubrik}>{rubrik}</Text>

      {lista.map((ob, i) => {
        const [sh = 0, sm = 0] = String(ob.start).split(':').map(Number);
        const [eh = 0, em = 0] = String(ob.slut).split(':').map(Number);
        const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
        const brutto = ob.typ === 'procent' ? h * timlön * (ob.värde / 100) : h * ob.värde;
        const kostnad = beräknaFakturapris(brutto, påslagEller40(paslag));
        return (
          <View key={i} style={styles.rad}>
            <View style={{ flex: 1 }}>
              <Text style={styles.intervall}>
                {ob.start}–{ob.slut} ({ob.typ === 'procent' ? `${ob.värde}%` : `${ob.värde} kr/h`})
              </Text>
              {timlön > 0 && kostnad > 0 && (
                <Text style={styles.belopp}>+{formateraPris(kostnad)} kr (er kostnad)</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => onÄndra(lista.filter((_, j) => j !== i))} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        );
      })}

      {formVisas ? (
        <View style={styles.form}>
          <View style={styles.formTider}>
            <TidVäljare style={styles.tidFält} placeholder="18:00" value={start} onChange={setStart} />
            <Text style={styles.streck}>–</Text>
            <TidVäljare style={styles.tidFält} placeholder="20:00" value={slut} onChange={setSlut} />
          </View>
          <View style={styles.typRad}>
            {['procent', 'fast'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typKnapp, typ === t && styles.typKnappAktiv]}
                onPress={() => setTyp(t)}
              >
                <Text style={[styles.typText, typ === t && styles.typTextAktiv]}>
                  {t === 'procent' ? '% OB' : 'kr/h'}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.värdeInput}
              placeholder={typ === 'procent' ? 'Procent' : 'kr/h'}
              value={belopp}
              onChangeText={setBelopp}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.formKnappar}>
            <TouchableOpacity style={styles.avbrytKnapp} onPress={nollställ}>
              <Text style={styles.avbrytText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.läggTillKnapp} onPress={läggTill}>
              <Text style={styles.läggTillText}>Lägg till</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addKnapp} onPress={() => setFormVisas(true)} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={16} color="#ea580c" />
          <Text style={styles.addText}>Lägg till OB-intervall</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sektion: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fed7aa' },
  rubrik: { fontSize: 13, fontWeight: '700', color: '#9a3412', marginBottom: 8 },
  rad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  intervall: { fontSize: 14, color: '#7c2d12', fontWeight: '600' },
  belopp: { fontSize: 13, color: '#c2410c', marginTop: 2 },

  form: { backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#fed7aa' },
  formTider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tidFält: { flex: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 8, backgroundColor: '#fff' },
  streck: { fontSize: 15, color: '#9a3412' },
  typRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  typKnapp: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff' },
  typKnappAktiv: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  typText: { fontSize: 13, color: '#9a3412', fontWeight: '600' },
  typTextAktiv: { color: '#fff' },
  värdeInput: { flex: 1, borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff' },
  formKnappar: { flexDirection: 'row', gap: 8 },
  avbrytKnapp: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  avbrytText: { fontSize: 13, color: '#666', fontWeight: '600' },
  läggTillKnapp: { flex: 1, backgroundColor: '#ea580c', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  läggTillText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  addKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { fontSize: 13, color: '#ea580c', fontWeight: '600' },
});
