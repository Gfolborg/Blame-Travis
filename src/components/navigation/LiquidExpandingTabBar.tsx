import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from '../../types/navigation';
import { theme } from '../../theme';

type TabRouteName = keyof MainTabParamList;

interface LiquidExpandingTabBarProps extends BottomTabBarProps {
  exploreEnabled: boolean;
}

interface TabVisualConfig {
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  fallbackLabel: string;
}

interface LiquidTabItemProps {
  index: number;
  routeCount: number;
  slotWidth: number;
  activePillWidth: number;
  inactivePillWidth: number;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  progress: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

const resolveVisualConfig = (routeName: TabRouteName, exploreEnabled: boolean): TabVisualConfig => {
  switch (routeName) {
    case 'Home':
      return {
        activeIcon: exploreEnabled ? 'compass' : 'journal',
        inactiveIcon: exploreEnabled ? 'compass-outline' : 'journal-outline',
        fallbackLabel: exploreEnabled ? 'Explore' : 'The Desk',
      };
    case 'Journeys':
      return { activeIcon: 'map', inactiveIcon: 'map-outline', fallbackLabel: 'Journeys' };
    case 'Passport':
      return { activeIcon: 'book', inactiveIcon: 'book-outline', fallbackLabel: 'Passport' };
    case 'Profile':
      return { activeIcon: 'person', inactiveIcon: 'person-outline', fallbackLabel: 'Profile' };
    default:
      return { activeIcon: 'help-circle', inactiveIcon: 'help-circle-outline', fallbackLabel: 'Tab' };
  }
};

const LiquidTabItem = ({
  index,
  routeCount,
  slotWidth,
  activePillWidth,
  inactivePillWidth,
  label,
  activeIcon,
  inactiveIcon,
  isFocused,
  progress,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: LiquidTabItemProps) => {
  const labelMaxWidth = Math.max(activePillWidth - 12, 0);

  const itemStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    const focus = 1 - Math.min(distance, 1);
    const edgeExpansion = Math.max((activePillWidth - slotWidth) / 2, 0);
    const edgeShift =
      index === 0 ? edgeExpansion : index === routeCount - 1 ? -edgeExpansion : 0;

    return {
      width: interpolate(focus, [0, 1], [inactivePillWidth, activePillWidth]),
      transform: [{ translateX: interpolate(focus, [0, 1], [0, edgeShift]) }],
    };
  }, [index, activePillWidth, inactivePillWidth, routeCount, slotWidth]);

  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    const focus = 1 - Math.min(distance, 1);

    return {
      opacity: focus,
      maxWidth: interpolate(focus, [0, 1], [0, labelMaxWidth]),
      maxHeight: interpolate(focus, [0, 1], [0, 14]),
      marginTop: interpolate(focus, [0, 1], [0, 2]),
      transform: [{ translateY: interpolate(focus, [0, 1], [3, 0]) }],
    };
  }, [index, labelMaxWidth]);

  const activeIconStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    const focus = 1 - Math.min(distance, 1);

    return {
      opacity: focus,
    };
  }, [index]);

  const inactiveIconStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    const focus = 1 - Math.min(distance, 1);

    return {
      opacity: 1 - focus,
    };
  }, [index]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.slot, { width: slotWidth, zIndex: isFocused ? 3 : 1, elevation: isFocused ? 2 : 0 }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View style={[styles.itemPill, itemStyle]}>
        <View style={styles.iconStack}>
          <Animated.View style={[styles.iconLayer, inactiveIconStyle]}>
            <Ionicons
              name={inactiveIcon}
              size={theme.navigation.bottomTab.iconSize}
              color="rgba(244, 239, 230, 0.58)"
            />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, activeIconStyle]}>
            <Ionicons
              name={activeIcon}
              size={theme.navigation.bottomTab.iconSize}
              color={theme.colors.textPrimary}
            />
          </Animated.View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.itemLabel, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

