import React from 'react';
import LegacyDeskHomeScreen from './LegacyDeskHomeScreen';
import ExploreScreen from './ExploreScreen';
import { isFeatureEnabled } from '../config/featureFlags';

const HomeScreen = () => {
  if (isFeatureEnabled('explore_search_v1_enabled')) {
    return <ExploreScreen />;
  }

  return <LegacyDeskHomeScreen />;
};

export default HomeScreen;
