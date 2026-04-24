import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '../types/navigation';
import HomeScreen from '../screens/HomeScreen';
import JourneysScreen from '../screens/JourneysScreen';
import PassportScreen from '../screens/PassportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { theme } from '../theme';
import { isFeatureEnabled } from '../config/featureFlags';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator = () => {
  const exploreEnabled = isFeatureEnabled('explore_search_v1_enabled');

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.textPrimary, // Ink Black
          borderTopWidth: 0,
          height: 85,
          paddingBottom: 20,
        },
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = exploreEnabled ? (focused ? 'compass' : 'compass-outline') : (focused ? 'journal' : 'journal-outline');
              break;
            case 'Journeys':
              iconName = focused ? 'map' : 'map-outline';
              break;
            case 'Passport':
              iconName = focused ? 'book' : 'book-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle-sharp';
          }

          return (
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={iconName} 
                size={26} 
                color={focused ? theme.colors.surface : 'rgba(244, 239, 230, 0.5)'} 
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          );
        },
      })}
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

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 60,
  },
  activeIndicator: {
    width: 20,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    position: 'absolute',
    bottom: 12,
  },
});
