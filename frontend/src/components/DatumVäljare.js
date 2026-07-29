import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { datumTillIso } from '../utils/datumHelper';

// Datumknapp med väljare. iOS får en modal med spinner, Android den inbyggda dialogen –
// den uppdelningen låg tidigare inline i PubliceraSchemaScreen och behövde kopieras varje
// gång ett nytt datumfält tillkom.
//
// Värdet är alltid 'YYYY-MM-DD' i LOKAL tid via datumTillIso. toISOString() hade konverterat
// till UTC och gett fel dag för datum valda före 02:00 på sommaren.
export default function DatumVäljare({
  värde,
  onÄndra,
  placeholder = 'Välj datum',
  minimumDate,
  style,
  fel = false,
}) {
  const [öppen, setÖppen] = useState(false);
  const [temp, setTemp] = useState(new Date());

  function öppna() {
    setTemp(värde ? new Date(värde + 'T12:00:00') : new Date());
    setÖppen(true);
  }

  const text = värde
    ? new Date(värde + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
    : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[styles.knapp, fel && styles.knappFel, style]}
        onPress={öppna}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={värde ? '#1a1a1a' : '#aaa'} />
        <Text style={[styles.text, !värde && styles.placeholder]} numberOfLines={1}>{text}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && öppen && (
        <DateTimePicker
          value={temp}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={(_, date) => {
            setÖppen(false);
            if (date) onÄndra(datumTillIso(date));
          }}
        />
      )}

      <Modal visible={Platform.OS === 'ios' && öppen} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <View style={styles.rubrikRad}>
              <TouchableOpacity onPress={() => setÖppen(false)}>
                <Text style={styles.avbryt}>Avbryt</Text>
              </TouchableOpacity>
              <Text style={styles.rubrik}>Välj datum</Text>
              <TouchableOpacity onPress={() => { onÄndra(datumTillIso(temp)); setÖppen(false); }}>
                <Text style={styles.klar}>Klar</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={temp}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              onChange={(_, date) => date && setTemp(date)}
              locale="sv-SE"
              // Spinnern följer annars systemets mörka läge och blir vit text mot den vita
              // panelen (osynlig). Tvinga ljust tema + mörk text.
              themeVariant="light"
              textColor="#1a1a1a"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  knapp: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
  knappFel: { borderColor: '#dc2626', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  text: { fontSize: 15, color: '#1a1a1a', flexShrink: 1 },
  placeholder: { color: '#aaa' },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  rubrikRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rubrik: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  avbryt: { fontSize: 16, color: '#9ca3af' },
  klar: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
});
