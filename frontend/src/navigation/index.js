import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useNotifikationer } from '../context/NotifikationsContext';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ChatKnapp({ navigation }) {
  const { totalOlästa } = useNotifikationer();
  return (
    <TouchableOpacity
      onPress={() => navigation.getParent()?.navigate('ChattTab')}
      style={{ marginRight: 16 }}
    >
      <View>
        <Ionicons name="chatbubbles-outline" size={24} color="#2563eb" />
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
  const { användare } = useAuth();
  const { uppdateraOlästa } = useNotifikationer();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const ärFöretag = användare?.typ === 'företag';
  const ärAdmin = användare?.email === 'info@fastgig.se';

  // Initialisera badge-räknaren direkt vid inloggning, innan chattlistan öppnats
  useEffect(() => {
    async function initOlästa() {
      try {
        const data = ärFöretag
          ? await api.företagsKonversationer()
          : await api.minaAnsökningar();
        uppdateraOlästa(data, användare?.id);
      } catch {}
    }
    if (användare?.id) initOlästa();
  }, [användare?.id]);

  return (
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
        <Tab.Screen name="MinaJobbTab" component={MinaJobbNavigator} options={{ tabBarLabel: 'Mina annonser' }} />
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
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

const laddningsStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
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
        <Text style={laddningsStyles.logotyp}>FastGig</Text>
        <Text style={laddningsStyles.tagline}>Flexibla jobb, enkelt</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {användare ? <HuvudNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
