import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { TabNavigator } from './TabNavigator';
import SplashScreen from '../screens/SplashScreen';
import AdventureRequestScreen from '../screens/AdventureRequestScreen';
import AdventureAssignmentScreen from '../screens/AdventureAssignmentScreen';
import AdventureRevealScreen from '../screens/AdventureRevealScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
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
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
