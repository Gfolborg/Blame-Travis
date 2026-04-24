import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring, 
  withSequence,
  withDelay,
  Easing
} from 'react-native-reanimated';
import { theme } from '../theme';

const SplashScreen = () => {
  const navigation = useNavigation();
  
  // Animation Shared Values
  const bgScale = useSharedValue(0.8);
  const bgRotate = useSharedValue(-5);
  const bgOpacity = useSharedValue(0);
  
  const logoScale = useSharedValue(4);
  const logoOpacity = useSharedValue(0);
  
  const shakeOffset = useSharedValue(0);
  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Unfold the "Map" (Background)
    bgOpacity.value = withTiming(1, { duration: 600 });
    bgScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    bgRotate.value = withSpring(0, { damping: 15, stiffness: 100 });

    // 2. The Stamp Impact (Logo) - Hard hit, no bounce
    // Wait for the map to start unfolding, then slam the stamp
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 50 }));
    logoScale.value = withDelay(400, withTiming(1, { 
      duration: 150,
      easing: Easing.in(Easing.quad)
    }));


    // 3. Trigger the Impact Vibration (Shake)
    // Sync with the exact moment the logo hits (approx 500ms in)
    shakeOffset.value = withDelay(500, withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-7, { duration: 40 }),
      withTiming(7, { duration: 40 }),
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(0, { duration: 40 })
    ));

    // 4. Reveal the Footer
    footerOpacity.value = withDelay(800, withTiming(1, { duration: 1000 }));

    // Navigate to MainTabs after delay
    const timer = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        })
      );
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigation, bgOpacity, bgRotate, bgScale, footerOpacity, logoOpacity, logoScale, shakeOffset]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [
      { scale: bgScale.value },
      { rotate: `${bgRotate.value}deg` }
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeOffset.value }
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.background, bgStyle]}>
        {/* Topographic Motif Placeholder */}
        <View style={styles.topoLayer} />
      </Animated.View>

      <Animated.View style={[styles.content, contentStyle]}>
        <Animated.View style={logoStyle}>
          <Image 
            source={require('../../assets/brand/Blame_Travis_Logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        
        <Animated.View style={[styles.textContainer, footerStyle]}>
          <Text style={styles.subtitle}>PASSPORT & ITINERARY</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.footer, footerStyle]}>
        <Text style={styles.loadingText}>STAMPING ITINERARY...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D1CEC7', // Slightly darker "desk" color before map unfolds
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background, // Parchment/Paper
  },
  topoLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    borderWidth: 2,
    borderColor: theme.colors.textPrimary,
    borderRadius: 20,
    margin: 20,
    borderStyle: 'dashed',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 450,
    height: 450,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: -60,
  },
  subtitle: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 5,
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontStyle: 'italic',
  },
});



export default SplashScreen;
