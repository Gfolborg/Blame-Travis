import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Easing,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useProfile } from '../hooks/useProfile';
import { navigationRef } from '../navigation/navigationRef';
import { listAchievementDefinitions, passportService } from '../services/passport';
import { PassportAchievement, PassportAchievementDefinition } from '../types/passport';
import { palette, theme } from '../theme';

const GLOBAL_REWARD_SEEN_PREFIX = 'blame_travis:passport_global_reward_seen:v1:';
const INTRO_ROUTE_NAME = 'Splash';
const POST_INTRO_RETRY_MS = 3800;
const CARD_CONTENT_WIDTH = Math.min(Dimensions.get('window').width - 80, 384);

const LOCAL_STAMPS: Record<string, any> = {
  first_stamp: require('../../assets/stamps/first_stamp.png'),
  first_abroad: require('../../assets/stamps/first_abroad.png'),
  places_5: require('../../assets/stamps/places_5.png'),
  places_10: require('../../assets/stamps/places_10.png'),
  places_25: require('../../assets/stamps/places_25.png'),
  places_50: require('../../assets/stamps/places_50.png'),
  places_100: require('../../assets/stamps/places_100.png'),
  countries_2: require('../../assets/stamps/countries_2.png'),
  countries_5: require('../../assets/stamps/countries_5.png'),
  countries_10: require('../../assets/stamps/countries_10.png'),
  days_completed_1: require('../../assets/stamps/days_completed_1.png'),
  days_completed_5: require('../../assets/stamps/days_completed_5.png'),
  days_completed_10: require('../../assets/stamps/days_completed_10.png'),
};

type RewardItem = {
  token: string;
  title: string;
  description: string;
  motivation: string;
  imageSource: any;
};

const toAchievementToken = (achievement: PassportAchievement): string =>
  `${achievement.achievementKey}:${achievement.unlockedAt || 'earned'}`;

const getDeepestActiveRouteName = (state: any): string | undefined => {
  if (!state?.routes?.length) return undefined;
  const route = state.routes[state.index ?? 0];
  if (route?.state) {
    return getDeepestActiveRouteName(route.state);
  }
  return route?.name;
};

const isIntroRouteActive = (): boolean => {
  if (!navigationRef.isReady()) return true;
  const routeName = getDeepestActiveRouteName(navigationRef.getRootState()) ?? navigationRef.getCurrentRoute()?.name;
  return routeName === INTRO_ROUTE_NAME;
};

const getMotivationLine = (definition: PassportAchievementDefinition): string => {
  if (definition.key === 'first_stamp') {
    return "Travis: 'First one down. Passport's officially alive.'";
  }
  if (definition.key === 'first_abroad') {
    return "Travis: 'New border, new bragging rights. Keep moving.'";
  }
  if (definition.group === 'places') {
    return "Travis: 'You are stacking stops like a pro. Keep rolling.'";
  }
  if (definition.group === 'countries') {
    return "Travis: 'Map keeps getting bigger. So does your legend.'";
  }
  return "Travis: 'Chapter stamped. The road still wants more.'";
};

