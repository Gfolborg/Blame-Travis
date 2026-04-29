import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { getAchievementVisual, getStampVisualPreset } from '../config/passportVisuals';
import { listAchievementDefinitions, passportService } from '../services/passport';
import {
  PassportAchievement,
  PassportAchievementDefinition,
  PassportLocationPermissionStatus,
  PassportSnapshot,
  PassportStamp,
} from '../types/passport';
import { stampArtService, StampArtManifestEntry } from '../services/stampArt';
import { theme, palette } from '../theme';
import { useProfile } from '../hooks/useProfile';
import { MainTabParamList, RootStackParamList } from '../types/navigation';

const { height } = Dimensions.get('window');
const DRAWER_HEIGHT = Math.min(Math.max(height * 0.38, 300), 380);
const RAIL_HEIGHT = 76;

type TabNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Passport'>;
type PassportTabKey = 'stamps' | 'places' | 'stats';

type ProgressStampItem = {
  key: string;
  title: string;
  description: string;
  current: number;
  total: number;
  isEarned: boolean;
  earnedAt: string | null;
};

const TAB_META: Array<{
  key: PassportTabKey;
  label: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'stamps', label: 'Stamps', title: 'Passport Stamps', icon: 'ribbon-outline' },
  { key: 'places', label: 'Places', title: 'Places', icon: 'location-outline' },
  { key: 'stats', label: 'Stats', title: 'Stats', icon: 'stats-chart-outline' },
];

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

