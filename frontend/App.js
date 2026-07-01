import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { NotifikationsProvider } from './src/context/NotifikationsContext';
import { AttAvslutaProvider } from './src/context/AttAvslutaContext';
import { RealtidsProvider } from './src/context/RealtidsContext';
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
  );
}
