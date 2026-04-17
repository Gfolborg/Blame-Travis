import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AdventureProvider } from './src/hooks/useAdventure';
import { ProfileProvider } from './src/hooks/useProfile';
import { NoticeProvider } from './src/components/TravisNotice';
import { NotificationCoordinator } from './src/components/NotificationCoordinator';
import { navigationRef } from './src/navigation/navigationRef';

export default function App() {
  return (
    <SafeAreaProvider>
      <NoticeProvider>
        <ProfileProvider>
          <AdventureProvider>
            <NavigationContainer ref={navigationRef}>
              <NotificationCoordinator />
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </AdventureProvider>
        </ProfileProvider>
      </NoticeProvider>
    </SafeAreaProvider>
  );
}
