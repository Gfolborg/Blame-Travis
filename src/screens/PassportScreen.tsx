import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getStampVisualPreset } from '../config/passportVisuals';
import { listAchievementDefinitions, passportService } from '../services/passport';
import { PassportSnapshot, PassportStamp } from '../types/passport';
import { theme } from '../theme';

let MapView: any = null;
let Marker: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch {
  MapView = null;
  Marker = null;
}

const formatStampDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const EMPTY_SNAPSHOT: PassportSnapshot = {
  stamps: [],
  achievements: [],
  stats: {
    totalStampedStops: 0,
    uniqueCities: 0,
    uniqueCountries: 0,
    completedDayCount: 0,
    homeCountryCode: null,
    firstStampAt: null,
    lastStampAt: null,
  },
  dayProgress: [],
  offline: false,
  offlineSavedAt: null,
  permissionStatus: 'undetermined',
};

const StampChip: React.FC<{ stamp: PassportStamp }> = ({ stamp }) => {
  const visual = getStampVisualPreset(stamp.placeId || stamp.id);
  return (
    <View style={[styles.stampChip, { backgroundColor: visual.fill, borderColor: visual.ring }]}>
      <View style={[styles.stampGlyph, { borderColor: visual.ring }]}>
        <Text style={[styles.stampGlyphText, { color: visual.text }]}>{visual.glyph}</Text>
      </View>
      <View style={styles.stampMeta}>
        <Text style={styles.stampTitle} numberOfLines={1}>
          {stamp.title}
        </Text>
        <Text style={styles.stampSubtitle} numberOfLines={1}>
          {(stamp.city || 'Unknown city').toUpperCase()} {stamp.countryCode ? `| ${stamp.countryCode}` : ''}
        </Text>
        <Text style={styles.stampDate}>{formatStampDate(stamp.stampedAt)}</Text>
      </View>
    </View>
  );
};

