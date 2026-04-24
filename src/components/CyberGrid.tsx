import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate
} from 'react-native-reanimated';
import Svg, { G, Line } from 'react-native-svg';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

/**
 * CyberGrid — A high-tech, HUD-style animated background.
 * Simulates a scanning satellite grid for the "Scouting" vibe.
 */
export const CyberGrid = () => {
  const scanPos = useSharedValue(0);

  useEffect(() => {
    // Continuous slow scan animation
    scanPos.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [scanPos]);

  const scanLineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: interpolate(scanPos.value, [0, 1], [-100, height + 100]) }],
      opacity: interpolate(scanPos.value, [0, 0.1, 0.9, 1], [0, 0.5, 0.5, 0]),
    };
  });

  const GRID_SIZE = 40;
  const columns = Math.ceil(width / GRID_SIZE) + 1;
  const rows = Math.ceil(height / GRID_SIZE) + 1;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* The Static Grid */}
      <Svg width={width} height={height} style={styles.gridSvg}>
        <G stroke={theme.colors.primary} strokeWidth="0.5" opacity="0.08">
          {[...Array(columns)].map((_, i) => (
            <Line key={`v-${i}`} x1={i * GRID_SIZE} y1="0" x2={i * GRID_SIZE} y2={height} />
          ))}
          {[...Array(rows)].map((_, i) => (
            <Line key={`h-${i}`} x1="0" y1={i * GRID_SIZE} x2={width} y2={i * GRID_SIZE} />
          ))}
        </G>
      </Svg>

      {/* The Animated Scan Line */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* HUD Corner Elements */}
      <View style={[styles.corner, { top: 60, left: 20 }]}>
        <View style={styles.cornerL} />
      </View>
      <View style={[styles.corner, { top: 60, right: 20, transform: [{ rotate: '90deg' }] }]}>
        <View style={styles.cornerL} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  gridSvg: {
    position: 'absolute',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  cornerL: {
    width: 15,
    height: 15,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: theme.colors.primary,
    opacity: 0.4,
  }
});
