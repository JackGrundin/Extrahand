import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoggaInScreen from '../screens/LoggaInScreen';
import RegistreraScreen from '../screens/RegistreraScreen';
import JobbScreen from '../screens/JobbScreen';
import JobbDetaljScreen from '../screens/JobbDetaljScreen';
import ProfilScreen from '../screens/ProfilScreen';
import MinaAnsokningarScreen from '../screens/MinaAnsokningarScreen';
import ChattScreen from '../screens/ChattScreen';
import PubliceraJobbScreen from '../screens/PubliceraJobbScreen';
import JobbAnsokningarScreen from '../screens/JobbAnsokningarScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
    <Stack.Navigator>
      <Stack.Screen name="Jobb" component={JobbScreen} options={{ title: 'Lediga jobb' }} />
      <Stack.Screen name="JobbDetalj" component={JobbDetaljScreen} options={{ title: 'Jobbdetaljer' }} />
      <Stack.Screen name="JobbAnsokningar" component={JobbAnsokningarScreen} options={({ route }) => ({ title: route.params?.titel ?? 'Ansökningar' })} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
    </Stack.Navigator>
  );
}

function AnsökningarNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MinaAnsokningar" component={MinaAnsokningarScreen} options={{ title: 'Mina ansökningar' }} />
      <Stack.Screen name="Chatt" component={ChattScreen} options={{ title: 'Chatt' }} />
    </Stack.Navigator>
  );
}

function PubliceraNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PubliceraJobb" component={PubliceraJobbScreen} options={{ title: 'Publicera jobb' }} />
    </Stack.Navigator>
  );
}

function HuvudNavigator() {
  const { användare } = useAuth();
  const ärPrivatperson = användare?.typ === 'privatperson';
  const ärFöretag = användare?.typ === 'företag';

  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb' }}>
      <Tab.Screen name="JobbTab" component={JobbNavigator} options={{ tabBarLabel: 'Jobb' }} />
      {ärPrivatperson && (
        <Tab.Screen name="AnsökningarTab" component={AnsökningarNavigator} options={{ tabBarLabel: 'Ansökningar' }} />
      )}
      {ärFöretag && (
        <Tab.Screen name="PubliceraTab" component={PubliceraNavigator} options={{ tabBarLabel: 'Publicera' }} />
      )}
      <Tab.Screen name="Profil" component={ProfilScreen} options={{ tabBarLabel: 'Profil', headerShown: true, title: 'Profil' }} />
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
