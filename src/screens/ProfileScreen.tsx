import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { MotiView } from 'moti';

import { useNotice } from '../components/TravisNotice';
import { useProfile } from '../hooks/useProfile';
import { notificationsService } from '../services/notifications';
import { passportService } from '../services/passport';
import { theme } from '../theme';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

const mapPermissionState = (status?: string): PermissionState => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'undetermined') return 'undetermined';
  return 'unknown';
};

const toPermissionLabel = (value: PermissionState): string => {
  if (value === 'granted') return 'Granted';
  if (value === 'denied') return 'Denied';
  if (value === 'undetermined') return 'Not Requested';
  return 'Unavailable';
};

const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statChip}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ProfileScreen = () => {
  const { profile, session, updateProfile, loading, error, refreshProfile, signOut } = useProfile();
  const { showNotice } = useNotice();

  const [savingNotifications, setSavingNotifications] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<PermissionState>('unknown');
  const [locationPermission, setLocationPermission] = useState<PermissionState>('unknown');
  const [permissionRefreshPending, setPermissionRefreshPending] = useState(false);
  const [passportStats, setPassportStats] = useState<{ stamps: string; countries: string }>({
    stamps: '--',
    countries: '--',
  });
  const [passportOffline, setPassportOffline] = useState(false);

  const isGuest = !session?.user?.id || !profile;
  const notificationsEnabled = profile?.notifications_enabled ?? false;
  const profileEmail = session?.user?.email || 'Not available';
  const writesDisabled = isGuest || passportOffline || savingNotifications || signingOut;

  const refreshPermissions = useCallback(async () => {
    setPermissionRefreshPending(true);
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
    } finally {
      setPermissionRefreshPending(false);
    }
  }, []);

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

  const permissionStatusTone = useMemo(() => {
    if (notificationsPermission === 'denied' || locationPermission === 'denied') return styles.badgeWarning;
    if (notificationsPermission === 'granted' && locationPermission === 'granted') return styles.badgeSuccess;
    return styles.badgeNeutral;
  }, [locationPermission, notificationsPermission]);

  const handleToggleNotifications = async (nextValue: boolean) => {
    if (!profile?.id) return;
    if (passportOffline) {
      showNotice({
        title: 'OFFLINE MODE',
        message: 'Settings edits are paused until your connection stabilizes.',
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
      AccessibilityInfo.announceForAccessibility(
        `Notifications ${nextValue ? 'enabled' : 'disabled'}`,
      );
      showNotice({
        title: nextValue ? 'NOTIFICATIONS ENABLED' : 'QUIET MODE ENABLED',
        message: nextValue
          ? 'Travis: I will keep itinerary timing and follow-ups on your radar.'
          : 'Travis: Quiet mode is active. I will stay in the background.',
        type: nextValue ? 'success' : 'info',
        duration: 3200,
      });
    } catch (toggleError: any) {
      AccessibilityInfo.announceForAccessibility('Notification setting failed to update');
      showNotice({
        title: 'UPDATE FAILED',
        message: toggleError?.message || 'Notification setting could not be updated right now.',
        type: 'error',
        duration: 3800,
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
        title: 'SIGNED OUT',
        message: 'Session closed. You are back in guest mode on this device.',
        type: 'info',
        duration: 2800,
      });
    } catch (signOutError: any) {
      showNotice({
        title: 'SIGN OUT FAILED',
        message: signOutError?.message || 'Sign out did not complete. Try again.',
        type: 'error',
        duration: 3800,
      });
    } finally {
      setSigningOut(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationsPermission(mapPermissionState(status));
  };

  const handleRequestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const mapped = mapPermissionState(status);
    setLocationPermission(mapped);
    if (mapped !== 'unknown') {
      await passportService.setLocationPermissionStatus(mapped);
    }
  };

  const renderPermissionAction = (
    type: 'notifications' | 'location',
    status: PermissionState,
  ) => {
    if (status === 'granted') {
      return <Text style={styles.permissionGranted}>Granted</Text>;
    }

    if (status === 'denied') {
      return (
        <TouchableOpacity
          style={styles.permissionActionButton}
          onPress={() => {
            void Linking.openSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open settings for ${type} permission`}
        >
          <Text style={styles.permissionActionText}>Open Settings</Text>
        </TouchableOpacity>
      );
    }

    if (status === 'undetermined') {
      return (
        <TouchableOpacity
          style={styles.permissionActionButton}
          onPress={() => {
            if (type === 'notifications') {
              void handleRequestNotificationPermission();
            } else {
              void handleRequestLocationPermission();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={`Request ${type} permission`}
        >
          <Text style={styles.permissionActionText}>Request</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.permissionActionButton}
        onPress={() => {
          void refreshPermissions();
        }}
      >
        <Text style={styles.permissionActionText}>Refresh</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading control center...</Text>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={42} color={theme.colors.primary} />
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            void refreshProfile();
          }}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.heroAvatar}>
                <Ionicons name="person" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>TRAVELER CONTROL CENTER</Text>
                <Text style={styles.heroSubtitle}>
                  {profile?.home_city?.toUpperCase() || 'GUEST DEVICE MODE'}
                </Text>
              </View>
              <View style={[styles.statusBadge, permissionStatusTone]}>
                <Text style={styles.statusBadgeText}>
                  {isGuest ? 'GUEST' : 'SIGNED IN'}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <StatChip label="Stamps" value={passportStats.stamps} />
              <StatChip label="Countries" value={passportStats.countries} />
              <StatChip
                label="Alerts"
                value={notificationsEnabled ? 'ON' : 'OFF'}
              />
            </View>
          </View>
        </MotiView>

        {passportOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#8A4A00" />
            <Text style={styles.offlineText}>
              Offline snapshot mode active. Settings edits are temporarily paused.
            </Text>
          </View>
        )}

        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 80 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Email</Text>
                <Text style={styles.rowBody}>{profileEmail}</Text>
              </View>
              <Text style={styles.inlineTag}>{isGuest ? 'Guest' : 'Active'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.secondaryButton, (isGuest || signingOut) && styles.buttonDisabled]}
              disabled={isGuest || signingOut}
              onPress={() => {
                void handleSignOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.secondaryButtonText}>
                {signingOut ? 'Signing out...' : 'Sign out'}
              </Text>
            </TouchableOpacity>
            {isGuest && (
              <Text style={styles.guestNote}>
                Sign in is required for synced profile changes. Guest mode remains read-only.
              </Text>
            )}
          </View>
        </MotiView>

        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 120 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notifications</Text>
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Travel nudges</Text>
                <Text style={styles.rowBody}>
                  Booking and itinerary reminders from Travis.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                disabled={writesDisabled}
                onValueChange={(value) => {
                  void handleToggleNotifications(value);
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle travel notifications"
              />
            </View>
            <Text style={styles.subtleText}>Quiet hours run from 9 PM to 8 AM local time.</Text>
          </View>
        </MotiView>

        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 150 }}>
          <View style={styles.card}>
            <View style={styles.cardHeadingRow}>
              <Text style={styles.cardTitle}>Permissions</Text>
              {permissionRefreshPending && <ActivityIndicator size="small" color={theme.colors.primary} />}
            </View>

            <View style={styles.permissionRow}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Notifications Permission</Text>
                <Text style={styles.rowBody}>{toPermissionLabel(notificationsPermission)}</Text>
              </View>
              {renderPermissionAction('notifications', notificationsPermission)}
            </View>

            <View style={styles.permissionDivider} />

            <View style={styles.permissionRow}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Location Permission</Text>
                <Text style={styles.rowBody}>{toPermissionLabel(locationPermission)}</Text>
              </View>
              {renderPermissionAction('location', locationPermission)}
            </View>
          </View>
        </MotiView>

        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 180 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy</Text>
            <View style={styles.privacyRow}>
              <Text style={styles.rowTitle}>Export account data</Text>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
            <View style={styles.privacyRow}>
              <Text style={styles.rowTitle}>Delete account</Text>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
          </View>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.huge,
    gap: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: theme.typography.sizes.md,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorTitle: {
    marginTop: 14,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: theme.typography.sizes.xl,
  },
  errorMessage: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    fontFamily: theme.typography.fonts.narrative,
  },
  primaryButton: {
    marginTop: 20,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 22,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fonts.black,
    fontSize: 12,
    letterSpacing: 0.9,
  },
  hero: {
    marginTop: theme.spacing.sm,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.textPrimary,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  heroSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  statusBadge: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    borderColor: 'rgba(46, 125, 50, 0.3)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(201, 122, 0, 0.08)',
    borderColor: 'rgba(201, 122, 0, 0.3)',
  },
  badgeNeutral: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
  },
  statusBadgeText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  statsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 17,
  },
  statLabel: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  offlineBanner: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 122, 0, 0.24)',
    backgroundColor: 'rgba(249, 168, 37, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineText: {
    flex: 1,
    color: '#8A4A00',
    fontFamily: theme.typography.fonts.narrativeMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: theme.typography.sizes.md,
    letterSpacing: 0.4,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: theme.typography.sizes.sm,
  },
  rowBody: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineTag: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  guestNote: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 18,
  },
  subtleText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 18,
  },
  permissionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  permissionActionButton: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
  },
  permissionActionText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  permissionGranted: {
    color: theme.colors.success,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  privacyRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  comingSoon: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export default ProfileScreen;
