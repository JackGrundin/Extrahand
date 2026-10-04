import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { api, felText } from '../api/klient';

const MAX_DOKUMENT = 10;
const MAX_BYTE = 10 * 1024 * 1024;

// MIME-typ -> filändelse. Speglar TILLÅTNA_DOKUMENTTYPER i backend/routes/användare.js.
const TILLÅTNA = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

// Härleder en MIME-typ när document-pickern inte ger någon (eller ger en generisk),
// utifrån filändelsen. Returnerar null för otillåtna typer så att anroparen kan larma.
function härledMimeType(asset) {
  if (asset.mimeType && TILLÅTNA[asset.mimeType]) return asset.mimeType;
  const ext = (asset.name?.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

function ikonFörMime(mime) {
  return mime === 'application/pdf' ? 'document-text-outline' : 'image-outline';
}

function formateraStorlek(byte) {
  if (!byte) return '';
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

// Delad dokumentlista. redigerbar=true ger privatpersonen uppladdning + radering på
// egna profilen; utan den är det företagets läsvy (tryck öppnar dokumentet).
// onÄndrad körs efter en lyckad uppladdning/radering så att föräldern hämtar om profilen.
export default function DokumentLista({ dokument = [], redigerbar = false, onÄndrad }) {
  const [laddarUpp, setLaddarUpp] = useState(false);
  const [namnModal, setNamnModal] = useState(null); // { asset, mime, namn }

  // Läsvyn visar ingenting alls när personen inte laddat upp något.
  if (!redigerbar && dokument.length === 0) return null;

  async function öppnaDokument(url) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Kunde inte öppna', 'Dokumentet gick inte att öppna.');
    }
  }

  async function väljFil() {
    if (dokument.length >= MAX_DOKUMENT) {
      Alert.alert('Max antal nått', `Du kan ha max ${MAX_DOKUMENT} dokument.`);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: Object.keys(TILLÅTNA),
      copyToCacheDirectory: true,
      base64: true, // ger asset.base64 på webben; på native läses filen separat
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mime = härledMimeType(asset);
    if (!mime) {
      Alert.alert('Otillåten filtyp', 'Välj en PDF-, JPG- eller PNG-fil.');
      return;
    }
    if (asset.size && asset.size > MAX_BYTE) {
      Alert.alert('Filen är för stor', 'Max filstorlek är 10 MB.');
      return;
    }

    // Föreslå filnamnet utan ändelse som dokumentnamn; användaren får ändra det.
    const förslag = (asset.name || '').replace(/\.[^.]+$/, '') || 'Dokument';
    setNamnModal({ asset, mime, namn: förslag });
  }

  async function laddaUpp() {
    if (!namnModal) return;
    const namn = namnModal.namn.trim();
    if (!namn) {
      Alert.alert('Ange ett namn', 'Dokumentet behöver ett namn.');
      return;
    }
    const { asset, mime } = namnModal;
    setNamnModal(null);
    setLaddarUpp(true);
    try {
      const base64 = asset.base64 ?? (await new File(asset.uri).base64());
      await api.laddaUppDokument({ namn, fil: base64, mimeType: mime });
      onÄndrad?.();
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    } finally {
      setLaddarUpp(false);
    }
  }

  function bekräftaTaBort(dok) {
    Alert.alert('Ta bort dokument', `Vill du ta bort "${dok.namn}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => taBort(dok.id) },
    ]);
  }

  async function taBort(id) {
    try {
      await api.raderaDokument(id);
      onÄndrad?.();
    } catch (fel) {
      Alert.alert('Fel', felText(fel));
    }
  }

  return (
    <View style={styles.sektion}>
      <Text style={styles.rubrik}>Dokument</Text>

      {dokument.map((dok) => (
        <View key={dok.id} style={styles.rad}>
          <TouchableOpacity
            style={styles.radInnehall}
            onPress={() => öppnaDokument(dok.url)}
            accessibilityRole="button"
            accessibilityLabel={`Öppna dokument ${dok.namn}`}
          >
            <Ionicons name={ikonFörMime(dok.mime_type)} size={22} color="#2563eb" />
            <View style={styles.radText}>
              <Text style={styles.radNamn} numberOfLines={1}>{dok.namn}</Text>
              {!!dok.storlek && <Text style={styles.radStorlek}>{formateraStorlek(dok.storlek)}</Text>}
            </View>
          </TouchableOpacity>

          {redigerbar && (
            <TouchableOpacity
              onPress={() => bekräftaTaBort(dok)}
              style={styles.taBortKnapp}
              accessibilityRole="button"
              accessibilityLabel={`Ta bort dokument ${dok.namn}`}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {redigerbar && dokument.length === 0 && (
        <Text style={styles.tom}>Ladda upp CV, körkort eller intyg så att företag kan se dina meriter.</Text>
      )}

      {redigerbar && dokument.length < MAX_DOKUMENT && (
        <TouchableOpacity
          style={styles.laddaUppKnapp}
          onPress={väljFil}
          disabled={laddarUpp}
          accessibilityRole="button"
          accessibilityLabel="Lägg till dokument"
        >
          {laddarUpp ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <>
              <Ionicons name="add" size={18} color="#2563eb" />
              <Text style={styles.laddaUppText}>Lägg till dokument</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <Modal visible={!!namnModal} transparent animationType="fade" onRequestClose={() => setNamnModal(null)}>
        <View style={styles.modalBakgrund}>
          <View style={styles.modalKort}>
            <Text style={styles.modalRubrik}>Namnge dokumentet</Text>
            <TextInput
              style={styles.modalInput}
              value={namnModal?.namn ?? ''}
              onChangeText={(t) => setNamnModal((m) => (m ? { ...m, namn: t } : m))}
              placeholder="T.ex. B-körkort"
              autoFocus={Platform.OS !== 'web'}
              maxLength={60}
            />
            <View style={styles.modalKnappar}>
              <TouchableOpacity style={styles.modalAvbryt} onPress={() => setNamnModal(null)}>
                <Text style={styles.modalAvbrytText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSpara} onPress={laddaUpp}>
                <Text style={styles.modalSparaText}>Ladda upp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sektion: { width: '100%', marginBottom: 20 },
  rubrik: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  rad: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 8, paddingHorizontal: 12 },
  radInnehall: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  radText: { flex: 1 },
  radNamn: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  radStorlek: { fontSize: 12, color: '#999', marginTop: 2 },
  taBortKnapp: { padding: 8, marginLeft: 4 },
  tom: { fontSize: 14, color: '#aaa', lineHeight: 20, marginBottom: 12 },
  laddaUppKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2563eb', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, minHeight: 44 },
  laddaUppText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  modalKort: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  modalRubrik: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16 },
  modalKnappar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalAvbryt: { paddingVertical: 10, paddingHorizontal: 16 },
  modalAvbrytText: { color: '#666', fontWeight: '600', fontSize: 15 },
  modalSpara: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  modalSparaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
