import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

function strängTillDatum(tid) {
  const delar = (tid || '').split(':').map(Number);
  const h = isNaN(delar[0]) ? 8 : delar[0];
  const m = isNaN(delar[1]) ? 0 : delar[1];
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function datumTillSträng(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function TidVäljare({ value, onChange, placeholder = 'HH:MM', style }) {
  const [visas, setVisas] = useState(false);
  const [tempTid, setTempTid] = useState(() => strängTillDatum(value));

  function öppna() {
    setTempTid(strängTillDatum(value));
    setVisas(true);
  }

  function bekräfta() {
    onChange(datumTillSträng(tempTid));
    setVisas(false);
  }

  return (
    <>
      <TouchableOpacity style={[styles.knapp, style]} onPress={öppna} activeOpacity={0.7}>
        <Text style={[styles.text, !value && styles.placeholder]}>{value || placeholder}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && visas && (
        <DateTimePicker
          value={tempTid}
          mode="time"
          is24Hour
          display="spinner"
          onChange={(_, date) => {
            setVisas(false);
            if (date) onChange(datumTillSträng(date));
          }}
        />
      )}

      <Modal visible={Platform.OS === 'ios' && visas} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.bakgrund}>
          <View style={styles.panel}>
            <View style={styles.rubrikRad}>
              <TouchableOpacity onPress={() => setVisas(false)}>
                <Text style={styles.avbryt}>Avbryt</Text>
              </TouchableOpacity>
              <Text style={styles.rubrik}>Välj tid</Text>
              <TouchableOpacity onPress={bekräfta}>
                <Text style={styles.klar}>Klar</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempTid}
              mode="time"
              display="spinner"
              is24Hour
              onChange={(_, date) => date && setTempTid(date)}
              locale="sv-SE"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  knapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fafafa',
  },
  text: { fontSize: 15, color: '#1a1a1a', textAlign: 'center' },
  placeholder: { color: '#aaa' },
  bakgrund: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  rubrikRad: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  avbryt: { fontSize: 16, color: '#9ca3af' },
  klar: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
});
