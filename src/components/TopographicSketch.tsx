import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

/**
 * TopographicSketch — A living, evolving background for The Desk.
 * Mimics map lines being slowly sketched and shifting.
 */
export const TopographicSketch = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SketchLine delay={0} size={width * 1.2} top={-100} left={-50} rotate={15} />
      <SketchLine delay={2000} size={width * 1.5} top={height / 3} right={-100} rotate={-10} />
      <SketchLine delay={4000} size={width * 0.9} bottom={-50} left={20} rotate={45} />
      <SketchLine delay={6000} size={width * 1.8} top={height / 2} left={-200} rotate={160} />
    </View>
  );
};

const SketchLine = ({ delay, size, ...pos }: any) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Very slow, infinite pulsing "sketch" loop
    progress.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    ));
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.5, 1], [0.03, 0.08, 0.04]),
      transform: [
        { scale: interpolate(progress.value, [0, 1], [0.98, 1.02]) },
        { rotate: `${pos.rotate || 0}deg` }
      ],
    };
  });

  return (
    <Animated.View 
      style={[
        styles.line, 
        { width: size, height: size, borderRadius: size * 0.4 }, // More irregular "natural" shape
        pos,
        animatedStyle
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    borderWidth: 1, // Subtle contour line
    borderColor: theme.colors.textPrimary, // Ink Black
    borderStyle: 'solid',
  },
});
