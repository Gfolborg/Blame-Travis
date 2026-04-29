import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotiView } from 'moti';

import { CompassRose } from '../components/CompassRose';
import { TopographicSketch } from '../components/TopographicSketch';
import { TravisSignal } from '../components/TravisSignal';
import { useNotice } from '../components/TravisNotice';
import { useProfile } from '../hooks/useProfile';
import { notificationsService } from '../services/notifications';
import { passportService } from '../services/passport';
import { theme, palette } from '../theme';
import { MainTabParamList, RootStackParamList } from '../types/navigation';

type TabNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Profile'>;

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

type IdentityChipItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const mapPermissionState = (status?: string): PermissionState => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'undetermined') return 'undetermined';
  return 'unknown';
};

const toPermissionLabel = (value: PermissionState): string => {
  if (value === 'granted') return 'Granted';
  if (value === 'denied') return 'Denied';
  if (value === 'undetermined') return 'Pending';
  return 'Unavailable';
};

const formatTransportMode = (value?: string | null): string | null => {
  if (!value) return null;
  if (value === 'driving') return 'By car';
  if (value === 'walking') return 'On foot';
  if (value === 'transit') return 'Transit';
  return value.replace(/_/g, ' ');
};

const formatBudgetDefault = (value?: number | null): string | null => {
  if (value == null) return null;
  return `Budget ${value}`;
};

const formatTimeDefault = (value?: number | null): string | null => {
  if (value == null) return null;
  return `${value} min`;
};

const formatSpontaneity = (value?: string | null): string | null => {
  if (!value) return null;
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildIdentityChips = (profile: ReturnType<typeof useProfile>['profile']): IdentityChipItem[] => {
  if (!profile) return [];

  const items: IdentityChipItem[] = [];
  const transportMode = formatTransportMode(profile.transport_mode);
  const budgetDefault = formatBudgetDefault(profile.budget_default);
  const spontaneity = formatSpontaneity(profile.spontaneity_level);
  const timeDefault = formatTimeDefault(profile.time_default);

  if (transportMode) {
    items.push({ icon: 'navigate-outline', label: 'Moves by', value: transportMode });
  }

  if (budgetDefault) {
    items.push({ icon: 'wallet-outline', label: 'Budget', value: budgetDefault });
  }

  if (spontaneity) {
    items.push({ icon: 'sparkles-outline', label: 'Pace', value: spontaneity });
  }

  if (timeDefault) {
    items.push({ icon: 'time-outline', label: 'Window', value: timeDefault });
  }

  return items;
};

const ProfileStat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatValue}>{value}</Text>
    <Text style={styles.heroStatLabel}>{label}</Text>
  </View>
);

const IdentityChip = ({ item }: { item: IdentityChipItem }) => (
  <View style={styles.identityChip}>
    <View style={styles.identityChipIcon}>
      <Ionicons name={item.icon} size={16} color={palette.ink} />
    </View>
    <View style={styles.identityChipCopy}>
      <Text style={styles.identityChipLabel}>{item.label}</Text>
      <Text style={styles.identityChipValue}>{item.value}</Text>
    </View>
  </View>
);