const PassportScreen = () => {
  const [snapshot, setSnapshot] = useState<PassportSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const next = await passportService.loadSnapshot();
      setSnapshot(next);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not load passport right now.');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSnapshot(false);
    }, [loadSnapshot]),
  );

  const mappedStamps = useMemo(
    () => snapshot.stamps.filter(stamp => stamp.lat != null && stamp.lng != null).slice(0, 40),
    [snapshot.stamps],
  );

  const unlockedKeys = useMemo(
    () => new Set(snapshot.achievements.map(item => item.achievementKey)),
    [snapshot.achievements],
  );

  const lockedAchievements = useMemo(
    () => listAchievementDefinitions().filter(item => !unlockedKeys.has(item.key)).slice(0, 3),
    [unlockedKeys],
  );

  const hasStamps = snapshot.stamps.length > 0;

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Loading Passport</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={44} color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Could not load passport</Text>
        <Text style={styles.stateSubtitle}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => void loadSnapshot(true)}>
          <Text style={styles.primaryCtaText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasStamps && snapshot.permissionStatus === 'denied') {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="location-outline" size={44} color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Auto-Stamp Is Paused</Text>
        <Text style={styles.stateSubtitle}>
          Enable location permission so Travis can stamp stops automatically when you arrive.
        </Text>
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={() => {
            void Linking.openSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel="Open settings to enable location permission"
        >
          <Text style={styles.primaryCtaText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasStamps) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="map-outline" size={44} color={theme.colors.primary} />
        <Text style={styles.stateTitle}>No Stamps Yet</Text>
        <Text style={styles.stateSubtitle}>
          Reach an itinerary stop and stay nearby for about two minutes to earn your first stamp.
        </Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => void loadSnapshot(true)}>
          <Text style={styles.primaryCtaText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSnapshot(true)} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>PASSPORT</Text>
        <Text style={styles.subtitle}>Automatic stamps and achievements from your real-world journeys.</Text>
      </View>

      {snapshot.offline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.warning} />
          <Text style={styles.offlineText}>
            Offline snapshot {snapshot.offlineSavedAt ? `| saved ${formatStampDate(snapshot.offlineSavedAt)}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{snapshot.stats.totalStampedStops}</Text>
          <Text style={styles.statLabel}>Stamps</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{snapshot.stats.uniqueCities}</Text>
          <Text style={styles.statLabel}>Cities</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{snapshot.stats.uniqueCountries}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{snapshot.stats.completedDayCount}</Text>
          <Text style={styles.statLabel}>Days Done</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievement Stamps</Text>
        <View style={styles.achievementGrid}>
          {snapshot.achievements.slice(0, 8).map(item => {
            const definition = listAchievementDefinitions().find(def => def.key === item.achievementKey);
            const visual = getStampVisualPreset(item.achievementKey);
            return (
              <View key={item.id} style={[styles.achievementCard, { borderColor: visual.ring }]}>
                <View style={[styles.achievementGlyph, { backgroundColor: visual.fill, borderColor: visual.ring }]}>
                  <Text style={[styles.achievementGlyphText, { color: visual.text }]}>{visual.glyph}</Text>
                </View>
                <Text style={styles.achievementTitle} numberOfLines={2}>
                  {definition?.title || item.achievementKey}
                </Text>
              </View>
            );
          })}
        </View>
        {lockedAchievements.length > 0 && (
          <View style={styles.lockedPanel}>
            <Text style={styles.lockedTitle}>Next Up</Text>
            {lockedAchievements.map(item => (
              <Text key={item.key} style={styles.lockedItem}>
                {item.title} - {item.description}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Passport Map</Text>
        {MapView && mappedStamps.length > 0 ? (
          <View style={styles.mapContainer}>
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: mappedStamps[0].lat as number,
                longitude: mappedStamps[0].lng as number,
                latitudeDelta: 5,
                longitudeDelta: 5,
              }}
            >
              {mappedStamps.map(stamp => (
                <Marker
                  key={stamp.id}
                  coordinate={{
                    latitude: stamp.lat as number,
                    longitude: stamp.lng as number,
                  }}
                  title={stamp.title}
                  description={stamp.city || 'Stamped stop'}
                />
              ))}
            </MapView>
          </View>
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.mapFallbackText}>
              Map preview unavailable right now. Your stamped stops are listed below.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Stamps</Text>
        <View style={styles.stampList}>
          {snapshot.stamps.slice(0, 30).map(stamp => (
            <StampChip key={stamp.id} stamp={stamp} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.huge,
    gap: theme.spacing.md,
  },
  centeredState: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  stateTitle: {
    marginTop: 14,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontFamily: theme.typography.fonts.black,
    textAlign: 'center',
  },
  stateSubtitle: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: theme.typography.fonts.narrative,
  },
  primaryCta: {
    marginTop: 28,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: theme.typography.fonts.black,
  },
  header: {
    gap: 6,
  },
  title: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 34,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 14,
    lineHeight: 21,
  },
  offlineBanner: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 122, 0, 0.28)',
    backgroundColor: 'rgba(249, 168, 37, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#8A4A00',
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 24,
  },
  statLabel: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  section: {
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  achievementCard: {
    width: '48%',
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFF',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  achievementGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementGlyphText: {
    fontSize: 16,
    fontFamily: theme.typography.fonts.black,
  },
  achievementTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  lockedPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 10,
    gap: 6,
  },
  lockedTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lockedItem: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  mapContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapFallback: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
  },
  mapFallbackText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  stampList: {
    gap: 8,
  },
  stampChip: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stampGlyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  stampGlyphText: {
    fontFamily: theme.typography.fonts.black,
    fontSize: 14,
  },
  stampMeta: {
    flex: 1,
    gap: 2,
  },
  stampTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 13,
  },
  stampSubtitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  stampDate: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
  },
});

export default PassportScreen;
