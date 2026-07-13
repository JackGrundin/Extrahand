// Visas när ett gratiskonto publicerar sitt tredje pass samma månad. Företaget får
// välja mellan att uppgradera till Pro (fortsatt 20% påslag) eller att publicera
// passet med 40% påslag. Priserna räknas ut på jobbets faktiska timlön så att
// skillnaden blir konkret.
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PÅSLAG_PRO,
  PÅSLAG_GRATIS,
  PRO_PRIS_KR,
  beräknaFakturapris,
  formateraPris,
} from '../utils/konstanter';

export default function PrenumerationModal({
  visible,
  onClose,
  timlön = 0,
  laddar = false,
  onUppgradera,
  onFortsattUtan,
}) {
  const proPris = formateraPris(beräknaFakturapris(timlön, PÅSLAG_PRO));
  const gratisPris = formateraPris(beräknaFakturapris(timlön, PÅSLAG_GRATIS));
  const harTimlön = timlön > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBakgrund}>
        <View style={styles.modalKort}>
          <Text style={styles.rubrik}>Ni har använt månadens två pass</Text>
          <Text style={styles.underrubrik}>
            Uppgradera till Pro för att behålla 20 % påslag, eller fortsätt utan abonnemang
            med 40 % påslag på det här passet.
          </Text>

          <View style={styles.block}>
            {/* Vänster block – Pro */}
            <View style={[styles.plan, styles.planPro]}>
              <View style={styles.proBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
              <Text style={styles.planPris}>{PRO_PRIS_KR} kr</Text>
              <Text style={styles.planPeriod}>per månad</Text>
              <Text style={styles.planPåslag}>Alltid 20 % påslag</Text>
              <Text style={styles.planInfo}>Obegränsat antal pass</Text>

              <TouchableOpacity
                style={[styles.proKnapp, laddar && styles.knappInaktiv]}
                onPress={onUppgradera}
                disabled={laddar}
                activeOpacity={0.8}
              >
                {laddar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.proKnappText}>Uppgradera till Pro</Text>
                )}
              </TouchableOpacity>

              {harTimlön && (
                <Text style={styles.jämförelse}>
                  Med denna timlön blir er kostnad{' '}
                  <Text style={styles.prisFramhävd}>{proPris} kr/h</Text> istället för{' '}
                  <Text style={styles.prisÖverstruken}>{gratisPris} kr/h</Text>
                </Text>
              )}
            </View>

            {/* Höger block – gratis */}
            <View style={styles.plan}>
              <Text style={styles.gratisEtikett}>GRATIS</Text>
              <Text style={styles.planPris}>0 kr</Text>
              <Text style={styles.planPeriod}>per månad</Text>
              <Text style={styles.planPåslag}>40 % påslag</Text>
              <Text style={styles.planInfo}>Efter 2 pass i månaden</Text>

              <TouchableOpacity
                style={[styles.gratisKnapp, laddar && styles.knappInaktiv]}
                onPress={onFortsattUtan}
                disabled={laddar}
                activeOpacity={0.8}
              >
                <Text style={styles.gratisKnappText}>Fortsätt utan abonnemang</Text>
              </TouchableOpacity>

              {harTimlön && (
                <Text style={styles.jämförelse}>
                  Passet publiceras med en kostnad på{' '}
                  <Text style={styles.prisFramhävd}>{gratisPris} kr/h</Text>
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.avbryt} onPress={onClose} disabled={laddar}>
            <Text style={styles.avbrytText}>Avbryt</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKort: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  rubrik: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  underrubrik: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 19,
  },

  block: { flexDirection: 'row', gap: 12 },
  plan: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  planPro: { borderColor: '#2563eb', borderWidth: 2, backgroundColor: '#f8faff' },

  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  proBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  gratisEtikett: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#94a3b8',
    paddingVertical: 3,
  },

  planPris: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginTop: 10 },
  planPeriod: { fontSize: 12, color: '#94a3b8' },
  planPåslag: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginTop: 12 },
  planInfo: { fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' },

  proKnapp: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  proKnappText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  gratisKnapp: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  gratisKnappText: { color: '#475569', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  knappInaktiv: { opacity: 0.5 },

  jämförelse: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 12, lineHeight: 16 },
  prisFramhävd: { fontWeight: '700', color: '#2563eb' },
  prisÖverstruken: { textDecorationLine: 'line-through', color: '#94a3b8' },

  avbryt: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  avbrytText: { color: '#94a3b8', fontSize: 14 },
});
