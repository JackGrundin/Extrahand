import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotifikationsProvider } from './src/context/NotifikationsContext';
import { AttAvslutaProvider } from './src/context/AttAvslutaContext';
import { RealtidsProvider } from './src/context/RealtidsContext';
import { AnslutningsProvider } from './src/context/AnslutningsContext';
import { BetygsProvider } from './src/context/BetygsContext';
import Navigation from './src/navigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert ersattes i SDK 57 av shouldShowBanner + shouldShowList.
    shouldShowBanner: true,
    shouldShowList: true,
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
                {/* Innanför RealtidsProvider: betygsprompten lyssnar på tidrapport-pingen.
                    Den renderar en Modal utanför navigatorn, vilket är det som gör att
                    popupen kan komma upp oavsett vilken flik eller skärm man står på. */}
                <BetygsProvider>
                  <StatusBar style="auto" />
                  <Navigation />
                </BetygsProvider>
              </RealtidsProvider>
            </AttAvslutaProvider>
          </NotifikationsProvider>
        </AuthProvider>
      </AnslutningsProvider>
    </SafeAreaProvider>
  );
}
