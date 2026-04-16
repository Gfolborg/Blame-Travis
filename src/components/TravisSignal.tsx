import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';

export type TravisStatus = 'idle' | 'thinking' | 'alert' | 'tracking';

interface TravisSignalProps {
  status?: TravisStatus;
  size?: number;
}

/**
 * TravisSignal — The visual anchor for Travis.
 * Represents his presence and current 'mental' state.
 */
export const TravisSignal: React.FC<TravisSignalProps> = ({ 
  status = 'idle', 
  size = 40 
}) => {
  const opacity = useSharedValue(0.6);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Reset values on status change
    opacity.value = 0.6;
    scale.value = 1;

    let duration = 2000;
    let pulseScale = 1.2;

    if (status === 'thinking') {
      duration = 800;
      pulseScale = 1.4;
    } else if (status === 'alert') {
      duration = 400;
      pulseScale = 1.5;
    } else if (status === 'tracking') {
      duration = 1500;
      pulseScale = 1.3;
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withTiming(pulseScale, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const getStatusColor = () => {
    switch (status) {
      case 'alert':
        return theme.colors.error;
      case 'tracking':
        return theme.colors.success;
      case 'thinking':
        return theme.colors.primary;
      case 'idle':
      default:
        return theme.colors.primary;
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.outerCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: getStatusColor(),
          },
          animatedStyle,
        ]}
      />
      <View
        style={[
          styles.innerCircle,
          {
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: (size * 0.6) / 2,
            backgroundColor: getStatusColor(),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    position: 'absolute',
    opacity: 0.4,
  },
  innerCircle: {
    opacity: 1,
    borderWidth: 2,
    borderColor: 'rgba(28, 28, 30, 0.1)',
  },
});
