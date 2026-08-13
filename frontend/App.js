import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotifikationsProvider } from './src/context/NotifikationsContext';
import { AttAvslutaProvider } from './src/context/AttAvslutaContext';
import { RealtidsProvider } from './src/context/RealtidsContext';
import { AnslutningsProvider } from './src/context/AnslutningsContext';
import Navigation from './src/navigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  return (
    // SafeAreaProvider ligger ytterst så att offline-bannern, som ritas ovanför
    // navigationen, kan lägga sig under statusfältet i stället för bakom det.
    // Navigatorerna har sin egen inbyggda fallback och påverkas inte av att den
    // finns här.
    <SafeAreaProvider>
      <AnslutningsProvider>
        <AuthProvider>
          <NotifikationsProvider>
            <AttAvslutaProvider>
              <RealtidsProvider>
                <StatusBar style="auto" />
                <Navigation />
              </RealtidsProvider>
            </AttAvslutaProvider>
          </NotifikationsProvider>
        </AuthProvider>
      </AnslutningsProvider>
    </SafeAreaProvider>
  );
}
