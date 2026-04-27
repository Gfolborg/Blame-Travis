import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, BackHandler, Platform, ToastAndroid, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { EBGaramond_400Regular, EBGaramond_500Medium, EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AdventureProvider } from './src/hooks/useAdventure';
import { ProfileProvider } from './src/hooks/useProfile';
import { NoticeProvider } from './src/components/TravisNotice';
import { NotificationCoordinator } from './src/components/NotificationCoordinator';
import { BookingOutcomeCoordinator } from './src/components/BookingOutcomeCoordinator';
import { PassportAutoStampCoordinator } from './src/components/PassportAutoStampCoordinator';
import { navigationRef } from './src/navigation/navigationRef';

const getDeepestActiveRouteName = (state: any): string | undefined => {
  if (!state?.routes?.length) return undefined;
  const route = state.routes[state.index ?? 0];
  if (route?.state) {
    return getDeepestActiveRouteName(route.state);
  }
  return route?.name;
};

export default function App() {
  const lastBackPressAtRef = useRef(0);
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    LogBox.ignoreLogs([
      'SafeAreaView has been deprecated and will be removed in a future release. Please use \'react-native-safe-area-context\' instead.',
    ]);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (!navigationRef.isReady()) return true;

      if (navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }

      const currentRouteName = navigationRef.getCurrentRoute()?.name;
      const activeRouteName = getDeepestActiveRouteName(navigationRef.getRootState()) ?? currentRouteName;

      if (activeRouteName && activeRouteName !== 'Home') {
        navigationRef.navigate('MainTabs', { screen: 'Home' });
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressAtRef.current < 1800) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressAtRef.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);

      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#B71C1C" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NoticeProvider>
          <ProfileProvider>
            <AdventureProvider>
              <NavigationContainer ref={navigationRef}>
                <NotificationCoordinator />
                <BookingOutcomeCoordinator />
                <PassportAutoStampCoordinator />
                <RootNavigator />
                <StatusBar style="dark" />
              </NavigationContainer>
            </AdventureProvider>
          </ProfileProvider>
        </NoticeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
