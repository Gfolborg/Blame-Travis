import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing
} from 'react-native-reanimated';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { theme } from '../theme';

const { width } = Dimensions.get('window');
const SIZE = width * 0.85; // Emblem watermark

/**
 * CompassRose — A majestic, slowly rotating watermark.
 * Replaces the busy topographic lines with a classic exploration motif.
 */
export const CompassRose = () => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Incredibly slow, continuous rotation (3 minutes per full circle)
    rotation.value = withRepeat(
      withTiming(360, { duration: 180000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` }
      ],
    };
  });

  const color = theme.colors.textPrimary;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.wrapper, animatedStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
          <G fill="none" stroke={color} strokeWidth="1" transform="translate(100, 100)">
            {/* Outer Rings */}
            <Circle r="90" strokeWidth="1.5" />
            <Circle r="84" strokeWidth="0.5" strokeDasharray="3, 3" />
            <Circle r="78" strokeWidth="0.5" />
            <Circle r="45" strokeWidth="0.5" />
            
            {/* Minor Points (NE, SE, SW, NW) */}
            <Path d="M 0 -65 L 12 0 L 0 65 L -12 0 Z" fill={color} opacity="0.15" transform="rotate(45)" />
            <Path d="M 0 -65 L 12 0 L 0 65 L -12 0 Z" fill={color} opacity="0.15" transform="rotate(-45)" />
            
            {/* Major Points (N, S, E, W) */}
            <Path d="M 0 -95 L 18 0 L 0 95 L -18 0 Z" fill={color} opacity="0.25" />
            <Path d="M 0 -95 L 18 0 L 0 95 L -18 0 Z" fill={color} opacity="0.25" transform="rotate(90)" />

            {/* Crosshairs */}
            <Path d="M 0 -100 L 0 100 M -100 0 L 100 0" stroke={color} strokeWidth="0.5" opacity="0.5" />

            {/* Center detailing */}
            <Circle r="12" fill={theme.colors.background} stroke={color} strokeWidth="1" />
            <Circle r="3" fill={color} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.05, // Barely visible, elegant watermark
  },
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