const formatStampDate = (value: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getAchievementGroupLabel = (key: string): string => {
  if (key === 'first_stamp') return 'Journey';
  if (key === 'first_abroad') return 'Borders';
  if (key.startsWith('places_')) return 'Places';
  if (key.startsWith('countries_')) return 'Countries';
  if (key.startsWith('days_completed_')) return 'Chapters';
  return 'Passport';
};

const getAchievementSerial = (key: string): string =>
  key
    .replace(/_/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();

const computeProgressValue = (
  definition: PassportAchievementDefinition,
  snapshot: PassportSnapshot,
): { current: number; total: number } => {
  if (definition.key === 'first_stamp') {
    return { current: Math.min(snapshot.stats.totalStampedStops, 1), total: 1 };
  }

  if (definition.key === 'first_abroad') {
    return { current: snapshot.stats.uniqueCountries >= 2 ? 1 : 0, total: 1 };
  }

  if (definition.group === 'places') {
    return {
      current: Math.min(snapshot.stats.totalStampedStops, definition.threshold || 0),
      total: definition.threshold || 1,
    };
  }

  if (definition.group === 'countries') {
    return {
      current: Math.min(snapshot.stats.uniqueCountries, definition.threshold || 0),
      total: definition.threshold || 1,
    };
  }

  if (definition.group === 'completion') {
    return {
      current: Math.min(snapshot.stats.completedDayCount, definition.threshold || 0),
      total: definition.threshold || 1,
    };
  }

  return { current: 0, total: definition.threshold || 1 };
};

const AtlasStat = ({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {detail ? (
      <Text style={styles.statDetail} numberOfLines={2}>
        {detail}
      </Text>
    ) : null}
  </View>
);

const RailButton = ({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    activeOpacity={0.88}
    onPress={onPress}
    style={[styles.railButton, active && styles.railButtonActive]}
  >
    <Ionicons
      name={icon}
      size={18}
      color={active ? theme.colors.textPrimary : theme.colors.textSecondary}
    />
    <Text style={[styles.railButtonText, active && styles.railButtonTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const PlaceStampCard = ({
  title,
  city,
  dateLabel,
  visualKey,
  selected = false,
  onPress,
}: {
  title: string;
  city: string;
  dateLabel: string;
  visualKey: string;
  selected?: boolean;
  onPress?: () => void;
}) => {
  const visual = getStampVisualPreset(visualKey);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.rowCard, selected && styles.rowCardSelected]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Focus ${title} on passport map` : undefined}
    >
      <View style={[styles.rowSeal, { backgroundColor: visual.fill, borderColor: visual.ring }]}>
        <Text style={[styles.rowSealGlyph, { color: visual.text }]}>{visual.glyph}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {city}
        </Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
      {onPress ? (
        <View style={styles.rowAction}>
          <Ionicons name="locate-outline" size={18} color={theme.colors.textPrimary} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const AchievementStampTile = ({
  item,
  manifestEntry,
}: {
  item: ProgressStampItem;
  manifestEntry?: StampArtManifestEntry;
}) => {
  const visual = getAchievementVisual(item.key);
  const progressWidth = item.total > 0 ? (`${Math.min(100, (item.current / item.total) * 100)}%` as const) : '0%';
  const groupLabel = getAchievementGroupLabel(item.key);
  const serial = getAchievementSerial(item.key);
  const artUri = item.isEarned
    ? manifestEntry?.imageUrl ?? null
    : manifestEntry?.lockedImageUrl ?? manifestEntry?.imageUrl ?? null;

  return (
    <View style={styles.stampTile}>
      <View style={styles.stampTileTop}>
        <View>
          <Text style={styles.stampTileGroup}>{groupLabel}</Text>
          <Text style={styles.stampTileSerial}>{serial}</Text>
        </View>
        <View style={[styles.stampTileBadge, item.isEarned ? styles.progressBadgeEarned : styles.progressBadgeLocked]}>
          <Text
            style={[
              styles.progressBadgeText,
              item.isEarned ? styles.progressBadgeTextEarned : styles.progressBadgeTextLocked,
            ]}
          >
            {item.isEarned ? 'Received' : 'Locked'}
          </Text>
        </View>
      </View>

      <View style={[styles.stampTileArtwork, { backgroundColor: visual.fill, borderColor: visual.ring }]}>
        {artUri ? (
          <Image
            source={{ uri: artUri }}
            style={[styles.stampTileImage, !item.isEarned ? styles.stampTileImageLocked : null]}
            accessibilityLabel={`${item.title} stamp art`}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.stampTileArtworkFrame}>
            <View style={[styles.stampTileSeal, { borderColor: visual.ring }]}>
              <Ionicons name={visual.iconName as any} size={26} color={visual.text} />
            </View>
            <Text style={[styles.stampTilePlaceholder, { color: visual.text }]}>Stamp Art Placeholder</Text>
          </View>
        )}
      </View>

      <View style={styles.stampTileBody}>
        <Text style={styles.stampTileTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.stampTileDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      <View style={styles.stampTileFooter}>
        <Text style={styles.stampTileCount}>
          {item.current}/{item.total}
        </Text>
        <Text style={styles.stampTileDate} numberOfLines={2}>
          {item.isEarned ? `Stamped ${formatStampDate(item.earnedAt)}` : 'Next milestone'}
        </Text>
      </View>
    </View>
  );
};

const InlineBanner = ({
  icon,
  title,
  body,
  actionLabel,
  onPress,
  tone = 'muted',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
  tone?: 'muted' | 'warning' | 'error';
}) => {
  const wrapperStyle =
    tone === 'error' ? styles.bannerError : tone === 'warning' ? styles.bannerWarning : styles.bannerMuted;
  const titleStyle =
    tone === 'error'
      ? styles.bannerTitleError
      : tone === 'warning'
        ? styles.bannerTitleWarning
        : styles.bannerTitleMuted;

  return (
    <View style={[styles.banner, wrapperStyle]}>
      <Ionicons name={icon} size={16} color={tone === 'error' ? theme.colors.error : theme.colors.textSecondary} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, titleStyle]}>{title}</Text>
        <Text style={styles.bannerBody}>{body}</Text>
      </View>
      {actionLabel && onPress ? (
        <TouchableOpacity style={styles.bannerAction} onPress={onPress} activeOpacity={0.88}>
          <Text style={styles.bannerActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const PassportScreen = () => {
  const navigation = useNavigation<TabNavigationProp>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, session, loading: profileLoading } = useProfile();
  const [snapshot, setSnapshot] = useState<PassportSnapshot>(EMPTY_SNAPSHOT);
  const [manifest, setManifest] = useState<Record<string, StampArtManifestEntry>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PassportTabKey>('stamps');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const hasAutoCenteredToDeviceRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapInitTimedOut, setMapInitTimedOut] = useState(false);
  const [deviceRegion, setDeviceRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const isSignedIn = !!session?.user?.id;
  const permissionPaused = snapshot.permissionStatus === 'denied';
  const isBackendSetupIssue =
    !!errorMessage &&
    (errorMessage.toLowerCase().includes('missing table public.passport_stamps') ||
      errorMessage.toLowerCase().includes("could not find the table 'public.passport_stamps'") ||
      errorMessage.toLowerCase().includes('008_passport_stamps_and_achievements.sql'));

  const loadSnapshot = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setErrorMessage(null);

    void stampArtService.fetchManifest(isRefresh).then(setManifest).catch(() => {});

    if (!isSignedIn) {
      const permissionStatus = (await passportService.getLocationPermissionStatus().catch(() => 'undetermined')) as PassportLocationPermissionStatus;
      setSnapshot({
        ...EMPTY_SNAPSHOT,
        permissionStatus,
      });
      setSelectedPlaceId(null);
      setLoading(false);
      return;
    }

    try {
      const next = await passportService.loadSnapshot();
      setSnapshot(next);
    } catch (error: any) {
      const permissionStatus = (await passportService.getLocationPermissionStatus().catch(() => 'undetermined')) as PassportLocationPermissionStatus;
      setSnapshot({
        ...EMPTY_SNAPSHOT,
        permissionStatus,
      });
      setErrorMessage(error?.message || 'Passport sync is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      if (profileLoading) {
        return undefined;
      }
      void loadSnapshot(false);
      return undefined;
    }, [loadSnapshot, profileLoading]),
  );

  const visibleStamps = useMemo(() => (isSignedIn ? snapshot.stamps : []), [isSignedIn, snapshot.stamps]);
  const mappedStamps = useMemo(
    () => visibleStamps.filter(stamp => stamp.lat != null && stamp.lng != null),
    [visibleStamps],
  );
  const hasMapTargets = mappedStamps.length > 0;
  const latestStamp = visibleStamps[0] || null;

  const progressStampItems = useMemo(() => {
    const earnedByKey = new Map<string, PassportAchievement>(
      snapshot.achievements.map(item => [item.achievementKey, item]),
    );

    return listAchievementDefinitions().map(definition => {
      const progress = computeProgressValue(definition, snapshot);
      const earned = earnedByKey.get(definition.key);
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        current: progress.current,
        total: progress.total,
        isEarned: Boolean(earned),
        earnedAt: earned?.unlockedAt || null,
      };
    });
  }, [snapshot]);

  const earnedProgressStampItems = useMemo(
    () => progressStampItems.filter(item => item.isEarned),
    [progressStampItems],
  );
  const lockedProgressStampItems = useMemo(
    () => progressStampItems.filter(item => !item.isEarned),
    [progressStampItems],
  );

  const initialMapRegion = useMemo(() => {
    if (deviceRegion) {
      return deviceRegion;
    }
    if (mappedStamps.length > 0) {
      const lats = mappedStamps.map(stamp => stamp.lat as number);
      const lngs = mappedStamps.map(stamp => stamp.lng as number);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.45, 2),
        longitudeDelta: Math.max((maxLng - minLng) * 1.45, 2),
      };
    }
    if (profile?.home_lat && profile?.home_lng) {
      return {
        latitude: profile.home_lat,
        longitude: profile.home_lng,
        latitudeDelta: 16,
        longitudeDelta: 16,
      };
    }
    return {
      latitude: 39.5,
      longitude: -98.35,
      latitudeDelta: 34,
      longitudeDelta: 34,
    };
  }, [deviceRegion, mappedStamps, profile]);

  useEffect(() => {
    setMapReady(false);
    setMapInitTimedOut(false);
  }, [mappedStamps.length]);

  useEffect(() => {
    let cancelled = false;

    const hydrateDeviceRegion = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!cancelled) {
            setDeviceRegion(null);
            hasAutoCenteredToDeviceRef.current = false;
          }
          return;
        }

        const lastKnown = await Location.getLastKnownPositionAsync();
        const resolved =
          lastKnown ||
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));

        if (!resolved || cancelled) {
          return;
        }

        setDeviceRegion({
          latitude: resolved.coords.latitude,
          longitude: resolved.coords.longitude,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18,
        });
      } catch {
        if (!cancelled) {
          setDeviceRegion(null);
          hasAutoCenteredToDeviceRef.current = false;
        }
      }
    };

    void hydrateDeviceRegion();

    return () => {
      cancelled = true;
    };
  }, [snapshot.permissionStatus]);

  useEffect(() => {
    if (!MapView || mapReady) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setMapInitTimedOut(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !deviceRegion || hasAutoCenteredToDeviceRef.current) {
      return;
    }

    mapRef.current.animateToRegion(deviceRegion, 700);
    hasAutoCenteredToDeviceRef.current = true;
  }, [deviceRegion, mapReady]);

  const focusStamp = useCallback((stamp: PassportStamp) => {
    setSelectedPlaceId(stamp.placeId);
    setActiveTab('places');
    setDrawerOpen(true);
    if (stamp.lat != null && stamp.lng != null && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: stamp.lat,
          longitude: stamp.lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        650,
      );
    }
  }, []);

  const handleOpenLogin = useCallback(() => {
    rootNavigation?.navigate('Login');
  }, [rootNavigation]);

  const handleOpenSignUp = useCallback(() => {
    rootNavigation?.navigate('SignUp');
  }, [rootNavigation]);

  const handleRailPress = useCallback(
    (tab: PassportTabKey) => {
      if (drawerOpen && activeTab === tab) {
        setDrawerOpen(false);
        return;
      }
      setActiveTab(tab);
      setDrawerOpen(true);
    },
    [activeTab, drawerOpen],
  );

  const activeTabMeta = useMemo(
    () => TAB_META.find(item => item.key === activeTab) || TAB_META[0],
    [activeTab],
  );

  const renderGuestCallout = useCallback(
    (title: string, body: string) => (
      <View style={styles.guestDrawerCallout}>
        <Text style={styles.guestDrawerTitle}>{title}</Text>
        <Text style={styles.guestDrawerBody}>{body}</Text>
        <View style={styles.guestDrawerActions}>
          <TouchableOpacity style={styles.guestDrawerPrimary} onPress={handleOpenLogin} activeOpacity={0.88}>
            <Text style={styles.guestDrawerPrimaryText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guestDrawerSecondary} onPress={handleOpenSignUp} activeOpacity={0.88}>
            <Text style={styles.guestDrawerSecondaryText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleOpenLogin, handleOpenSignUp],
  );

  const renderDrawerNotices = () => (
    <>
      {!mapReady && mapInitTimedOut ? (
        <InlineBanner
          icon="alert-circle-outline"
          title="Map did not initialize"
          body="Reopen the app, then verify the maps setup in this build."
          tone="error"
        />
      ) : null}
      {errorMessage ? (
        <InlineBanner
          icon="alert-circle-outline"
          title={isBackendSetupIssue ? 'Backend setup required' : 'Passport sync issue'}
          body={
            isBackendSetupIssue
              ? 'Passport tables are missing in the connected Supabase project. Apply migration 008_passport_stamps_and_achievements.sql, then retry.'
              : errorMessage
          }
          actionLabel="Retry"
          onPress={() => void loadSnapshot(true)}
          tone="error"
        />
      ) : null}
      {snapshot.offline ? (
        <InlineBanner
          icon="cloud-offline-outline"
          title="Offline snapshot"
          body={`Showing the last synced passport snapshot${snapshot.offlineSavedAt ? ` from ${formatStampDate(snapshot.offlineSavedAt)}` : '.'}`}
          tone="warning"
        />
      ) : null}
      {permissionPaused && isSignedIn ? (
        <InlineBanner
          icon="location-outline"
          title="Auto-stamp paused"
          body="Location permission is off, so Passport can show your history but cannot stamp the next stop yet."
          actionLabel="Settings"
          onPress={() => {
            void Linking.openSettings();
          }}
          tone="muted"
        />
      ) : null}
    </>
  );

  const renderGuestPanel = () => {
    if (activeTab === 'stamps') {
      return renderGuestCallout(
        'Sign in to view passport stamps.',
        'Achievement stamps are tied to your account and appear here after verified visits and milestone runs.',
      );
    }
    if (activeTab === 'places') {
      return renderGuestCallout(
        'Sign in to view visited places.',
        'Your place history stays private to the traveler and only loads after sign-in.',
      );
    }
    return renderGuestCallout(
      'Sign in to view travel stats.',
      'Places visited, countries, and your latest stamped stop are all account-based travel data.',
    );
  };

  const renderPassportStampsPanel = () => {
    if (!isSignedIn) {
      return (
        <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          {renderGuestPanel()}
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        {renderDrawerNotices()}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionEyebrow}>Passport stamps</Text>
          <Text style={styles.sectionTitle}>Achievement stamps already received</Text>
          <Text style={styles.sectionBodyText}>
            Earned stamps stay at the top. Locked stamps stay visible underneath so the next milestone is always readable.
          </Text>
        </View>

        {earnedProgressStampItems.length ? (
          <>
            <Text style={styles.subsectionLabel}>Received</Text>
            <View style={styles.stampGrid}>
              {earnedProgressStampItems.map(item => (
                <AchievementStampTile key={item.key} item={item} manifestEntry={manifest[item.key]} />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyPanelCard}>
            <Text style={styles.emptyPanelTitle}>No passport stamps received yet</Text>
            <Text style={styles.emptyPanelBody}>
              Your first achievement stamp appears after the first verified stop lands in Passport.
            </Text>
          </View>
        )}

        {lockedProgressStampItems.length ? (
          <>
            <Text style={styles.subsectionLabel}>In range</Text>
            <View style={styles.stampGrid}>
              {lockedProgressStampItems.map(item => (
                <AchievementStampTile key={item.key} item={item} manifestEntry={manifest[item.key]} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  };

  const renderPlacesPanel = () => {
    if (!isSignedIn) {
      return (
        <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          {renderGuestPanel()}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={visibleStamps}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.drawerListContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        ListHeaderComponent={
          <>
            {renderDrawerNotices()}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>Places</Text>
              <Text style={styles.sectionTitle}>Visited places, newest first</Text>
              <Text style={styles.sectionBodyText}>
                Tap any visited place to pull the map camera into that stop and keep the drawer aligned to the same visit.
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <PlaceStampCard
            title={item.title}
            city={item.city || 'Unknown city'}
            dateLabel={formatStampDate(item.stampedAt)}
            visualKey={item.placeId}
            selected={selectedPlaceId === item.placeId}
            onPress={() => focusStamp(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyPanelCard}>
            <Text style={styles.emptyPanelTitle}>No visited places yet</Text>
            <Text style={styles.emptyPanelBody}>
              Once your first stop is auto-stamped, it will appear here in chronological order.
            </Text>
          </View>
        }
      />
    );
  };

  const renderStatsPanel = () => {
    if (!isSignedIn) {
      return (
        <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          {renderGuestPanel()}
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        {renderDrawerNotices()}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionEyebrow}>Stats</Text>
          <Text style={styles.sectionTitle}>Travel data at a glance</Text>
          <Text style={styles.sectionBodyText}>
            A compact read on your atlas: how many places you have stamped, how many countries those stops span, and the latest verified visit.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <AtlasStat value={String(snapshot.stats.totalStampedStops)} label="Places" />
          <AtlasStat value={String(snapshot.stats.uniqueCountries)} label="Countries" />
          <AtlasStat
            value={formatStampDate(snapshot.stats.lastStampAt)}
            label="Latest"
            detail={latestStamp ? latestStamp.title : 'No stamped stop yet'}
          />
        </View>

        <View style={styles.latestStrip}>
          <Text style={styles.latestStripLabel}>Latest place</Text>
          <Text style={styles.latestStripTitle}>{latestStamp ? latestStamp.title : 'No stamped stop yet'}</Text>
          <Text style={styles.latestStripMeta}>
            {latestStamp
              ? `${latestStamp.city || 'Unknown city'} - ${formatStampDate(latestStamp.stampedAt)}`
              : 'The latest field will update as soon as the first verified stop lands.'}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderDrawerContent = () => {
    if (activeTab === 'stamps') {
      return renderPassportStampsPanel();
    }
    if (activeTab === 'places') {
      return renderPlacesPanel();
    }
    return renderStatsPanel();
  };

  if (loading || profileLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Preparing your passport</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFillObject}>
        {MapView ? (
          <View style={StyleSheet.absoluteFillObject}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              customMapStyle={editorialMapStyle}
              initialRegion={initialMapRegion}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              onMapReady={() => {
                setMapReady(true);
                setMapInitTimedOut(false);
              }}
            >
              {mappedStamps.map(stamp => {
                const selected = selectedPlaceId === stamp.placeId;
                return (
                  <Marker
                    key={stamp.id}
                    coordinate={{
                      latitude: stamp.lat as number,
                      longitude: stamp.lng as number,
                    }}
                    onPress={() => focusStamp(stamp)}
                  >
                    <View style={[styles.mapMarker, selected && styles.mapMarkerSelected]}>
                      <View style={[styles.mapMarkerDot, selected && styles.mapMarkerDotSelected]} />
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {isSignedIn && !hasMapTargets && mapReady ? (
              <View
                style={[
                  styles.mapOverlayHint,
                  {
                    bottom: drawerOpen ? DRAWER_HEIGHT + RAIL_HEIGHT + 28 : RAIL_HEIGHT + 26,
                  },
                ]}
              >
                <Text style={styles.mapOverlayHintText}>
                  No visited places have been stamped yet. The atlas is ready the moment the first stop lands.
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={48} color={palette.mediumGray} />
            <Text style={styles.mapFallbackText}>MAP OFFLINE</Text>
          </View>
        )}
      </View>

      {drawerOpen ? (
        <View style={styles.drawerShell}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHandle} />
              <View style={styles.drawerTitleRow}>
                <View>
                  <Text style={styles.drawerEyebrow}>Passport</Text>
                  <Text style={styles.drawerTitle}>{activeTabMeta.title}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Collapse passport drawer"
                  style={styles.drawerClose}
                  onPress={() => setDrawerOpen(false)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="close-outline" size={18} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.drawerBody}>{renderDrawerContent()}</View>
          </View>
        </View>
      ) : null}

      <View style={styles.railShell}>
        <View style={styles.rail}>
          {TAB_META.map(tab => (
            <RailButton
              key={tab.key}
              label={tab.label}
              icon={tab.icon}
              active={drawerOpen && activeTab === tab.key}
              onPress={() => handleRailPress(tab.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const editorialMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f4f2ee' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6d6a66' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f4f2ee' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#dad4cc' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#524d47' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ede7df' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e1d8cd' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#fbfaf8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde7ea' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#74838a' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  stateTitle: {
    marginTop: 12,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.typography.fonts.black,
    letterSpacing: 0.8,
  },
  mapFallback: {
    flex: 1,
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: {
    marginTop: 12,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 12,
    color: palette.mediumGray,
    letterSpacing: 2,
  },
  mapOverlayHint: {
    position: 'absolute',
    left: 24,
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(249,249,251,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    alignItems: 'center',
  },
  mapOverlayHintText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.narrativeMedium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  mapMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(26,26,26,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarkerSelected: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(26,26,26,0.18)',
    borderColor: theme.colors.textPrimary,
  },
  mapMarkerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.textPrimary,
  },
  mapMarkerDotSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  drawerShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: RAIL_HEIGHT + 10,
  },
  drawer: {
    height: DRAWER_HEIGHT,
    borderRadius: 26,
    backgroundColor: 'rgba(249,249,251,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    overflow: 'hidden',
  },
  drawerHeader: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,26,26,0.06)',
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(26,26,26,0.14)',
    marginBottom: 12,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  drawerEyebrow: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  drawerTitle: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 22,
    lineHeight: 24,
  },
  drawerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
    gap: 12,
  },
  drawerListContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  railShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
  },
  rail: {
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(249,249,251,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  railButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  railButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderColor: 'rgba(26,26,26,0.08)',
  },
  railButtonText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  railButtonTextActive: {
    color: theme.colors.textPrimary,
  },
  guestDrawerCallout: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  guestDrawerTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 20,
    lineHeight: 22,
  },
  guestDrawerBody: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  guestDrawerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  guestDrawerPrimary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestDrawerPrimaryText: {
    color: palette.white,
    fontFamily: theme.typography.fonts.black,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  guestDrawerSecondary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestDrawerSecondaryText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  banner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bannerMuted: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bannerWarning: {
    backgroundColor: 'rgba(249,168,37,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(138,74,0,0.22)',
  },
  bannerError: {
    backgroundColor: 'rgba(198,40,40,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198,40,40,0.18)',
  },
  bannerCopy: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  bannerTitleMuted: {
    color: theme.colors.textPrimary,
  },
  bannerTitleWarning: {
    color: '#8A4A00',
  },
  bannerTitleError: {
    color: theme.colors.error,
  },
  bannerBody: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 17,
  },
  bannerAction: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.softGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerActionText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 18,
    lineHeight: 22,
  },
  sectionBodyText: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  subsectionLabel: {
    marginTop: 4,
    marginBottom: 10,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statsGrid: {
    gap: 12,
  },
  statTile: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 20,
    lineHeight: 22,
  },
  statLabel: {
    marginTop: 5,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statDetail: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 16,
  },
  latestStrip: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  latestStripLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  latestStripTitle: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 18,
    lineHeight: 20,
  },
  latestStripMeta: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
  rowCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rowCardSelected: {
    borderColor: theme.colors.textPrimary,
  },
  rowSeal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSealGlyph: {
    fontFamily: theme.typography.fonts.black,
    fontSize: 20,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 16,
    lineHeight: 18,
  },
  rowMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowDate: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 12,
    lineHeight: 16,
  },
  rowAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.softGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampTile: {
    width: '48.2%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    aspectRatio: 0.94,
  },
  stampTileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  stampTileGroup: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  stampTileSerial: {
    marginTop: 3,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  stampTileArtwork: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 2,
    minHeight: 98,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stampTileArtworkFrame: {
    width: '100%',
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stampTileImage: {
    width: '100%',
    height: '100%',
  },
  stampTileImageLocked: {
    opacity: 0.4,
  },
  stampTileSeal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  stampTilePlaceholder: {
    marginTop: 8,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stampTileBody: {
    marginTop: 10,
  },
  stampTileTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 14,
    lineHeight: 17,
  },
  stampTileDescription: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 11,
    lineHeight: 14,
  },
  stampTileBadge: {
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBadgeEarned: {
    backgroundColor: 'rgba(46,108,77,0.12)',
  },
  progressBadgeLocked: {
    backgroundColor: palette.softGray,
  },
  progressBadgeText: {
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressBadgeTextEarned: {
    color: '#1F4A35',
  },
  progressBadgeTextLocked: {
    color: theme.colors.textSecondary,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: palette.softGray,
    marginTop: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.textPrimary,
  },
  stampTileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  stampTileCount: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 11,
  },
  stampTileDate: {
    flex: 1,
    textAlign: 'right',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 10,
    lineHeight: 13,
  },
  emptyPanelCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.08)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyPanelTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 16,
    lineHeight: 18,
  },
  emptyPanelBody: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default PassportScreen;
