import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AdventureProvider } from './src/hooks/useAdventure';
import { ProfileProvider } from './src/hooks/useProfile';
import { NoticeProvider } from './src/components/TravisNotice';
import { notificationsService } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    // Initialize notifications
    notificationsService.registerForPushNotificationsAsync();
    // Schedule idle nudge (repeats every 3 days)
    notificationsService.scheduleIdleNudge();
  }, []);

  return (
    <SafeAreaProvider>
      <NoticeProvider>
        <ProfileProvider>
          <AdventureProvider>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </AdventureProvider>
        </ProfileProvider>
      </NoticeProvider>
    </SafeAreaProvider>
  );
}