export const LiquidExpandingTabBar = ({
  state,
  descriptors,
  navigation,
  exploreEnabled,
}: LiquidExpandingTabBarProps) => {
  const insets = useSafeAreaInsets();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  const progress = useSharedValue(state.index);
  const wavePulse = useSharedValue(0);

  const routeCount = state.routes.length || 1;
  const slotWidth =
    layoutWidth > 0 ? layoutWidth / routeCount : theme.navigation.bottomTab.slotWidthFallback;
  const activePillWidth = Math.max(
    72,
    Math.min(theme.navigation.bottomTab.activePillWidth, slotWidth * 1.2),
  );
  const inactivePillWidth = Math.min(theme.navigation.bottomTab.inactivePillWidth, activePillWidth);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => {
        // If the query fails, keep default animations enabled.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      progress.value = state.index;
      wavePulse.value = 0;
      return;
    }

    progress.value = withSpring(state.index, {
      damping: theme.navigation.motion.springDamping,
      stiffness: theme.navigation.motion.springStiffness,
      mass: theme.navigation.motion.springMass,
    });

    wavePulse.value = 0;
    wavePulse.value = withSequence(
      withTiming(1, {
        duration: theme.navigation.motion.wavePulseInMs,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: theme.navigation.motion.wavePulseOutMs,
        easing: Easing.inOut(Easing.quad),
      }),
    );
  }, [progress, reduceMotionEnabled, state.index, wavePulse]);

  const handleDockLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLayoutWidth(width);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const baseX = slotWidth * progress.value + (slotWidth - activePillWidth) / 2;
    const minX = 4;
    const maxX = Math.max(minX, layoutWidth - activePillWidth - 4);
    const clampedX = Math.max(minX, Math.min(baseX, maxX));
    const pulse = wavePulse.value;

    return {
      width: activePillWidth,
      height: theme.navigation.bottomTab.activePillHeight,
      borderRadius: interpolate(
        pulse,
        [0, 1],
        [theme.navigation.bottomTab.activePillHeight / 2, theme.navigation.bottomTab.activePillHeight * 0.38],
      ),
      transform: [
        { translateX: clampedX },
        { scaleX: interpolate(pulse, [0, 1], [1, 1.08]) },
        { scaleY: interpolate(pulse, [0, 1], [1, 0.9]) },
      ],
    };
  }, [activePillWidth, layoutWidth, slotWidth]);

  const haloStyle = useAnimatedStyle(() => {
    const baseX = slotWidth * progress.value + (slotWidth - activePillWidth) / 2;
    const minX = 4;
    const maxX = Math.max(minX, layoutWidth - activePillWidth - 4);
    const clampedX = Math.max(minX, Math.min(baseX, maxX));
    const pulse = wavePulse.value;

    return {
      width: activePillWidth + 6,
      height: theme.navigation.bottomTab.activePillHeight + 6,
      borderRadius: (theme.navigation.bottomTab.activePillHeight + 6) / 2,
      opacity: interpolate(pulse, [0, 0.35, 1], [0.18, 0.26, 0.14]),
      transform: [
        { translateX: clampedX - 3 + interpolate(pulse, [0, 1], [0, 4]) },
        { scaleX: interpolate(pulse, [0, 1], [1, 1.14]) },
        { scaleY: interpolate(pulse, [0, 1], [1, 0.92]) },
      ],
    };
  }, [activePillWidth, layoutWidth, slotWidth]);

  const tabs = useMemo(
    () =>
      state.routes.map((route, index) => {
        const routeName = route.name as TabRouteName;
        const options = descriptors[route.key].options;
        const visuals = resolveVisualConfig(routeName, exploreEnabled);
        const isFocused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : typeof options.title === 'string'
              ? options.title
              : visuals.fallbackLabel;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <LiquidTabItem
            key={route.key}
            index={index}
            routeCount={routeCount}
            slotWidth={slotWidth}
            activePillWidth={activePillWidth}
            inactivePillWidth={inactivePillWidth}
            label={label}
            activeIcon={visuals.activeIcon}
            inactiveIcon={visuals.inactiveIcon}
            isFocused={isFocused}
            progress={progress}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label} tab`}
            testID={options.tabBarButtonTestID}
          />
        );
      }),
    [
      activePillWidth,
      descriptors,
      exploreEnabled,
      inactivePillWidth,
      navigation,
      progress,
      routeCount,
      slotWidth,
      state.index,
      state.routes,
    ],
  );

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, theme.navigation.bottomTab.dockBottomInset),
          paddingTop: theme.navigation.bottomTab.dockTopInset,
          paddingHorizontal: theme.navigation.bottomTab.dockHorizontalInset,
        },
      ]}
    >
      <View style={styles.dock} onLayout={handleDockLayout}>
        <Animated.View pointerEvents="none" style={[styles.liquidHalo, haloStyle]} />
        <Animated.View pointerEvents="none" style={[styles.liquidCore, indicatorStyle]} />
        {tabs}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  dock: {
    height: theme.navigation.bottomTab.dockHeight,
    borderRadius: theme.navigation.bottomTab.dockRadius,
    backgroundColor: theme.colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  liquidCore: {
    position: 'absolute',
    top: (theme.navigation.bottomTab.dockHeight - theme.navigation.bottomTab.activePillHeight) / 2,
    backgroundColor: 'rgba(249, 249, 251, 0.94)',
  },
  liquidHalo: {
    position: 'absolute',
    top: (theme.navigation.bottomTab.dockHeight - (theme.navigation.bottomTab.activePillHeight + 6)) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  slot: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPill: {
    height: theme.navigation.bottomTab.activePillHeight,
    borderRadius: theme.navigation.bottomTab.activePillHeight / 2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
  },
  iconStack: {
    width: theme.navigation.bottomTab.iconSize,
    height: theme.navigation.bottomTab.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.navigation.bottomTab.iconSize,
    height: theme.navigation.bottomTab.iconSize,
  },
  itemLabel: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
    overflow: 'hidden',
  },
});

export default LiquidExpandingTabBar;
