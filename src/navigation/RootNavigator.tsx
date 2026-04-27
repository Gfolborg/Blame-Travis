import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { TabNavigator } from './TabNavigator';
import SplashScreen from '../screens/SplashScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';
import { useProfile } from '../hooks/useProfile';
import { theme } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { loading } = useProfile();

  if (loading) {
    return null; 
  }

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen 
        name="LocationDetails" 
        component={LocationDetailsScreen}
      />
    </Stack.Navigator>
  );
};
