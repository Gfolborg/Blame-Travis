import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import HomeScreen from '../screens/HomeScreen';
import JourneysScreen from '../screens/JourneysScreen';
import PassportScreen from '../screens/PassportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { isFeatureEnabled } from '../config/featureFlags';
import { LiquidExpandingTabBar } from '../components/navigation/LiquidExpandingTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator = () => {
  const exploreEnabled = isFeatureEnabled('explore_search_v1_enabled');

  return (
    <Tab.Navigator
      backBehavior="history"
      tabBar={(props) => <LiquidExpandingTabBar {...props} exploreEnabled={exploreEnabled} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: exploreEnabled ? 'Explore' : 'The Desk' }}
      />

      <Tab.Screen name="Journeys" component={JourneysScreen} />
      <Tab.Screen name="Passport" component={PassportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
