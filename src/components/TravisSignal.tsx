import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

export type TravisStatus =
  | 'idle'
  | 'thinking'
  | 'alert'
  | 'tracking'
  | 'encourage'
  | 'search'
  | 'celebrate';
export type TravisVariant = 'core' | 'hero';

interface TravisSignalProps {
  status?: TravisStatus;
  size?: number;
  editorial?: boolean; // Kept for API compatibility, though mainly controls shadow now
  variant?: TravisVariant;
}

const ASSET_MAP: Record<TravisVariant, Record<TravisStatus, any>> = {
  core: {
    idle: require('../../assets/travis/travis_idle.png'),
    thinking: require('../../assets/travis/travis_thinking.png'),
    alert: require('../../assets/travis/travis_alert.png'),
    tracking: require('../../assets/travis/travis_tracking.png'),
    encourage: require('../../assets/travis/travis_encourage.png'),
    search: require('../../assets/travis/travis_search.png'),
    celebrate: require('../../assets/travis/travis_celebrate.png'),
  },
  hero: {
    idle: require('../../assets/travis/travis_idle.png'),
    thinking: require('../../assets/travis/travis_thinking.png'),
    alert: require('../../assets/travis/travis_alert.png'), // fallback
    tracking: require('../../assets/travis/travis_tracking.png'),
    encourage: require('../../assets/travis/travis_encourage.png'),
    search: require('../../assets/travis/travis_search.png'),
    celebrate: require('../../assets/travis/travis_celebrate.png'),
  }
};

/**
 * TravisSignal — The visual anchor for Travis.
 * Represents his presence and current 'mental' state using generated character assets.
 */
export const TravisSignal: React.FC<TravisSignalProps> = ({ 
  status = 'idle', 
  size = 40,
  editorial = true,
  variant = 'core'
}) => {
  
  const source = ASSET_MAP[variant][status] || ASSET_MAP['core'][status];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.imageContainer,
          editorial && styles.editorialShadow, // Softer shadow for editorial mode
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Image 
          source={source} 
          style={{ width: '100%', height: '100%' }} 
          resizeMode="cover"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  editorialShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  }
});
