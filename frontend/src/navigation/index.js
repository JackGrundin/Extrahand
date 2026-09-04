import { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppState, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
import { useAttAvsluta } from '../context/AttAvslutaContext';
import { useRealtidsPing } from '../context/RealtidsContext';
import { api } from '../api/klient';
import LoggaInScreen from '../screens/LoggaInScreen';
import RegistreraScreen from '../screens/RegistreraScreen';
import JobbScreen from '../screens/JobbScreen';
import JobbDetaljScreen from '../screens/JobbDetaljScreen';
import ProfilScreen from '../screens/ProfilScreen';
import MinaAnsokningarScreen from '../screens/MinaAnsokningarScreen';
import ChattScreen from '../screens/ChattScreen';
import ChattListaScreen from '../screens/ChattListaScreen';
import PubliceraJobbScreen from '../screens/PubliceraJobbScreen';
import MinaJobbScreen from '../screens/MinaJobbScreen';
import RedigeraJobbScreen from '../screens/RedigeraJobbScreen';
import SökandeProfilScreen from '../screens/SökandeProfilScreen';
import JobbAnsokningarScreen from '../screens/JobbAnsokningarScreen';
import BetygsattScreen from '../screens/BetygsattScreen';
import RedigeraProfilScreen from '../screens/RedigeraProfilScreen';
import MinaPassScreen from '../screens/MinaPassScreen';
import FöretagsProfilScreen from '../screens/FöretagsProfilScreen';
import RapporterScreen from '../screens/RapporterScreen';
import VerifieraEmailScreen from '../screens/VerifieraEmailScreen';
import PubliceraSchemaScreen from '../screens/PubliceraSchemaScreen';
import SchemaDetaljScreen from '../screens/SchemaDetaljScreen';
import RedigeraSchemaScreen from '../screens/RedigeraSchemaScreen';
import SchemaKalenderScreen from '../screens/SchemaKalenderScreen';
import GlömtLösenordScreen from '../screens/GlömtLösenordScreen';
import OfflineBanner from '../components/OfflineBanner';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ChatKnapp({ navigation }) {
  const { totalOlästa } = useNotifikationer();
  return (
    <TouchableOpacity
      onPress={() => navigation.getParent()?.navigate('ChattTab')}
      style={badgeStyles.knapp}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="Öppna chattar"
    >
      <View style={badgeStyles.ikonYta}>
        <Ionicons name="chatbubbles-outline" size={26} color="#2563eb" />
        {totalOlästa > 0 && (
          <View style={badgeStyles.badge}>
            <Text style={badgeStyles.badgeText}>
              {totalOlästa > 9 ? '9+' : String(totalOlästa)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoggaIn" component={LoggaInScreen} />
      <Stack.Screen name="Registrera" component={RegistreraScreen} />
      <Stack.Screen name="GlömtLösenord" component={GlömtLösenordScreen} />
      <Stack.Screen name="VerifieraEmail" component={VerifieraEmailScreen} />
    </Stack.Navigator>
  );
}

function JobbNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="Jobb" component={JobbScreen} options={{ title: 'Lediga jobb' }} />
      <Stack.Screen name="JobbDetalj" component={JobbDetaljScreen} options={{ title: 'Jobbdetaljer' }} />
      <Stack.Screen name="SchemaDetalj" component={SchemaDetaljScreen} options={{ title: 'Schema' }} />
      <Stack.Screen name="FöretagsProfil" component={FöretagsProfilScreen} options={{ title: 'Företagsprofil' }} />
      <Stack.Screen name="JobbAnsokningar" component={JobbAnsokningarScreen} options={({ route }) => ({ title: route.params?.titel ?? 'Ansökningar' })} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
    </Stack.Navigator>
  );
}

function AnsökningarNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="MinaAnsokningar" component={MinaAnsokningarScreen} options={{ title: 'Mina ansökningar' }} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
      <Stack.Screen name="Betygsatt" component={BetygsattScreen} options={{ title: 'Betygsätt' }} />
    </Stack.Navigator>
  );
}

function MinaPassNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="MinaPass" component={MinaPassScreen} options={{ title: 'Mina pass' }} />
      <Stack.Screen name="SchemaDetalj" component={SchemaDetaljScreen} options={{ title: 'Schema' }} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
    </Stack.Navigator>
  );
}

function ChattNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ChattLista" component={ChattListaScreen} options={{ title: 'Chattar' }} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
      <Stack.Screen name="Betygsatt" component={BetygsattScreen} options={{ title: 'Betygsätt' }} />
      <Stack.Screen name="JobbAnsokningar" component={JobbAnsokningarScreen} options={({ route }) => ({ title: route.params?.titel ?? 'Ansökningar' })} />
    </Stack.Navigator>
  );
}

function ProfilNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="ProfilHuvud" component={ProfilScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="RedigeraProfil" component={RedigeraProfilScreen} options={{ title: 'Redigera profil' }} />
      <Stack.Screen name="SchemaKalender" component={SchemaKalenderScreen} options={{ title: 'Schemaöversikt' }} />
      {/* Kalenderns passkort öppnar schemat, och SchemaDetalj har i sin tur en
          redigeraknapp – båda måste finnas i den här stacken, annars leder de ingenstans.
          Redigeringen är fortfarande oåtkomlig för privatpersoner: ingången till kalendern
          är gated på !ärPrivatperson i ProfilScreen, och redigeraknappen renderas bara
          när ärFöretag. */}
      <Stack.Screen name="SchemaDetalj" component={SchemaDetaljScreen} options={{ title: 'Schema' }} />
      <Stack.Screen name="RedigeraSchema" component={RedigeraSchemaScreen} options={{ title: 'Redigera schema' }} />
      {/* Sökandelistan i SchemaDetalj är klickbar, och schemat nås härifrån via
          Schemaöversikt – utan registreringen leder namnet ingenstans i den här stacken. */}
      <Stack.Screen name="SökanadeProfil" component={SökandeProfilScreen} options={{ title: 'Sökandes profil' }} />
    </Stack.Navigator>
  );
}

function MinaJobbNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="MinaJobb" component={MinaJobbScreen} options={{ title: 'Mina annonser' }} />
      <Stack.Screen name="SchemaDetalj" component={SchemaDetaljScreen} options={{ title: 'Schema' }} />
      {/* Bara i företagets navigator – privatpersonernas vägar till SchemaDetalj ska inte
          kunna nå redigeringen. */}
      <Stack.Screen name="RedigeraSchema" component={RedigeraSchemaScreen} options={{ title: 'Redigera schema' }} />
      <Stack.Screen name="RedigeraJobb" component={RedigeraJobbScreen} options={{ title: 'Redigera annons' }} />
      <Stack.Screen name="JobbAnsokningar" component={JobbAnsokningarScreen} options={({ route }) => ({ title: route.params?.titel ?? 'Ansökningar' })} />
      <Stack.Screen name="SökanadeProfil" component={SökandeProfilScreen} options={{ title: 'Sökandes profil' }} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
      <Stack.Screen name="Betygsatt" component={BetygsattScreen} options={{ title: 'Betygsätt' }} />
    </Stack.Navigator>
  );
}

function PubliceraNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <ChatKnapp navigation={navigation} />,
      })}
    >
      <Stack.Screen name="PubliceraJobb" component={PubliceraJobbScreen} options={{ title: 'Publicera jobb' }} />
      <Stack.Screen name="PubliceraSchema" component={PubliceraSchemaScreen} options={{ title: 'Publicera schema' }} />
    </Stack.Navigator>
  );
}

function RapporterNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RapporterHuvud" component={RapporterScreen} options={{ title: 'Tidrapporter' }} />
      <Stack.Screen name="SökanadeProfil" component={SökandeProfilScreen} options={{ title: 'Sökandes profil' }} />
      <Stack.Screen name="FöretagsProfil" component={FöretagsProfilScreen} options={{ title: 'Företagsprofil' }} />
      <Stack.Screen name="JobbDetalj" component={JobbDetaljScreen} options={{ title: 'Jobbdetaljer' }} />
    </Stack.Navigator>
  );
}

