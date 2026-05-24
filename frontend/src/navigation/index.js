import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
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
  return (
    <TouchableOpacity
      onPress={() => navigation.getParent()?.navigate('ChattTab')}
      style={{ marginRight: 16 }}
    >
      <Ionicons name="chatbubbles-outline" size={24} color="#2563eb" />
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
    </Stack.Navigator>
  );
}

function HuvudNavigator() {
  const { användare } = useAuth();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const ärFöretag = användare?.typ === 'företag';
  const ärAdmin = användare?.email === 'info@fastgig.se';

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

export default function Navigation() {
  const { användare, laddar } = useAuth();

  if (laddar) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {användare ? <HuvudNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
