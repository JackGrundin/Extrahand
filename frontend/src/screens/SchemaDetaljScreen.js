import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput, Modal, Linking, Platform, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRealtidsPing } from '../context/RealtidsContext';
import { useAttAvsluta } from '../context/AttAvslutaContext';
import { api } from '../api/klient';
import { parsaObTillagg, beräknaObBelopp, formatDagDatum, veckodagsNamn } from '../utils/datumHelper';
import { beräknaFakturapris, ansökanStatusVisning } from '../utils/konstanter';
import { normaliseraKrav, saknadeKrav } from '../utils/behorighet';
import BehörighetsKrav from '../components/BehörighetsKrav';
import IntygandeRad from '../components/IntygandeRad';
import { useJobbPåslag } from '../utils/useJobbPåslag';
import RollBrickor from '../components/RollBrickor';

const PASSFÄRGER = {
  planerad: { bg: '#eff6ff', text: '#2563eb', etikett: 'Planerad' },
  rapporterad: { bg: '#dcfce7', text: '#16a34a', etikett: 'Genomförd' },
  installt: { bg: '#f3f4f6', text: '#9ca3af', etikett: 'Inställd' },
};

export default function SchemaDetaljScreen({ route, navigation }) {
  const { schemaId } = route.params;
  const { användare } = useAuth();
  const [schema, setSchema] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [meddelande, setMeddelande] = useState('');
  const [sökt, setSökt] = useState(false);
  const [ikryssade, setIkryssade] = useState(() => new Set());
  const [avtalsModalSynlig, setAvtalsModalSynlig] = useState(false);
  const { uppdateraAttAvsluta } = useAttAvsluta();

  const ärFöretag = användare?.typ === 'företag';
  // Företaget öppnar schemat för att se sökande, den godkända personen för att se sina pass.
  // Därför olika utgångsläge – inte ett godtyckligt default. ärFöretag härleds ur
  // användare?.typ och finns redan vid första renderingen, så ingen effekt behövs.
  const [passUtfällt, setPassUtfällt] = useState(!ärFöretag);
  const påslag = useJobbPåslag(schema?.paslag, ärFöretag);

  const hämta = useCallback(async () => {
    try {
      setSchema(await api.hämtaSchema(schemaId));
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }, [schemaId]);

  useFocusEffect(useCallback(() => { hämta(); }, [hämta]));
  useRealtidsPing(() => { hämta(); });

  // Att företaget öppnar schemat räknas som att ansökningarna setts – de visas här nere på
  // sidan. Nollställ räknaren och uppdatera badgen direkt, i stället för att vänta på nästa
  // hämtning. Bara för företag: backend avvisar ändå andra, så anropet vore meningslöst.
  useFocusEffect(useCallback(() => {
    if (!ärFöretag) return;
    api.markeraSchemaAnsökningarSedda(schemaId)
      .then(() => uppdateraAttAvsluta())
      .catch(() => {});
  }, [schemaId, ärFöretag, uppdateraAttAvsluta]));

  function öppnaKarta() {
    if (!schema?.adress) return;
    const q = encodeURIComponent(schema.adress);
    Linking.openURL(Platform.OS === 'ios' ? `maps://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`);
  }

  // Ansökan går mot schemats annons-jobb, så den befintliga ansökningsvägen (och därmed
  // chatten) fungerar oförändrat.
  async function hanteraSökan() {
    if (!användare?.avtalGodkant) {
      setAvtalsModalSynlig(true);
      return;
    }
    if (!schema?.annons_jobb_id) {
      Alert.alert('Fel', 'Schemat går inte att söka just nu.');
      return;
    }
    setSparar(true);
    try {
      await api.sökaJobb(schema.annons_jobb_id, {
        meddelande: meddelande.trim() || null,
        intygade_krav: [...ikryssade],
      });
      setSökt(true);
      Alert.alert('Klart!', 'Din ansökan om hela schemat har skickats.');
    } catch (fel) {
      Alert.alert('Fel', fel.message);
    } finally {
      setSparar(false);
    }
  }

  async function godkänn(ansökan) {
    Alert.alert(
      'Godkänn för hela schemat?',
      `${ansökan.sökandeNamn ?? 'Personen'} tilldelas samtliga ${schema.antalPass} pass. Priset (påslaget) fryses nu.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Godkänn',
          onPress: async () => {
            setSparar(true);
            try {
              await api.uppdateraStatus(ansökan.id, 'godkänd');
              await hämta();
            } catch (fel) {
              Alert.alert('Fel', fel.message);
            } finally {
              setSparar(false);
            }
          },
        },
      ]
    );
  }

  async function återkalla(ansökan) {
    Alert.alert(
      'Ta tillbaka godkännandet?',
      'Framtida pass frigörs och schemat blir sökbart igen. Redan genomförda pass påverkas inte.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta tillbaka',
          style: 'destructive',
          onPress: async () => {
            setSparar(true);
            try {
              await api.uppdateraStatus(ansökan.id, 'väntande');
              await hämta();
            } catch (fel) {
              Alert.alert('Fel', fel.message);
            } finally {
              setSparar(false);
            }
          },
        },
      ]
    );
  }

  async function ersätt(ansökan) {
    Alert.alert(
      'Ersätt person?',
      `${ansökan.sökandeNamn ?? 'Personen'} tar över alla framtida pass. Genomförda pass behåller den tidigare personen.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ersätt',
          onPress: async () => {
            setSparar(true);
            try {
              await api.ersättPersonISchema(schema.id, ansökan.sokande_id);
              await hämta();
            } catch (fel) {
              Alert.alert('Fel', fel.message);
            } finally {
              setSparar(false);
            }
          },
        },
      ]
    );
  }

  // Avdrag läggs till och tas bort i RedigeraSchemaScreen. Den här vyn visar dem bara, och
  // bara för den sökande – se avdragsblocket längre ned.

  async function avbryt() {
    Alert.alert(
      'Avbryt schemat?',
      'Alla framtida pass ställs in. Genomförda pass och deras tidrapporter behålls.',
      [
        { text: 'Nej', style: 'cancel' },
        {
          text: 'Avbryt schemat',
          style: 'destructive',
          onPress: async () => {
            setSparar(true);
            try {
              await api.avbrytSchema(schema.id);
              navigation.goBack();
            } catch (fel) {
              Alert.alert('Fel', fel.message);
              setSparar(false);
            }
          },
        },
      ]
    );
  }

  // Företaget ska kunna läsa CV och erfarenheter innan de godkänner någon – samma väg som
  // från JobbAnsokningarScreen. SökanadeProfil är registrerad i MinaJobbNavigator och
  // ProfilNavigator, de två stackar där ett företag når SchemaDetalj.
  function visaProfil(ansökan) {
    if (!ansökan?.sokande_id) return;
    navigation.navigate('SökanadeProfil', { sokandeId: ansökan.sokande_id, ansokningId: ansökan.id });
  }

  async function hoppaAv() {
    Alert.alert(
      'Hoppa av schemat?',
      'Dina framtida pass frigörs. Redan genomförda pass och deras tidrapporter påverkas inte.',
      [
        { text: 'Nej', style: 'cancel' },
        {
          text: 'Hoppa av',
          style: 'destructive',
          onPress: async () => {
            setSparar(true);
            try {
              await api.hoppaAvSchema(schema.id);
              await hämta();
            } catch (fel) {
              Alert.alert('Fel', fel.message);
            } finally {
              setSparar(false);
            }
          },
        },
      ]
    );
  }

  if (laddar) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!schema) return null;

  const ärTilldelad = schema.anvandare_id != null;
  const ärMitt = String(schema.anvandare_id ?? '') === String(användare?.id ?? '');
  const avdrag = schema.avdrag ?? [];
  const ansökningar = schema.ansokningar ?? [];
  const godkändAnsökan = ansökningar.find(a => a.status === 'godkänd');
  const övrigaAnsökningar = ansökningar.filter(a => a.status !== 'godkänd');
  const krav = normaliseraKrav(schema.behorighets_krav);
  const kanIntyga = !ärFöretag && !ärTilldelad && !sökt;
  // Mot kravlistan, inte mot antalet kryss: ett gammalt kryss som inte längre motsvarar
  // något krav ska inte kunna låsa upp knappen.
  const kvarAttKryssa = kanIntyga ? saknadeKrav(krav, [...ikryssade]).length : 0;
  // Antalsbrickan säger "så här många kan du välja bland". Avvisade och avhoppade hör
  // inte dit, även om de fortfarande listas nedanför med sin status.
  const antalVäntande = övrigaAnsökningar.filter(a => a.status === 'väntande').length;
  const obTillagg = parsaObTillagg(schema.ob_tillagg);

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={uppdaterar} onRefresh={() => { setUppdaterar(true); hämta(); }} />}
      >
        {schema.foretagNamn && <Text style={styles.foretagNamn}>{schema.foretagNamn}</Text>}
        <Text style={styles.titel}>{schema.titel}</Text>
        {/* Huvudkategorin är valfri sedan rollen flyttades till passnivå – utan villkoret
            blir det en hängande " · " på nya scheman. */}
        <Text style={styles.info}>
          {[schema.plats, schema.kategori].filter(Boolean).join(' · ')}
        </Text>
        {schema.kategorier?.length > 0 && <RollBrickor roller={schema.kategorier} style={{ marginBottom: 8 }} />}
        <Text style={styles.lön}>{Number(schema.timlon).toLocaleString('sv-SE')} kr/tim</Text>

        <View style={styles.periodKort}>
          <Ionicons name="calendar" size={16} color="#2563eb" />
          <View style={{ flex: 1 }}>
            <Text style={styles.periodText}>
              {formatDagDatum(schema.startdatum)} – {formatDagDatum(schema.slutdatum)} · {schema.antalPass} pass
            </Text>
            {/* Totalen kommer färdigräknad från servern (GET /api/scheman/:id). Räkna den
                aldrig här: pass över midnatt och sommartidsskiften måste ge exakt samma
                siffra som tidrapporterna, och telefonens tidszon behöver inte vara
                Europe/Stockholm. Villkoret tål att fältet saknas mot en äldre backend. */}
            {schema.totaltTimmar > 0 && (
              <Text style={styles.periodTimmar}>
                Totalt: {schema.totaltTimmar.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} timmar
              </Text>
            )}
          </View>
        </View>

        {ärTilldelad && (
          <View style={styles.tilldeladKort}>
            <Ionicons name="person" size={16} color="#16a34a" />
            <Text style={styles.tilldeladText}>
              {ärMitt ? 'Du är godkänd för det här schemat' : `${schema.personNamn ?? 'En person'} är godkänd för schemat`}
            </Text>
          </View>
        )}

        {/* Redigering bara för ägaren och bara så länge schemat lever. Ett avbrutet schema
            går inte att ändra – backend avvisar det ändå. */}
        {ärFöretag && schema.status !== 'avbrutet' && (
          <TouchableOpacity
            style={styles.redigeraKnapp}
            onPress={() => navigation.navigate('RedigeraSchema', { schemaId: schema.id })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color="#2563eb" />
            <Text style={styles.redigeraText}>Redigera schema</Text>
          </TouchableOpacity>
        )}

        {/* Företagets sökande ligger HÖGST UPP – det är det man öppnar schemat för. Låg de
            kvar sist hamnade de efter en passlista som kan vara 60+ rader lång. */}
        {ärFöretag && (
          <>
            {godkändAnsökan && (
              <>
                <Text style={styles.sektionsRubrik}>Godkänd person</Text>
                <View style={styles.sökandeKort}>
                  <TouchableOpacity
                    style={styles.sökandeInfo}
                    onPress={() => visaProfil(godkändAnsökan)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(godkändAnsökan.sökandeNamn ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sökandeNamn}>{godkändAnsökan.sökandeNamn ?? 'Okänd'}</Text>
                      <IntygandeRad ansökan={godkändAnsökan} style={{ marginTop: 4 }} />
                      <Text style={styles.profilLänk}>Visa profil →</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chattKnapp}
                    onPress={() => navigation.navigate('Chatt', { ansokningId: godkändAnsökan.id })}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color="#2563eb" />
                    <Text style={styles.chattKnappText}>Chatt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.avvisaKnapp} onPress={() => återkalla(godkändAnsökan)} disabled={sparar}>
                    <Text style={styles.avvisaText}>Ta tillbaka</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.sökandeRubrikRad}>
              <Text style={styles.sektionsRubrik}>
                {godkändAnsökan ? 'Övriga sökande' : 'Sökande'}
              </Text>
              {antalVäntande > 0 && (
                <View style={styles.sökandeAntal}>
                  <Text style={styles.sökandeAntalText}>{antalVäntande}</Text>
                </View>
              )}
            </View>
            {övrigaAnsökningar.length === 0 ? (
              <Text style={styles.tomText}>Inga sökande ännu.</Text>
            ) : (
              övrigaAnsökningar.map(a => {
                const status = ansökanStatusVisning(a, { ärFöretag: true });
                // Bara den som fortfarande väntar går att godkänna. En avhoppare eller en
                // redan nekad ska inte ha en Godkänn-knapp som ser ut som alla andras.
                const kanGodkännas = a.status === 'väntande';
                return (
                  <View key={a.id} style={styles.sökandeKort}>
                    <TouchableOpacity
                      style={styles.sökandeInfo}
                      onPress={() => visaProfil(a)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(a.sökandeNamn ?? '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.namnRad}>
                          <Text style={styles.sökandeNamn}>{a.sökandeNamn ?? 'Okänd'}</Text>
                          {status && !kanGodkännas && (
                            <View style={[styles.sökandeStatusBricka, { backgroundColor: status.bg }]}>
                              <Text style={[styles.sökandeStatusText, { color: status.text }]}>{status.etikett}</Text>
                            </View>
                          )}
                        </View>
                        {a.meddelande ? <Text style={styles.sökandeMeddelande} numberOfLines={2}>{a.meddelande}</Text> : null}
                        <IntygandeRad ansökan={a} style={{ marginTop: 4 }} />
                        <Text style={styles.profilLänk}>Visa profil →</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chattKnapp}
                      onPress={() => navigation.navigate('Chatt', { ansokningId: a.id })}
                    >
                      <Ionicons name="chatbubble-outline" size={15} color="#2563eb" />
                      <Text style={styles.chattKnappText}>Chatt</Text>
                    </TouchableOpacity>
                    {kanGodkännas && (
                      <TouchableOpacity
                        style={styles.godkännKnapp}
                        onPress={() => (godkändAnsökan ? ersätt(a) : godkänn(a))}
                        disabled={sparar}
                      >
                        <Text style={styles.godkännText}>{godkändAnsökan ? 'Ersätt' : 'Godkänn'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {obTillagg.length > 0 && schema.timlon ? (
          <View style={styles.obSektion}>
            <View style={styles.obRubrikRad}>
              <View style={styles.obBadge}><Text style={styles.obBadgeText}>OB</Text></View>
              <Text style={styles.obRubrik}>Obekväm arbetstid</Text>
            </View>
            {obTillagg.map((o, i) => {
              const [sh = 0, sm = 0] = o.start.split(':').map(Number);
              const [eh = 0, em = 0] = o.slut.split(':').map(Number);
              const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
              const brutto = o.typ === 'procent' ? h * schema.timlon * (o.värde / 100) : h * o.värde;
              const visat = ärFöretag ? beräknaFakturapris(brutto, påslag) : brutto;
              return (
                <View key={i} style={styles.obRad}>
                  <Text style={styles.obIntervall}>{o.start}–{o.slut}</Text>
                  <Text style={styles.obTillägg}>
                    {o.typ === 'procent' ? `${o.värde}%` : `${o.värde} kr/h`}
                    {' '}= <Text style={styles.obBelopp}>+{visat.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {schema.adress && (
          <View style={styles.adressKort}>
            <View style={styles.adressRad}>
              <Ionicons name="location-outline" size={16} color="#2563eb" />
              <Text style={styles.adressText}>{schema.adress}</Text>
            </View>
            {/* Bara för den som överväger att söka – hen behöver veta om arbetsplatsen går
                att ta sig till. Företaget känner sin egen adress. */}
            {!ärFöretag && (
              <TouchableOpacity style={styles.kartaKnapp} onPress={öppnaKarta}>
                <Ionicons name="map-outline" size={15} color="#2563eb" />
                <Text style={styles.kartaKnappText}>Visa på karta</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {schema.beskrivning ? (
          <>
            <Text style={styles.sektionsRubrik}>Beskrivning</Text>
            <Text style={styles.beskrivning}>{schema.beskrivning}</Text>
          </>
        ) : null}

        {/* Löneavdrag – bara för den sökande. Hen MÅSTE se att t.ex. 200 kr/dag dras för
            boende innan hen ansöker, inte först när den första tidrapporten dyker upp.
            Företaget ser och redigerar avdragen i RedigeraSchemaScreen i stället. */}
        {!ärFöretag && avdrag.length > 0 && (
          <View style={styles.avdragKort}>
            <View style={styles.avdragRubrikRad}>
              <Ionicons name="remove-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.avdragRubrik}>Löneavdrag</Text>
            </View>
            {avdrag.map(a => (
              <View key={a.id} style={styles.avdragRad}>
                <Text style={styles.avdragNamn} numberOfLines={1}>{a.namn}</Text>
                <Text style={styles.avdragBelopp}>
                  −{Number(a.belopp).toLocaleString('sv-SE')} kr
                  <Text style={styles.avdragEnhet}>{a.typ === 'totalt' ? ' totalt' : ' /pass'}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Passen fälls ihop för företaget, som öppnar schemat för att se sökande, men står
            utfällda för privatpersonen, för vilken passen är hela poängen med sidan. */}
        <TouchableOpacity
          style={styles.passRubrikRad}
          onPress={() => setPassUtfällt(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.sektionsRubrik}>Pass ({schema.pass?.length ?? 0})</Text>
          <Ionicons name={passUtfällt ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
        </TouchableOpacity>
        {passUtfällt && (
        <View style={styles.passLista}>
          {(schema.pass ?? []).map(p => {
            const färg = PASSFÄRGER[p.status] ?? PASSFÄRGER.planerad;
            return (
              <View key={p.id} style={styles.passRad}>
                <View style={styles.passDatumBlock}>
                  <Text style={styles.passVeckodag}>{veckodagsNamn(p.datum)}</Text>
                  <Text style={styles.passDatum}>{formatDagDatum(p.datum)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passTid}>{p.starttid} – {p.sluttid}</Text>
                  <View style={styles.passBrickor}>
                    {p.kategori ? (
                      <View style={styles.rollBricka}><Text style={styles.rollBrickaText}>{p.kategori}</Text></View>
                    ) : null}
                    {p.ob_tillagg?.length > 0 && (
                      <View style={styles.obBricka}><Text style={styles.obBrickaText}>OB</Text></View>
                    )}
                  </View>
                </View>
                <View style={[styles.statusBricka, { backgroundColor: färg.bg }]}>
                  <Text style={[styles.statusText, { color: färg.text }]}>{färg.etikett}</Text>
                </View>
              </View>
            );
          })}
        </View>
        )}

        {/* Kraven ligger ovanför ansökningsknappen av samma skäl som löneavdragen: den
            sökande ska se dem INNAN hen söker, inte efteråt. Och ovanför de destruktiva
            knapparna – ingenting ska stå under "Avbryt schemat". */}
        <BehörighetsKrav
          krav={krav}
          läge={kanIntyga ? 'intyga' : 'visning'}
          ikryssade={ikryssade}
          onÄndra={setIkryssade}
        />

        {/* Avbryt schemat står kvar sist, INTE uppe hos sökandelistan: den är destruktiv
            och ska inte ligga bredvid Godkänn-knapparna. */}
        {ärFöretag && schema.status !== 'avbrutet' && (
          <TouchableOpacity style={styles.avbrytSchemaKnapp} onPress={avbryt} disabled={sparar}>
            <Text style={styles.avbrytSchemaText}>Avbryt schemat</Text>
          </TouchableOpacity>
        )}

        {/* Privatpersonens vy: ansök eller hoppa av */}
        {!ärFöretag && ärMitt && (
          <TouchableOpacity style={styles.avbrytSchemaKnapp} onPress={hoppaAv} disabled={sparar}>
            <Text style={styles.avbrytSchemaText}>Hoppa av schemat</Text>
          </TouchableOpacity>
        )}

        {!ärFöretag && !ärTilldelad && (
          <>
            {!sökt && (
              <>
                <Text style={styles.sektionsRubrik}>Ansökningstext</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Berätta kort varför du passar för uppdraget... (valfritt)"
                  value={meddelande}
                  onChangeText={setMeddelande}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </>
            )}
            <TouchableOpacity
              style={[styles.knapp, (sökt || kvarAttKryssa > 0) && styles.knappInaktiv]}
              onPress={hanteraSökan}
              disabled={sparar || sökt || kvarAttKryssa > 0}
            >
              {sparar
                ? <ActivityIndicator color="#fff" />
                : (
                  <Text style={styles.knappText}>
                    {sökt ? 'Ansökan skickad'
                      : kvarAttKryssa > 0 ? `${kvarAttKryssa} krav kvar att kryssa i`
                      : 'Sök hela schemat'}
                  </Text>
                )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={avtalsModalSynlig} transparent animationType="fade" onRequestClose={() => setAvtalsModalSynlig(false)}>
        <View style={styles.modalBakgrund}>
          <View style={styles.modalKort}>
            <Text style={styles.modalRubrik}>Avtal krävs</Text>
            <Text style={styles.modalText}>
              Du behöver skriva på ett anställningsavtal innan du kan ansöka. Vi skickar avtalet till din mejl inom kort.
            </Text>
            <TouchableOpacity style={styles.modalKnapp} onPress={() => setAvtalsModalSynlig(false)}>
              <Text style={styles.modalKnappText}>Stäng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  foretagNamn: { fontSize: 15, color: '#2563eb', fontWeight: '600', marginBottom: 4 },
  titel: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  info: { fontSize: 15, color: '#666', marginBottom: 4 },
  lön: { fontSize: 16, color: '#2563eb', fontWeight: '600', marginBottom: 12 },

  periodKort: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  periodText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  periodTimmar: { fontSize: 13, fontWeight: '500', color: '#3b82f6', marginTop: 2 },

  tilldeladKort: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  tilldeladText: { fontSize: 14, fontWeight: '600', color: '#15803d', flex: 1 },

  adressKort: { backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  adressRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  adressText: { fontSize: 15, color: '#1a1a1a', flex: 1 },
  kartaKnapp: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  kartaKnappText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },

  sektionsRubrik: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginTop: 12 },
  passRubrikRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  redigeraKnapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 11, marginBottom: 4 },
  redigeraText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  sökandeRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sökandeAntal: { backgroundColor: '#2563eb', borderRadius: 11, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center', marginTop: 4 },
  sökandeAntalText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  beskrivning: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 12 },

  passLista: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  passRad: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  passDatumBlock: { width: 70 },
  passVeckodag: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '600' },
  passDatum: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  passTid: { fontSize: 14, color: '#374151' },
  passBrickor: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  rollBricka: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rollBrickaText: { fontSize: 11, color: '#2563eb', fontWeight: '700' },
  obBricka: { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  obBrickaText: { fontSize: 11, color: '#c2410c', fontWeight: '700' },

  // Neutral yta som resten av sidan, med rött bara på ikonen och beloppet. Kortet bar
  // tidigare rött på fem nivåer (bakgrund, ram, rubrik, namn, detaljrad) och skrek mer
  // än det informerade. Minustecknet och den röda summan räcker för att raden ska läsas
  // som ett avdrag.
  avdragKort: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  avdragRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  avdragRubrik: { fontSize: 14, fontWeight: '700', color: '#374151' },
  avdragRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  avdragNamn: { fontSize: 14, color: '#374151', flexShrink: 1 },
  avdragBelopp: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  avdragEnhet: { fontSize: 12, fontWeight: '500', color: '#9ca3af' },
  statusBricka: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  sökandeKort: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  sökandeNamn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  sökandeInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  namnRad: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
  profilLänk: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 3 },
  sökandeStatusBricka: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sökandeStatusText: { fontSize: 11, fontWeight: '700' },
  sökandeMeddelande: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  chattKnapp: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chattKnappText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  godkännKnapp: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  godkännText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  avvisaKnapp: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  avvisaText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  tomText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginBottom: 8 },

  avbrytSchemaKnapp: { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  avbrytSchemaText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },

  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', minHeight: 110, marginBottom: 16 },
  knapp: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  knappInaktiv: { backgroundColor: '#9ca3af' },
  knappText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  obSektion: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#fed7aa' },
  obRubrikRad: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  obBadge: { backgroundColor: '#ea580c', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  obBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  obRubrik: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  obRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  obIntervall: { fontSize: 14, color: '#7c2d12', fontWeight: '600' },
  obTillägg: { fontSize: 14, color: '#9a3412' },
  obBelopp: { fontWeight: '700', color: '#c2410c' },

  modalBakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalKort: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  modalText: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 24 },
  modalKnapp: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalKnappText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
