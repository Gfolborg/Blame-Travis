import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { TabNavigator } from './TabNavigator';
import SplashScreen from '../screens/SplashScreen';
import AdventureRequestScreen from '../screens/AdventureRequestScreen';
import AdventureAssignmentScreen from '../screens/AdventureAssignmentScreen';
import AdventureRevealScreen from '../screens/AdventureRevealScreen';
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
        name="AdventureRequest" 
        component={AdventureRequestScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen 
        name="AdventureAssignment" 
        component={AdventureAssignmentScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="AdventureReveal" 
        component={AdventureRevealScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="LocationDetails" 
        component={LocationDetailsScreen}
      />
    </Stack.Navigator>
  );
};