function HuvudNavigator() {
  const { användare, återhämtaAnvändare } = useAuth();
  const { uppdateraOlästa } = useNotifikationer();
  const { antalAttAvsluta, antalNyaAnsökningar, uppdateraAttAvsluta } = useAttAvsluta();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const ärFöretag = användare?.typ === 'företag';
  const ärAdmin = användare?.email === 'info@fastgig.se';

  // Välkomstruta som visas en gång direkt efter att en ny privatperson kommit in i appen
  const [visaVälkomst, setVisaVälkomst] = useState(false);

  // Räknar om antalet olästa (röd prick + badge på chattikonen) från servern.
  const laddaOlästa = useCallback(async () => {
    if (!användare?.id) return;
    try {
      const data = await api.hämtaKonversationer();
      uppdateraOlästa(data, användare.id);
    } catch {}
  }, [användare?.id, uppdateraOlästa]);

  // Initialisera badge-räknaren direkt vid inloggning, innan chattlistan öppnats
  useEffect(() => { laddaOlästa(); }, [laddaOlästa]);

  // Seed:a antalet pass som behöver avslutas direkt vid inloggning, så badgen syns
  // även innan företaget öppnat Mina jobb-fliken.
  useEffect(() => {
    if (ärFöretag) uppdateraAttAvsluta();
  }, [användare?.id, ärFöretag]);

  // Äkta realtid: en signal (utan innehåll) på användarens privata kanal räknar om olästa
  // (och pass-att-avsluta för företag) direkt när något nytt skapats i databasen.
  useRealtidsPing((payload) => {
    laddaOlästa();
    if (ärFöretag) uppdateraAttAvsluta();
    // Admin har godkänt avtalet: hämta om profilen så att avtalGodkant blir true
    // och "Avtal krävs"-spärren släpper direkt, utan omstart. Bara denna typ
    // triggar en profilhämtning – vanliga pings (meddelande, tidrapport) ska inte.
    if (payload?.typ === 'avtal') återhämtaAnvändare();
  });

  // Fallback vid förgrund: om realtidskopplingen tappats medan appen legat i bakgrunden
  // (vanligt på mobil) hämtas färskt läge direkt när appen öppnas igen.
  useEffect(() => {
    const prenumeration = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      laddaOlästa();
      if (ärFöretag) uppdateraAttAvsluta();
      // Täcker fallet att admin godkände avtalet medan appen låg i bakgrunden och
      // realtidspingen missades: hämta om profilen när appen väcks.
      if (ärPrivatperson) återhämtaAnvändare();
    });
    return () => prenumeration.remove();
  }, [laddaOlästa, ärFöretag, ärPrivatperson, uppdateraAttAvsluta, återhämtaAnvändare]);

  // Kolla om välkomstrutan ska visas (flagga sätts vid e-postverifiering)
  useEffect(() => {
    async function kollaVälkomst() {
      const flagga = await AsyncStorage.getItem('visaVälkomst');
      if (flagga === 'true') setVisaVälkomst(true);
    }
    kollaVälkomst();
  }, []);

  async function stängVälkomst() {
    await AsyncStorage.removeItem('visaVälkomst');
    setVisaVälkomst(false);
  }

  return (
    <>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ color, size, focused }) => {
          const ikoner = {
            JobbTab:        focused ? 'briefcase'       : 'briefcase-outline',
            AnsökningarTab: focused ? 'document-text'  : 'document-text-outline',
            MinaPassTab:    focused ? 'time'            : 'time-outline',
            MinaJobbTab:    focused ? 'list'            : 'list-outline',
            PubliceraTab:   focused ? 'add-circle'      : 'add-circle-outline',
            RapporterTab:   focused ? 'bar-chart'       : 'bar-chart-outline',
            Profil:         focused ? 'person'          : 'person-outline',
          };
          return <Ionicons name={ikoner[route.name]} size={size} color={color} />;
        },
      })}
    >
      {ärPrivatperson && (
        <Tab.Screen name="JobbTab" component={JobbNavigator} options={{ tabBarLabel: 'Jobb' }} />
      )}
      {ärPrivatperson && (
        <Tab.Screen name="AnsökningarTab" component={AnsökningarNavigator} options={{ tabBarLabel: 'Ansökningar' }} />
      )}
      {ärPrivatperson && (
        <Tab.Screen name="MinaPassTab" component={MinaPassNavigator} options={{ tabBarLabel: 'Mina pass' }} />
      )}
      {ärFöretag && (
        <Tab.Screen
          name="MinaJobbTab"
          component={MinaJobbNavigator}
          options={{
            tabBarLabel: 'Mina annonser',
            // Summan av saker att hantera på Mina jobb: pass att avsluta + nya ansökningar.
            tabBarBadge: (antalAttAvsluta + antalNyaAnsökningar) > 0
              ? ((antalAttAvsluta + antalNyaAnsökningar) > 9 ? '9+' : (antalAttAvsluta + antalNyaAnsökningar))
              : undefined,
            tabBarBadgeStyle: { backgroundColor: '#ea580c' },
          }}
        />
      )}
      {ärFöretag && (
        <Tab.Screen name="PubliceraTab" component={PubliceraNavigator} options={{ tabBarLabel: 'Publicera' }} />
      )}
      <Tab.Screen
        name="ChattTab"
        component={ChattNavigator}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {ärAdmin && (
        <Tab.Screen name="RapporterTab" component={RapporterNavigator} options={{ tabBarLabel: 'Rapporter' }} />
      )}
      <Tab.Screen name="Profil" component={ProfilNavigator} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>

    <Modal visible={visaVälkomst} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.välkomstÖverlägg}>
        <View style={styles.välkomstRuta}>
          <Text style={styles.välkomstRubrik}>Välkommen till FastGig!</Text>
          <Text style={styles.välkomstText}>
            Du kommer inom 24 timmar att få ett anställningsavtal skickat till din mejl.
            Du behöver signera avtalet innan du kan söka jobb.
          </Text>
          <TouchableOpacity style={styles.välkomstKnapp} onPress={stängVälkomst}>
            <Text style={styles.välkomstKnappText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  välkomstÖverlägg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  välkomstRuta: { backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center' },
  välkomstRubrik: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  välkomstText: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  välkomstKnapp: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  välkomstKnappText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

const badgeStyles = StyleSheet.create({
  // Padding + hitSlop ger en stor, förlåtande tryckyta runt ikonen
  knapp: {
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  // Centrerar ikonen helt – ingen inramning/bakgrund
  ikonYta: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

const laddningsStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  // resizeMode 'contain' i JSX:en gör att märket behåller sina proportioner även om
  // filen inte är kvadratisk – rutan här är bara en övre gräns.
  logga: { width: 96, height: 96, marginBottom: 20 },
  logotyp: { fontSize: 52, fontWeight: 'bold', color: '#2563eb', letterSpacing: -1, marginBottom: 8 },
  tagline: { fontSize: 15, color: '#9ca3af' },
});

export default function Navigation() {
  const { användare, laddar } = useAuth();
  const [visaSplash, setVisaSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisaSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (laddar || visaSplash) {
    return (
      <View style={laddningsStyles.container}>
        <Image
          source={require('../../assets/logotyp.png')}
          style={laddningsStyles.logga}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={laddningsStyles.logotyp}>FastGig</Text>
        <Text style={laddningsStyles.tagline}>Flexibla jobb, enkelt</Text>
      </View>
    );
  }

  return (
    // Bannern ligger utanför NavigationContainer och överlever därför skärmbyten.
    // Den renderas efter navigationen så att den hamnar överst i staplingsordningen.
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {användare ? <HuvudNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <OfflineBanner />
    </View>
  );
}
