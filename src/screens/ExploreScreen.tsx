import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TravisSignal } from '../components/TravisSignal';
import { useNotice } from '../components/TravisNotice';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import {
  AvailabilityBucket,
  DEFAULT_FILTERS,
  ExploreActivity,
  ExploreFilters,
  GroupType,
  MAX_MULTI_SELECT,
  ViewMode,
} from '../types/explore';
import { exploreService } from '../services/explore';
import { discoveryService } from '../services/discovery';

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

const CATEGORIES = ['Outdoor', 'Culture', 'Food', 'Nightlife', 'Family', 'Hidden Gems'];
const PRICE_OPTIONS = ['free', 'budget', 'mid', 'premium'] as const;
const DURATION_OPTIONS = [
  { id: 'lt60' as const, label: '<1h' },
  { id: '60_180' as const, label: '1-3h' },
  { id: '181_360' as const, label: '3-6h' },
  { id: 'gt360' as const, label: '6h+' },
];
const AVAILABILITY_OPTIONS: AvailabilityBucket[] = ['today', 'this_week', 'weekend'];
const GROUP_OPTIONS: GroupType[] = ['solo', 'couple', 'family', 'friends'];
const ACCESSIBILITY_OPTIONS = ['wheelchair', 'kid-friendly', 'quiet', 'indoor'];
const RATING_OPTIONS = [null, 3, 4, 4.5] as const;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MultiFilterKey = 'categories' | 'priceTiers' | 'durations' | 'availability' | 'groupTypes' | 'accessibility';

const defaultRegion = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const priceLabel = (tier: ExploreActivity['priceTier']) => {
  if (tier === 'free') return 'Free';
  if (tier === 'budget') return '$';
  if (tier === 'mid') return '$$';
  if (tier === 'premium') return '$$$';
  return 'Unknown';
};