export const PassportAchievementRewardCoordinator: React.FC = () => {
  const { session } = useProfile();
  const [queue, setQueue] = useState<RewardItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [seenTokensHydratedAt, setSeenTokensHydratedAt] = useState(0);
  const seenTokensRef = useRef<Set<string>>(new Set());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hydratingRef = useRef(false);
  const stampScale = useRef(new Animated.Value(1)).current;
  const stampOpacity = useRef(new Animated.Value(1)).current;
  const stampRotation = useRef(new Animated.Value(0)).current;
  const stampTranslateY = useRef(new Animated.Value(0)).current;
  const lastAnimatedTokenRef = useRef<string | null>(null);
  const postIntroRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardPagerRef = useRef<ScrollView | null>(null);
  const userId = session?.user?.id || null;
  const storageKey = `${GLOBAL_REWARD_SEEN_PREFIX}${userId || 'guest'}`;

  const definitionsByKey = useMemo(
    () => new Map<string, PassportAchievementDefinition>(listAchievementDefinitions().map(item => [item.key, item])),
    [],
  );

  const activeItem = queue[activeIndex] || null;

  const primeStampAnimationStart = useCallback(() => {
    stampScale.setValue(3.25);
    stampOpacity.setValue(0);
    stampRotation.setValue(-1.7);
    stampTranslateY.setValue(-24);
  }, [stampOpacity, stampRotation, stampScale, stampTranslateY]);

  const resetStampAnimationEnd = useCallback(() => {
    stampScale.setValue(1);
    stampOpacity.setValue(1);
    stampRotation.setValue(0);
    stampTranslateY.setValue(0);
  }, [stampOpacity, stampRotation, stampScale, stampTranslateY]);

  const hydrateSeenTokens = useCallback(async () => {
    if (!userId) {
      seenTokensRef.current = new Set();
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const tokens = Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : [];
      seenTokensRef.current = new Set(tokens);
    } catch {
      seenTokensRef.current = new Set();
    }
  }, [storageKey, userId]);

  const closeSequence = useCallback(() => {
    lastAnimatedTokenRef.current = null;
    resetStampAnimationEnd();
    setVisible(false);
    setQueue([]);
    setActiveIndex(0);
  }, [resetStampAnimationEnd]);

  const loadQueuedRewards = useCallback(async () => {
    if (!userId || visible || hydratingRef.current) return;
    if (isIntroRouteActive()) {
      if (postIntroRetryRef.current) {
        clearTimeout(postIntroRetryRef.current);
      }
      postIntroRetryRef.current = setTimeout(() => {
        postIntroRetryRef.current = null;
        void loadQueuedRewards();
      }, POST_INTRO_RETRY_MS);
      return;
    }
    hydratingRef.current = true;
    try {
      const snapshot = await passportService.loadSnapshot();
      const candidates = snapshot.achievements
        .map(achievement => {
          const definition = definitionsByKey.get(achievement.achievementKey);
          if (!definition) return null;
          const token = toAchievementToken(achievement);
          if (seenTokensRef.current.has(token)) return null;
          return {
            token,
            title: definition.title,
            description: definition.description,
            motivation: getMotivationLine(definition),
            unlockedAt: achievement.unlockedAt,
            imageSource: LOCAL_STAMPS[definition.key] || null,
          };
        })
        .filter((item): item is RewardItem & { unlockedAt: string } => Boolean(item))
        .sort((a, b) => {
          const aMs = Date.parse(a.unlockedAt);
          const bMs = Date.parse(b.unlockedAt);
          if (Number.isNaN(aMs) || Number.isNaN(bMs)) return a.unlockedAt.localeCompare(b.unlockedAt);
          return aMs - bMs;
        })
        .map(item => ({
          token: item.token,
          title: item.title,
          description: item.description,
          motivation: item.motivation,
          imageSource: item.imageSource,
        }));

      if (!candidates.length) return;
      lastAnimatedTokenRef.current = null;
      rewardPagerRef.current?.scrollTo({ x: 0, animated: false });
      primeStampAnimationStart();
      setQueue(candidates);
      setActiveIndex(0);
      setVisible(true);
    } catch {
      // no-op: avoid blocking app flow if snapshot is unavailable
    } finally {
      hydratingRef.current = false;
    }
  }, [definitionsByKey, primeStampAnimationStart, userId, visible]);

  useEffect(() => {
    let mounted = true;

    const resetAndHydrate = async () => {
      closeSequence();
      await hydrateSeenTokens();
      if (mounted) {
        setSeenTokensHydratedAt(Date.now());
      }
    };

    void resetAndHydrate();

    return () => {
      mounted = false;
    };
  }, [closeSequence, hydrateSeenTokens, userId]);

  useEffect(() => {
    if (!userId || !seenTokensHydratedAt) return;
    const timer = setTimeout(() => {
      void loadQueuedRewards();
    }, 450);
    return () => clearTimeout(timer);
  }, [loadQueuedRewards, seenTokensHydratedAt, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasInactive = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      appStateRef.current = nextState;
      if (wasInactive && nextState === 'active') {
        void loadQueuedRewards();
      }
    });
    return () => {
      subscription.remove();
      if (postIntroRetryRef.current) {
        clearTimeout(postIntroRetryRef.current);
        postIntroRetryRef.current = null;
      }
    };
  }, [loadQueuedRewards]);

  useEffect(() => {
    if (!visible || !activeItem) return;
    if (lastAnimatedTokenRef.current === activeItem.token) return;
    lastAnimatedTokenRef.current = activeItem.token;

    AccessibilityInfo.announceForAccessibility(`Achievement unlocked: ${activeItem.title}`);
    Vibration.vibrate(34);

    primeStampAnimationStart();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(stampOpacity, {
          toValue: 1,
          duration: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stampRotation, {
          toValue: 0,
          duration: 145,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stampTranslateY, {
          toValue: 0,
          duration: 145,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stampScale, {
          toValue: 0.96,
          duration: 145,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(stampScale, {
        toValue: 1.05,
        duration: 75,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(stampScale, { toValue: 1, speed: 19, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [activeItem, primeStampAnimationStart, stampOpacity, stampRotation, stampScale, stampTranslateY, visible]);

  const handleAcknowledge = useCallback(() => {
    if (!activeItem) return;
    seenTokensRef.current.add(activeItem.token);
    void AsyncStorage.setItem(storageKey, JSON.stringify(Array.from(seenTokensRef.current))).catch(() => {});

    if (activeIndex >= queue.length - 1) {
      closeSequence();
      return;
    }
    const nextIndex = activeIndex + 1;
    primeStampAnimationStart();
    rewardPagerRef.current?.scrollTo({ x: nextIndex * CARD_CONTENT_WIDTH, animated: true });
    setActiveIndex(nextIndex);
  }, [activeIndex, activeItem, closeSequence, primeStampAnimationStart, queue.length, storageKey]);

  const handlePagerMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / CARD_CONTENT_WIDTH);
    if (nextIndex >= 0 && nextIndex < queue.length && nextIndex !== activeIndex) {
      primeStampAnimationStart();
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, primeStampAnimationStart, queue.length]);

  const rotation = stampRotation.interpolate({
    inputRange: [-1.7, 0],
    outputRange: ['-10deg', '0deg'],
  });

  if (!activeItem) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            ref={rewardPagerRef}
            style={styles.pager}
            horizontal
            snapToInterval={CARD_CONTENT_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePagerMomentumEnd}
            contentContainerStyle={styles.pagerContent}
          >
            {queue.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <View key={item.token} style={styles.page}>
                  <Animated.View
                    style={[
                      styles.stampWrap,
                      isActive
                        ? {
                            opacity: stampOpacity,
                            transform: [{ translateY: stampTranslateY }, { scale: stampScale }, { rotate: rotation }],
                          }
                        : styles.stampWrapInactive,
                    ]}
                  >
                    {item.imageSource ? (
                      <Image source={item.imageSource} style={styles.stampImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.stampFallback}>
                        <Text style={styles.stampFallbackText}>STAMP</Text>
                      </View>
                    )}
                  </Animated.View>

                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                  <Text style={styles.motivation}>{item.motivation}</Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.paginationRow}>
            {queue.map((item, index) => (
              <View
                key={`${item.token}-dot`}
                style={[styles.paginationDot, index === activeIndex ? styles.paginationDotActive : null]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.9}
            onPress={handleAcknowledge}
            accessibilityRole="button"
            accessibilityLabel={activeIndex < queue.length - 1 ? 'Next stamp reward' : 'Finish stamp rewards'}
          >
            <Text style={styles.ctaText}>{activeIndex < queue.length - 1 ? 'Next Stamp' : 'Keep Rolling'}</Text>
          </TouchableOpacity>
          <Text style={styles.progress}>{`${activeIndex + 1} of ${queue.length}`}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 8, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(17,19,24,0.92)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pager: {
    width: CARD_CONTENT_WIDTH,
  },
  pagerContent: {
    alignItems: 'stretch',
  },
  page: {
    width: CARD_CONTENT_WIDTH,
    alignItems: 'center',
  },
  stampWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  stampWrapInactive: {
    opacity: 0.9,
  },
  stampImage: {
    width: '100%',
    height: '100%',
  },
  stampFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stampFallbackText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fonts.black,
    fontSize: 24,
    lineHeight: 26,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: theme.typography.fonts.narrativeMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  motivation: {
    marginTop: 10,
    color: '#C9D6FF',
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  cta: {
    marginTop: 16,
    minHeight: 46,
    minWidth: 160,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progress: {
    marginTop: 8,
    color: palette.mediumGray,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