const SectionCard = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
    <Text style={styles.sectionTitle}>{title}</Text>
    {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const ProfileScreen = () => {
  const navigation = useNavigation<TabNavigationProp>();
  const { profile, session, updateProfile, loading, error, refreshProfile, signOut } = useProfile();
  const { showNotice } = useNotice();

  const [savingNotifications, setSavingNotifications] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<PermissionState>('unknown');
  const [locationPermission, setLocationPermission] = useState<PermissionState>('unknown');
  const [passportStats, setPassportStats] = useState<{ stamps: string; countries: string }>({
    stamps: '--',
    countries: '--',
  });
  const [passportOffline, setPassportOffline] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [cityViewportWidth, setCityViewportWidth] = useState(0);
  const [cityTextWidth, setCityTextWidth] = useState(0);

  const isGuest = !session?.user?.id || !profile;
  const notificationsEnabled = profile?.notifications_enabled ?? false;
  const profileEmail = session?.user?.email || 'No email on file';
  const writesDisabled = isGuest || passportOffline || savingNotifications || signingOut;
  const identityChips = buildIdentityChips(profile);
  const homeCity = profile?.home_city || 'Open road';
  const homeCityLabel = homeCity.split(',')[0].toUpperCase();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const cityMarqueeOffset = useRef(new Animated.Value(0)).current;
  const cityMarqueeRunning = useRef(false);
  const cityMarqueeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const cityRenderWidth = cityTextWidth > 0 ? cityTextWidth : 0;

  const refreshPermissions = useCallback(async () => {
    try {
      const [notificationResult, locationResult] = await Promise.all([
        Notifications.getPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);
      setNotificationsPermission(mapPermissionState(notificationResult.status));
      const mappedLocation = mapPermissionState(locationResult.status);
      setLocationPermission(mappedLocation);
      if (mappedLocation !== 'unknown') {
        await passportService.setLocationPermissionStatus(mappedLocation);
      }
    } catch (permissionError: any) {
      showNotice({
        title: 'Permissions unavailable',
        message: permissionError?.message || 'Could not read current permission settings.',
        type: 'warning',
      });
    }
  }, [showNotice]);

  const refreshPassportStats = useCallback(async () => {
    try {
      const snapshot = await passportService.loadSnapshot();
      setPassportStats({
        stamps: String(snapshot.stats.totalStampedStops),
        countries: String(snapshot.stats.uniqueCountries),
      });
      setPassportOffline(snapshot.offline);
    } catch {
      setPassportStats({ stamps: '--', countries: '--' });
      setPassportOffline(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    void refreshPermissions();
    void refreshPassportStats();
  }, [loading, refreshPassportStats, refreshPermissions]);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => {
        if (active) {
          setReduceMotionEnabled(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const cityMarqueeDistance = Math.max(0, cityTextWidth - cityViewportWidth);
  const cityShouldMarquee = cityViewportWidth > 0 && cityMarqueeDistance > 12;

  const stopCityMarquee = useCallback(() => {
    if (cityMarqueeAnimation.current) {
      cityMarqueeAnimation.current.stop();
      cityMarqueeAnimation.current = null;
    }
    cityMarqueeOffset.stopAnimation();
    cityMarqueeOffset.setValue(0);
    cityMarqueeRunning.current = false;
  }, [cityMarqueeOffset]);

  const runCityMarquee = useCallback(() => {
    if (!cityShouldMarquee || cityMarqueeDistance <= 0) {
      stopCityMarquee();
      return;
    }

    if (cityMarqueeRunning.current) {
      return;
    }

    cityMarqueeRunning.current = true;
    const travelDistance = cityMarqueeDistance;
    const forwardDuration = Math.min(28000, Math.max(6500, Math.round((travelDistance / 12) * 1000)));

    cityMarqueeAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(cityMarqueeOffset, {
          toValue: -travelDistance,
          duration: forwardDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(cityMarqueeOffset, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: false },
    );

    cityMarqueeAnimation.current.start(({ finished }) => {
      if (!finished) {
        cityMarqueeRunning.current = false;
      }
    });
  }, [cityMarqueeDistance, cityMarqueeOffset, cityShouldMarquee, stopCityMarquee]);

  useEffect(() => {
    setCityTextWidth(0);
  }, [homeCityLabel]);

  useEffect(() => {
    if (cityShouldMarquee) {
      runCityMarquee();
      return;
    }

    stopCityMarquee();
  }, [cityShouldMarquee, runCityMarquee, stopCityMarquee]);

  useEffect(() => {
    return () => {
      stopCityMarquee();
    };
  }, [stopCityMarquee]);

  const handleCityMeasured = useCallback((width: number) => {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const rounded = Math.ceil(width);
    setCityTextWidth(current => (current === rounded ? current : rounded));
  }, []);

  const handleToggleNotifications = async (nextValue: boolean) => {
    if (!profile?.id) return;
    if (passportOffline) {
      showNotice({
        title: 'You are offline',
        message: 'Reconnect to change notification settings.',
        type: 'warning',
        duration: 3200,
      });
      return;
    }

    try {
      setSavingNotifications(true);
      await updateProfile({ notifications_enabled: nextValue });
      if (nextValue) {
        await notificationsService.registerDevice(profile.id, { shouldPrompt: true });
      } else {
        await notificationsService.disableNotifications(profile.id);
      }
      AccessibilityInfo.announceForAccessibility(`Notifications ${nextValue ? 'enabled' : 'disabled'}`);
      showNotice({
        title: nextValue ? 'Notifications enabled' : 'Notifications paused',
        message: nextValue
          ? 'Travis will nudge you when your itinerary needs attention.'
          : 'Travis will stay quiet until you turn alerts back on.',
        type: nextValue ? 'success' : 'info',
        duration: 3200,
      });
    } catch (toggleError: any) {
      showNotice({
        title: 'Update failed',
        message: toggleError?.message || 'That change did not save. Try again.',
        type: 'error',
      });
    } finally {
      setSavingNotifications(false);
      void refreshPermissions();
    }
  };

  const handleSignOut = async () => {
    if (isGuest) return;
    try {
      setSigningOut(true);
      await signOut();
      showNotice({
        title: 'Signed out',
        message: 'Your account is now in guest mode on this device.',
        type: 'info',
      });
    } catch {
      showNotice({ title: 'Sign out failed', message: 'Please try again.', type: 'error' });
    } finally {
      setSigningOut(false);
    }
  };

  const handleRequestPermission = async (type: 'notifications' | 'location') => {
    try {
      if (type === 'notifications') {
        const { status } = await Notifications.requestPermissionsAsync();
        const mapped = mapPermissionState(status);
        setNotificationsPermission(mapped);
        AccessibilityInfo.announceForAccessibility(`Notification permission ${toPermissionLabel(mapped)}`);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const mapped = mapPermissionState(status);
        setLocationPermission(mapped);
        if (mapped !== 'unknown') {
          await passportService.setLocationPermissionStatus(mapped);
        }
        AccessibilityInfo.announceForAccessibility(`Location permission ${toPermissionLabel(mapped)}`);
      }
    } catch (permissionError: any) {
      showNotice({
        title: 'Permission request failed',
        message: permissionError?.message || 'Please try again from app settings.',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Syncing your traveler desk...</Text>
      </View>
    );
  }

  const revealProps = (delay: number) =>
    reduceMotionEnabled
      ? {}
      : {
          from: { opacity: 0, translateY: 18 },
          animate: { opacity: 1, translateY: 0 },
          transition: { type: 'timing' as const, duration: 420, delay },
        };

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.atmosphereLayer} pointerEvents="none">
          <CompassRose />
          <View style={styles.topographyLayer}>
            <TopographicSketch />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.guestScroll} showsVerticalScrollIndicator={false}>
          <MotiView style={styles.guestCard} {...revealProps(0)}>
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>Traveler desk</Text>
            </View>

            <View style={styles.guestSignalWrap}>
              <TravisSignal status="idle" size={64} />
            </View>

            <Text style={styles.guestTitle}>Your profile is traveling light</Text>
            <Text style={styles.guestSubtitle}>
              Sign in to sync your passport, itinerary settings, and notification preferences across the road.
            </Text>

            <View style={styles.guestBenefitRow}>
              <View style={styles.guestBenefit}>
                <Ionicons name="journal-outline" size={18} color={palette.ink} />
                <Text style={styles.guestBenefitText}>Passport history</Text>
              </View>
              <View style={styles.guestBenefit}>
                <Ionicons name="map-outline" size={18} color={palette.ink} />
                <Text style={styles.guestBenefitText}>Journey defaults</Text>
              </View>
            </View>

            {error ? <Text style={styles.guestErrorText}>{error}</Text> : null}

            <View style={styles.guestActions}>
              <Pressable
                style={styles.primaryCta}
                onPress={() => rootNavigation?.navigate('Login')}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityHint="Opens the login screen"
              >
                <Text style={styles.primaryCtaText}>Sign in</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryCta}
                onPress={() => rootNavigation?.navigate('SignUp')}
                accessibilityRole="button"
                accessibilityLabel="Create account"
                accessibilityHint="Opens the account creation screen"
              >
                <Text style={styles.secondaryCtaText}>Create account</Text>
              </Pressable>

              <Pressable
                onPress={() => void refreshProfile()}
                style={styles.linkAction}
                accessibilityRole="button"
                accessibilityLabel="Retry profile sync"
              >
                <Text style={styles.linkActionText}>Retry sync</Text>
              </Pressable>
            </View>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.atmosphereLayer} pointerEvents="none">
        <CompassRose />
        <View style={styles.topographyLayer}>
          <TopographicSketch />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <MotiView {...revealProps(0)}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroLead}>
                <Text style={styles.heroEyebrow}>Traveler desk</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cityShouldMarquee ? 'Replay home city scroll' : undefined}
                  accessibilityHint={cityShouldMarquee ? 'Replays the scrolling home city label.' : undefined}
                  disabled={!cityShouldMarquee}
                  style={styles.heroCityViewport}
                  onLayout={event => {
                    const nextWidth = Math.ceil(event.nativeEvent.layout.width);
                    setCityViewportWidth(current => (current === nextWidth ? current : nextWidth));
                  }}
                  onPress={runCityMarquee}
                >
                  <Animated.Text
                    style={[
                      styles.heroCity,
                      styles.heroCityMarqueeText,
                      cityRenderWidth > 0 ? { width: cityRenderWidth } : null,
                      { transform: [{ translateX: cityMarqueeOffset }] },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode={cityShouldMarquee ? 'clip' : 'tail'}
                  >
                    {homeCityLabel}
                  </Animated.Text>
                </Pressable>
                <View pointerEvents="none" style={styles.heroCityMeasureViewport}>
                  <ScrollView
                    horizontal
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.heroCityMeasureContent}
                    onContentSizeChange={width => handleCityMeasured(width)}
                  >
                    <Text style={styles.heroCityMeasureText}>{homeCityLabel}</Text>
                  </ScrollView>
                </View>
                <Text style={styles.heroSummary}>Home base for your next open-road detour.</Text>
                <Text style={styles.heroMeta}>{profileEmail}</Text>
              </View>

              <View style={styles.heroSignalColumn}>
                <TravisSignal status={notificationsEnabled ? 'tracking' : 'idle'} size={58} />
                <View style={[styles.heroStamp, passportOffline && styles.heroStampMuted]}>
                  <Text style={styles.heroStampText}>{passportOffline ? 'Offline snapshot' : 'Passport ready'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <ProfileStat label="Stamps" value={passportStats.stamps} />
              <ProfileStat label="Regions" value={passportStats.countries} />
              <ProfileStat label="Nudges" value={notificationsEnabled ? 'On' : 'Off'} />
            </View>
          </View>
        </MotiView>

        {error ? (
          <MotiView {...revealProps(70)}>
            <View style={styles.errorBanner}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.error} />
              </View>
              <View style={styles.errorCopy}>
                <Text style={styles.errorBannerTitle}>Profile sync needs another pass</Text>
                <Text style={styles.errorBannerBody}>{error}</Text>
              </View>
            </View>
          </MotiView>
        ) : null}

        {identityChips.length > 0 ? (
          <MotiView {...revealProps(120)}>
            <SectionCard
              eyebrow="Travel identity"
              title="How the desk reads your defaults"
              description="A quick read on how you usually move once Travis points at something good."
            >
              <View style={styles.identityGrid}>
                {identityChips.map(item => (
                  <IdentityChip key={`${item.label}-${item.value}`} item={item} />
                ))}
              </View>
            </SectionCard>
          </MotiView>
        ) : null}

        <MotiView {...revealProps(180)}>
          <SectionCard
            eyebrow="Travel settings"
            title="Keep the useful nudges on"
            description="The app should feel like a sharp travel desk, not a noisy roommate."
          >
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="flash-outline" size={20} color={palette.ink} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Travis nudges</Text>
                <Text style={styles.settingText}>Timing alerts for itinerary changes and reminder moments.</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                disabled={writesDisabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.colors.border, true: palette.ink }}
                thumbColor={palette.white}
                accessibilityLabel="Travis notifications"
                accessibilityHint="Turns itinerary reminders on or off"
              />
            </View>

            <View style={styles.quietHoursNote}>
              <Ionicons name="moon-outline" size={16} color={palette.mediumGray} />
              <Text style={styles.quietHoursText}>Quiet hours run from 9:00 PM to 8:00 AM local time.</Text>
            </View>
          </SectionCard>
        </MotiView>

        <MotiView {...revealProps(240)}>
          <SectionCard eyebrow="Account" title="Your desk, your route">
            <View style={styles.actionRow}>
              <View style={styles.actionRowLead}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name="mail-outline" size={18} color={palette.ink} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Account email</Text>
                  <Text style={styles.actionValue}>{profileEmail}</Text>
                </View>
              </View>
            </View>

            <Divider />

            <View style={styles.actionRow}>
              <View style={styles.actionRowLead}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name="pin-outline" size={18} color={palette.ink} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Home base</Text>
                  <Text style={styles.actionValue}>{homeCity}</Text>
                </View>
              </View>
            </View>

            <Divider />

            <Pressable
              style={styles.signOutButton}
              onPress={handleSignOut}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityHint="Signs you out on this device"
            >
              <Text style={styles.signOutButtonText}>{signingOut ? 'Signing out...' : 'Sign out on this device'}</Text>
            </Pressable>
          </SectionCard>
        </MotiView>

        <MotiView {...revealProps(300)}>
          <SectionCard
            eyebrow="Permissions"
            title="Keep the travel tools sharp"
            description="These controls stay plain on purpose. They affect real app behavior."
          >
            <View style={styles.permissionRow}>
              <View style={styles.actionRowLead}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name="location-outline" size={18} color={palette.ink} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Location access</Text>
                  <Text style={styles.actionValue}>{toPermissionLabel(locationPermission)}</Text>
                </View>
              </View>
              {locationPermission === 'granted' ? (
                <Text style={styles.permissionStateGood}>Ready</Text>
              ) : (
                <Pressable
                  style={styles.inlineButton}
                  onPress={() =>
                    locationPermission === 'denied'
                      ? void Linking.openSettings()
                      : void handleRequestPermission('location')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    locationPermission === 'denied'
                      ? 'Open app settings for location permission'
                      : 'Enable location permission'
                  }
                >
                  <Text style={styles.inlineButtonText}>{locationPermission === 'denied' ? 'Open' : 'Enable'}</Text>
                </Pressable>
              )}
            </View>

            <Divider />

            <View style={styles.permissionRow}>
              <View style={styles.actionRowLead}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name="notifications-outline" size={18} color={palette.ink} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Notification access</Text>
                  <Text style={styles.actionValue}>{toPermissionLabel(notificationsPermission)}</Text>
                </View>
              </View>
              {notificationsPermission === 'granted' ? (
                <Text style={styles.permissionStateGood}>Ready</Text>
              ) : (
                <Pressable
                  style={styles.inlineButton}
                  onPress={() =>
                    notificationsPermission === 'denied'
                      ? void Linking.openSettings()
                      : void handleRequestPermission('notifications')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    notificationsPermission === 'denied'
                      ? 'Open app settings for notification permission'
                      : 'Enable notification permission'
                  }
                >
                  <Text style={styles.inlineButtonText}>{notificationsPermission === 'denied' ? 'Open' : 'Enable'}</Text>
                </Pressable>
              )}
            </View>

            <Divider />

            <View style={styles.permissionRow}>
              <View style={styles.actionRowLead}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={palette.ink} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Data & privacy</Text>
                  <Text style={styles.actionValue}>Review app permissions and privacy controls in system settings.</Text>
                </View>
              </View>
              <Pressable
                style={styles.inlineButton}
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Open privacy settings"
                accessibilityHint="Opens this app's settings on your device"
              >
                <Text style={styles.inlineButtonText}>Open</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotiView>

        <Text style={styles.footerText}>Build v1.0.4 release candidate</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 15,
    textAlign: 'center',
  },
  atmosphereLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topographyLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 16,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroLead: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroCity: {
    marginTop: 8,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  heroCityViewport: {
    marginTop: 8,
    minHeight: 46,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroCityMeasureViewport: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  heroCityMeasureContent: {
    alignItems: 'flex-start',
  },
  heroCityMeasureText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.2,
  },
  heroCityMarqueeText: {
    flexShrink: 0,
  },
  heroSummary: {
    marginTop: 10,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 18,
    lineHeight: 26,
  },
  heroMeta: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroSignalColumn: {
    alignItems: 'flex-end',
    gap: 12,
  },
  heroStamp: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    transform: [{ rotate: '-7deg' }],
  },
  heroStampMuted: {
    backgroundColor: 'rgba(242,242,245,0.9)',
  },
  heroStampText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,26,0.08)',
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 28,
    lineHeight: 30,
  },
  heroStatLabel: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(198,40,40,0.18)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(198,40,40,0.08)',
  },
  errorCopy: {
    flex: 1,
  },
  errorBannerTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 14,
  },
  errorBannerBody: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 6,
  },
  sectionEyebrow: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  sectionDescription: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBody: {
    marginTop: 16,
  },
  identityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  identityChip: {
    minWidth: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.softGray,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  identityChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  identityChipCopy: {
    flex: 1,
  },
  identityChipLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  identityChipValue: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.softGray,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 15,
  },
  settingText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  quietHoursNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,26,0.06)',
  },
  quietHoursText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  actionRowLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.softGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 14,
  },
  actionValue: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  permissionStateGood: {
    color: theme.colors.success,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  inlineButton: {
    minHeight: 44,
    minWidth: 84,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.textPrimary,
  },
  inlineButtonText: {
    color: palette.white,
    fontFamily: theme.typography.fonts.black,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signOutButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
    backgroundColor: palette.softGray,
  },
  signOutButtonText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(26,26,26,0.08)',
    marginVertical: 14,
  },
  guestScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  guestCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 10,
  },
  guestBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.softGray,
  },
  guestBadgeText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  guestSignalWrap: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  guestTitle: {
    marginTop: 18,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  guestSubtitle: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 16,
    lineHeight: 24,
  },
  guestBenefitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  guestBenefit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: palette.softGray,
  },
  guestBenefitText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 12,
  },
  guestErrorText: {
    marginTop: 14,
    color: theme.colors.error,
    fontFamily: theme.typography.fonts.narrativeMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  guestActions: {
    marginTop: 22,
    gap: 12,
  },
  primaryCta: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.textPrimary,
  },
  primaryCtaText: {
    color: palette.white,
    fontFamily: theme.typography.fonts.black,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryCta: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
  },
  secondaryCtaText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  linkAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkActionText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
  },
  footerText: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default ProfileScreen;
