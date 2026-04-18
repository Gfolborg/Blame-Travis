import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  type SharedValue,
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gyroscope } from 'expo-sensors';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

interface MapBackgroundProps {
  scrollOffset?: SharedValue<number>;
}

const MapBackgroundComponent: React.FC<MapBackgroundProps> = ({ scrollOffset }) => {
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const gyroX = useSharedValue(0);
  const gyroY = useSharedValue(0);

  useEffect(() => {
    // 1. Base Panning
    panX.value = withRepeat(
      withTiming(1, { duration: 60000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    panY.value = withRepeat(
      withTiming(1, { duration: 45000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // 2. Safe Gyroscope Setup
    let subscription: any = null;
    
    const startGyro = async () => {
      try {
        const isAvailable = await Gyroscope.isAvailableAsync();
        if (!isAvailable) return;

        Gyroscope.setUpdateInterval(120);
        subscription = Gyroscope.addListener(data => {
          const sensitivity = 10;
          gyroX.value = withTiming(
            interpolate(data.y, [-2, 2], [-sensitivity, sensitivity], Extrapolation.CLAMP),
            { duration: 180, easing: Easing.out(Easing.quad) }
          );
          gyroY.value = withTiming(
            interpolate(data.x, [-2, 2], [-sensitivity, sensitivity], Extrapolation.CLAMP),
            { duration: 180, easing: Easing.out(Easing.quad) }
          );
        });
      } catch (e) {
        console.log('Gyroscope not available or error occurred:', e);
      }
    };

    startGyro();

    return () => {
      if (subscription) subscription.remove();
    };
  }, [gyroX, gyroY, panX, panY]);

  const animatedStyle = useAnimatedStyle(() => {
    const parallaxTranslateY = scrollOffset 
      ? interpolate(scrollOffset.value, [0, 1000], [0, -60], Extrapolation.CLAMP)
      : 0;

    const totalX = interpolate(panX.value, [0, 1], [-30, 30]) + gyroX.value;
    const totalY = interpolate(panY.value, [0, 1], [-30, 30]) + gyroY.value + parallaxTranslateY;

    return {
      transform: [
        { translateX: totalX },
        { translateY: totalY },
        { scale: 1.15 },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.Image 
        source={require('../../assets/textures/map-texture.png')}
        style={[styles.image, animatedStyle]}
        resizeMode="cover"
      />
    </View>
  );
};

export const MapBackground = React.memo(MapBackgroundComponent);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  image: {
    width: width * 1.5,
    height: height * 1.5,
    opacity: 0.15,
  },
});
