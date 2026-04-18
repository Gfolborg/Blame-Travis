import React, { useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';

interface InkBleedItemProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  animationKey?: string;
}

const revealedKeys = new Set<string>();

/**
 * InkBleedItem — A tactile reveal animation.
 * Mimics ink soaking into paper: starts faint/blurry and settles into sharp/dark.
 */
const InkBleedItemComponent: React.FC<InkBleedItemProps> = ({ 
  children, 
  delay = 0, 
  duration = 800,
  animationKey,
}) => {
  const hasAnimated = !!animationKey && revealedKeys.has(animationKey);
  const progress = useSharedValue(hasAnimated ? 1 : 0);

  useEffect(() => {
    if (animationKey && revealedKeys.has(animationKey)) {
      progress.value = 1;
      return;
    }

    progress.value = withDelay(delay, withTiming(1, { 
      duration, 
      easing: Easing.out(Easing.quad) 
    }));
    if (animationKey) {
      revealedKeys.add(animationKey);
    }
  }, [animationKey, delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        { scale: interpolate(progress.value, [0, 1], [1.02, 1]) },
        { translateY: interpolate(progress.value, [0, 1], [5, 0]) }
      ],
      // Subtle jitter to simulate ink spreading
      filter: [
        { blur: interpolate(progress.value, [0, 0.8, 1], [5, 2, 0]) }
      ] as any
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
};

export const InkBleedItem = React.memo(InkBleedItemComponent);
