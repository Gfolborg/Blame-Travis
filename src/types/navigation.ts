import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Tab Navigator Param List
 */
export type MainTabParamList = {
  Home: undefined;
  Journeys: undefined;
  Passport: undefined;
  Profile: undefined;
};

/**
 * Root Stack Param List (for screens outside the tabs, like details or modal flows)
 */
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AdventureDetails: { AdventureId: string };
  LocationDetails: { locationId: string };
  Settings: undefined;
};

/**
 * Helper Props for screen components
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