const toTitle = (value: string) =>
  value
    .split('_')
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const ExploreScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<any>(null);
  const { showNotice } = useNotice();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [radiusMeters, setRadiusMeters] = useState(8000);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activities, setActivities] = useState<ExploreActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlineLikely, setOfflineLikely] = useState(false);
  const [searchSessionId, setSearchSessionId] = useState<string | null>(null);

  const selectedActivity = useMemo(
    () => activities.find(activity => activity.id === selectedActivityId) || null,
    [activities, selectedActivityId]
  );
  const mapActivities = useMemo(
    () => activities.filter(activity => activity.lat != null && activity.lng != null),
    [activities]
  );

  useEffect(() => {
    exploreService.trackEvent({
      eventName: 'explore_viewed',
      metadata: { entry_source: 'home_tab' },
    });
  }, []);

  const runSearch = useCallback(
    async (params?: {
      queryOverride?: string;
      destinationOverride?: string | null;
      coordsOverride?: { lat: number; lng: number } | null;
      nearMeOverride?: boolean;
      radiusOverride?: number;
    }) => {
      const activeQuery = params?.queryOverride ?? query;
      const activeDestination = params?.destinationOverride ?? destination;
      const activeCoords = params?.coordsOverride ?? coords;
      const activeNearMe = params?.nearMeOverride ?? nearMeActive;
      const activeRadius = params?.radiusOverride ?? radiusMeters;

      if (!activeNearMe && !activeQuery.trim() && !activeDestination) {
        showNotice({
          title: 'ADD A DESTINATION',
          message: "Travis: 'Give me a city or hit Near Me and I will line up your options.'",
          type: 'info',
        });
        return;
      }

      setLoading(true);
      setHasSearched(true);
      setErrorMessage(null);
      setOfflineLikely(false);

      try {
        exploreService.trackEvent({
          eventName: 'explore_search_submitted',
          searchSessionId,
          metadata: {
            query: activeQuery,
            destination: activeDestination,
            near_me: activeNearMe,
          },
        });

        const startedAt = Date.now();
        const result = await exploreService.search({
          query: activeQuery,
          destination: activeDestination,
          nearMe: activeNearMe,
          coords: activeCoords,
          radiusMeters: activeRadius,
          filters,
        });
        const latency = Date.now() - startedAt;

        setActivities(result.activities);
        setSelectedActivityId(result.activities[0]?.id || null);

        const newSessionId = await exploreService.createSearchSession(filters, result.activities.length);
        setSearchSessionId(newSessionId);

        if (!result.activities.length) {
          exploreService.trackEvent({
            eventName: 'explore_search_no_results',
            searchSessionId: newSessionId,
            metadata: {
              query_present: Boolean(activeQuery.trim()),
              applied_filter_count:
                filters.categories.length +
                filters.priceTiers.length +
                filters.durations.length +
                filters.availability.length +
                filters.groupTypes.length +
                filters.accessibility.length +
                Number(filters.minRating != null),
            },
          });
        } else {
          exploreService.trackEvent({
            eventName: 'explore_search_results_loaded',
            searchSessionId: newSessionId,
            metadata: {
              result_count: result.activities.length,
              latency_ms: latency,
              provider_fallback: result.usedProviderFallback,
            },
          });
        }
      } catch (error: any) {
        const message = error?.message || 'Unable to load activities right now.';
        setErrorMessage(message);
        const likelyOffline = String(message).toLowerCase().includes('network');
        setOfflineLikely(likelyOffline);
        exploreService.trackEvent({
          eventName: 'screen_error_rendered',
          searchSessionId,
          metadata: {
            screen_name: 'explore',
            error_code: likelyOffline ? 'OFFLINE' : 'SEARCH_ERROR',
            retryable: true,
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [coords, destination, filters, nearMeActive, query, radiusMeters, searchSessionId, showNotice]
  );

  const handleSearchPress = useCallback(async () => {
    let nextCoords = coords;
    let nextDestination = destination;

    if (query.trim()) {
      const geocoded = await discoveryService.geocode(query.trim());
      if (geocoded) {
        nextCoords = geocoded;
        setCoords(geocoded);
      }
      nextDestination = query.trim();
      setDestination(query.trim());
      setNearMeActive(false);
    }

    await runSearch({
      queryOverride: query,
      destinationOverride: nextDestination,
      coordsOverride: nextCoords,
      nearMeOverride: false,
    });
  }, [coords, destination, query, runSearch]);

  const handleNearMePress = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setPermissionDenied(true);
      showNotice({
        title: 'LOCATION DENIED',
        message: "Travis: 'No worries. Search by destination and I will still build the list.'",
        type: 'warning',
      });
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    const nextCoords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setPermissionDenied(false);
    setCoords(nextCoords);
    setNearMeActive(true);

    const resolvedDestination = await discoveryService.reverseGeocode(nextCoords.lat, nextCoords.lng);
    setDestination(resolvedDestination);

    await runSearch({
      queryOverride: query,
      destinationOverride: resolvedDestination,
      coordsOverride: nextCoords,
      nearMeOverride: true,
    });
  }, [query, runSearch, showNotice]);

  const setView = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      exploreService.trackEvent({
        eventName: 'map_view_toggled',
        searchSessionId,
        metadata: { view_mode: mode },
      });
    },
    [searchSessionId]
  );

  useEffect(() => {
    if (!selectedActivity || viewMode !== 'map' || !mapRef.current) return;
    if (selectedActivity.lat == null || selectedActivity.lng == null) return;
    mapRef.current.animateToRegion(
      {
        latitude: selectedActivity.lat,
        longitude: selectedActivity.lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      },
      450
    );
  }, [selectedActivity, viewMode]);

  const toggleFilterValue = useCallback(
    (key: MultiFilterKey, value: string) => {
      setFilters(prev => {
        const currentValues = prev[key] as string[];
        const exists = currentValues.includes(value);

        if (!exists && currentValues.length >= MAX_MULTI_SELECT) {
          showNotice({
            title: 'FILTER LIMIT',
            message: `Pick up to ${MAX_MULTI_SELECT} options for this filter group.`,
            type: 'warning',
          });
          exploreService.trackEvent({
            eventName: 'filter_max_selection_reached',
            searchSessionId,
            metadata: { filter_group: key, attempted_value: value },
          });
          return prev;
        }

        const nextValues = exists
          ? currentValues.filter(item => item !== value)
          : [...currentValues, value];

        const next = { ...prev, [key]: nextValues };
        exploreService.trackEvent({
          eventName: exists ? 'filter_cleared' : 'filter_applied',
          searchSessionId,
          metadata: {
            filter_group: key,
            selected_count: nextValues.length,
            selection_values: nextValues,
          },
        });
        return next;
      });
    },
    [searchSessionId, showNotice]
  );

  const setMinRating = useCallback(
    (value: number | null) => {
      setFilters(prev => ({ ...prev, minRating: value }));
      exploreService.trackEvent({
        eventName: 'filter_applied',
        searchSessionId,
        metadata: {
          filter_group: 'min_rating',
          selected_count: value == null ? 0 : 1,
          selection_values: value == null ? [] : [value],
        },
      });
    },
    [searchSessionId]
  );

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    exploreService.trackEvent({
      eventName: 'filter_cleared',
      searchSessionId,
      metadata: { filter_group: 'all' },
    });
  }, [searchSessionId]);

  const widenRadius = useCallback(async () => {
    const nextRadius = Math.min(25000, radiusMeters + 3000);
    setRadiusMeters(nextRadius);
    await runSearch({ radiusOverride: nextRadius });
  }, [radiusMeters, runSearch]);

  const handleSelectFromMap = useCallback(
    (activity: ExploreActivity) => {
      setSelectedActivityId(activity.id);
      exploreService.trackEvent({
        eventName: 'map_pin_selected',
        searchSessionId,
        activityId: activity.canonicalKey || activity.id,
        metadata: {
          position_index: activities.findIndex(item => item.id === activity.id),
        },
      });
    },
    [activities, searchSessionId]
  );

  const handleSelectFromList = useCallback(
    (activity: ExploreActivity) => {
      setSelectedActivityId(activity.id);
      exploreService.trackEvent({
        eventName: 'list_card_selected',
        searchSessionId,
        activityId: activity.canonicalKey || activity.id,
        metadata: {
          position_index: activities.findIndex(item => item.id === activity.id),
        },
      });
    },
    [activities, searchSessionId]
  );

  const handleOpenDetails = useCallback(
    (activity: ExploreActivity) => {
      navigation.navigate('LocationDetails', {
        locationId: activity.canonicalKey || activity.id,
      });
    },
    [navigation]
  );

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderActivityCard = ({ item, index }: { item: ExploreActivity; index: number }) => {
    const selected = selectedActivityId === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={() => handleSelectFromList(item)}
        activeOpacity={0.92}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardPrice}>{priceLabel(item.priceTier)}</Text>
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {(item.city || destination || 'Unknown area').toUpperCase()} • {toTitle(item.source)}
        </Text>
        <Text style={styles.cardSummary} numberOfLines={2}>
          {item.summary || 'Travis says this stop deserves a look.'}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.ratingWrap}>
            <Ionicons name="star" size={14} color={theme.colors.primary} />
            <Text style={styles.ratingText}>
              {(item.ratingAverage || 0).toFixed(1)} {item.ratingCount ? `(${item.ratingCount})` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => handleOpenDetails(item)}
            activeOpacity={0.9}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
        {index === 0 && !selectedActivityId && <View style={styles.defaultSelectedBadge}><Text style={styles.defaultSelectedText}>TOP PICK</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <TravisSignal status={loading ? 'thinking' : 'tracking'} size={34} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search destination or vibe..."
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={handleSearchPress}
        />
        <TouchableOpacity style={styles.iconButton} onPress={handleSearchPress} activeOpacity={0.9}>
          <Ionicons name="search" size={18} color={theme.colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionPill, nearMeActive && styles.actionPillActive]} onPress={handleNearMePress}>
          <Ionicons name="locate" size={14} color={nearMeActive ? theme.colors.surface : theme.colors.textPrimary} />
          <Text style={[styles.actionPillText, nearMeActive && styles.actionPillTextActive]}>Near Me</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionPill} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options" size={14} color={theme.colors.textPrimary} />
          <Text style={styles.actionPillText}>Filters</Text>
        </TouchableOpacity>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setView('list')}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setView('map')}
          >
            <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
        {CATEGORIES.map(category =>
          renderChip(
            category,
            filters.categories.includes(category),
            () => toggleFilterValue('categories', category)
          )
        )}
      </ScrollView>

      {permissionDenied && (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>Location is off. Destination search still works.</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Finding your best options...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>{offlineLikely ? 'You look offline' : 'Search failed'}</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.recoveryButton} onPress={() => runSearch()}>
            <Text style={styles.recoveryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : hasSearched && !activities.length ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No matches yet</Text>
          <Text style={styles.stateText}>Try clearing filters or widening your search radius.</Text>
          <View style={styles.recoveryRow}>
            <TouchableOpacity style={styles.recoveryButton} onPress={clearAllFilters}>
              <Text style={styles.recoveryButtonText}>Clear Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.recoveryButton} onPress={widenRadius}>
              <Text style={styles.recoveryButtonText}>Widen Radius</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          renderItem={renderActivityCard}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : MapView ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={
              coords
                ? {
                    latitude: coords.lat,
                    longitude: coords.lng,
                    latitudeDelta: 0.12,
                    longitudeDelta: 0.12,
                  }
                : defaultRegion
            }
          >
            {mapActivities.map(activity => (
              <Marker
                key={activity.id}
                coordinate={{ latitude: activity.lat!, longitude: activity.lng! }}
                onPress={() => handleSelectFromMap(activity)}
                pinColor={selectedActivityId === activity.id ? theme.colors.primary : '#4b5563'}
              />
            ))}
          </MapView>
          {selectedActivity && (
            <View style={styles.mapSelectionCard}>
              <Text style={styles.mapSelectionTitle} numberOfLines={1}>
                {selectedActivity.title}
              </Text>
              <TouchableOpacity style={styles.detailsButton} onPress={() => handleOpenDetails(selectedActivity)}>
                <Text style={styles.detailsButtonText}>Open Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Map unavailable</Text>
          <Text style={styles.stateText}>List mode is fully available on this device build.</Text>
        </View>
      )}

      {filterOpen && (
        <View style={styles.filterOverlay}>
          <TouchableOpacity style={styles.filterBackdrop} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Refine Search</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Price</Text>
              <View style={styles.filterGroup}>
                {PRICE_OPTIONS.map(option =>
                  renderChip(option.toUpperCase(), filters.priceTiers.includes(option), () =>
                    toggleFilterValue('priceTiers', option)
                  )
                )}
              </View>

              <Text style={styles.filterLabel}>Duration</Text>
              <View style={styles.filterGroup}>
                {DURATION_OPTIONS.map(option =>
                  renderChip(option.label, filters.durations.includes(option.id), () =>
                    toggleFilterValue('durations', option.id)
                  )
                )}
              </View>

              <Text style={styles.filterLabel}>Availability</Text>
              <View style={styles.filterGroup}>
                {AVAILABILITY_OPTIONS.map(option =>
                  renderChip(toTitle(option), filters.availability.includes(option), () =>
                    toggleFilterValue('availability', option)
                  )
                )}
              </View>

              <Text style={styles.filterLabel}>Minimum Rating</Text>
              <View style={styles.filterGroup}>
                {RATING_OPTIONS.map(option =>
                  renderChip(
                    option == null ? 'Any' : `${option}+`,
                    filters.minRating === option,
                    () => setMinRating(option)
                  )
                )}
              </View>

              <Text style={styles.filterLabel}>Group Type</Text>
              <View style={styles.filterGroup}>
                {GROUP_OPTIONS.map(option =>
                  renderChip(toTitle(option), filters.groupTypes.includes(option), () =>
                    toggleFilterValue('groupTypes', option)
                  )
                )}
              </View>

              <Text style={styles.filterLabel}>Accessibility</Text>
              <View style={styles.filterGroup}>
                {ACCESSIBILITY_OPTIONS.map(option =>
                  renderChip(toTitle(option), filters.accessibility.includes(option), () =>
                    toggleFilterValue('accessibility', option)
                  )
                )}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={clearAllFilters}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  setFilterOpen(false);
                  await runSearch();
                }}
              >
                <Text style={styles.primaryButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  iconButton: {
    height: 50,
    width: 50,
    borderRadius: 14,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    gap: 5,
  },
  actionPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  actionPillTextActive: {
    color: '#fff',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  toggleText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#fff',
  },
  categoriesRow: {
    paddingBottom: theme.spacing.md,
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#fff',
  },
  inlineNotice: {
    backgroundColor: 'rgba(183, 28, 28, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 28, 28, 0.3)',
    padding: 10,
    marginBottom: theme.spacing.md,
  },
  inlineNoticeText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 110,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  cardMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  cardSummary: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 10,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailsButton: {
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  detailsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  defaultSelectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(183, 28, 28, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultSelectedText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  mapSelectionCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSelectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  stateTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  recoveryRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  recoveryButton: {
    marginTop: 14,
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recoveryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  filterSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '78%',
    padding: 18,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  filterLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 10,
    marginBottom: 6,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.textPrimary,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    width: 96,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default ExploreScreen;
