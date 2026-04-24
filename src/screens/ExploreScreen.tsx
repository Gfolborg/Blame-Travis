import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { 
  Map as MapIcon, 
  LayoutGrid, 
  Star, 
  Plus,
  X,
  ChevronRight,
  LocateFixed,
  SlidersHorizontal,
  AlignJustify,
  Search as SearchIcon,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotiView, AnimatePresence } from 'moti';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { EditorialSkeleton } from '../components/EditorialSkeleton';
import { TravisSignal } from '../components/TravisSignal';
import { useNotice } from '../components/TravisNotice';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import {
  AvailabilityBucket,
  DEFAULT_FILTERS,
  ExploreActivity,
  ExploreFilters,
  MAX_MULTI_SELECT,
  ViewMode,
} from '../types/explore';
import { exploreService } from '../services/explore';
import { discoveryService } from '../services/discovery';
import { itineraryService } from '../services/itinerary';
import { ItineraryDay } from '../types/itinerary';

const { height } = Dimensions.get('window');

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
} catch {
  MapView = null;
  Marker = null;
  Polyline = null;
}

const CATEGORIES = [
  { id: 'near_me', label: 'Nearby', image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=400' },
  { id: 'outdoor', label: 'Outdoor', image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&q=80&w=400' },
  { id: 'culture', label: 'Culture', image: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&q=80&w=400' },
  { id: 'food', label: 'Food', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400' },
  { id: 'nightlife', label: 'Nightlife', image: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?auto=format&fit=crop&q=80&w=400' },
  { id: 'family', label: 'Family', image: 'https://images.unsplash.com/photo-1502086223501-7ea6ec798682?auto=format&fit=crop&q=80&w=400' },
  { id: 'hidden_gems', label: 'Secret', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=400' },
];

const POPULAR_CITIES = [
  { id: 'paris', label: 'Paris', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=400' },
  { id: 'tokyo', label: 'Tokyo', image: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&q=80&w=400' },
  { id: 'new_york', label: 'New York', image: 'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&q=80&w=400' },
  { id: 'london', label: 'London', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=400' },
  { id: 'bali', label: 'Bali', image: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&q=80&w=400' },
];

const DURATION_OPTIONS = [
  { id: 'lt60' as const, label: '< 1h' },
  { id: '60_180' as const, label: '1 - 3h' },
  { id: '181_360' as const, label: '3 - 6h' },
  { id: 'gt360' as const, label: '6h+' },
];
const AVAILABILITY_OPTIONS: AvailabilityBucket[] = ['today', 'this_week', 'weekend'];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MultiFilterKey = 'categories' | 'priceTiers' | 'durations' | 'availability' | 'groupTypes' | 'accessibility';
const FILTER_LIMITS: Record<MultiFilterKey, number> = {
  categories: MAX_MULTI_SELECT,
  priceTiers: MAX_MULTI_SELECT,
  durations: MAX_MULTI_SELECT,
  availability: 1,
  groupTypes: 2,
  accessibility: MAX_MULTI_SELECT,
};

const defaultRegion = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Luxury Light Map Style
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
];

const toTitle = (value: string) =>
  value
    .split('_')
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const normalizeIdentity = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('provider:') ? value.replace('provider:', '') : value;
};

const getActivityIdentity = (activity: Pick<ExploreActivity, 'id' | 'canonicalKey'>) =>
  normalizeIdentity(activity.id);

const getActivityIdentityKeys = (activity: Pick<ExploreActivity, 'id' | 'canonicalKey'>) => {
  const keys = new Set<string>();
  keys.add(normalizeIdentity(activity.id));
  if (activity.canonicalKey) {
    keys.add(normalizeIdentity(activity.canonicalKey));
  }
  return keys;
};

const ExploreScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<any>(null);
  const inlineSearchRef = useRef<TextInput>(null);
  const { showNotice } = useNotice();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [listLayout, setListLayout] = useState<'list' | 'grid'>('list');
  const [activities, setActivities] = useState<ExploreActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingVibeId, setPendingVibeId] = useState<string | null>(null);
  const [showVibeSearchHint, setShowVibeSearchHint] = useState(false);
  // Curation State
  const [dayPickerTarget, setDayPickerTarget] = useState<ExploreActivity | null>(null);
  const [itineraryDays, setItineraryDays] = useState<number[]>([]);
  const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);
  const [itineraryStops, setItineraryStops] = useState<{ lat: number; lng: number }[]>([]);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<Set<string>>(new Set());
  const [addingToItinerary, setAddingToItinerary] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    itineraryId: string;
    dayIndex: number;
    duplicateDayIndex: number;
  } | null>(null);

  const loadItineraryContext = useCallback(async (selectedId?: string | null) => {
    try {
      const builder = await itineraryService.loadBuilderData(selectedId);
      setActiveItineraryId(builder.activeItineraryId);
      if (builder.bundle) {
        const days = builder.bundle.days.map((d: ItineraryDay) => d.dayIndex);
        setItineraryDays(days.length > 0 ? days : [1]);

        // Fetch coords for Map Shadow
        const stops: { lat: number; lng: number }[] = [];
        builder.bundle.days.forEach((day: ItineraryDay) => {
          day.items.forEach(item => {
            if (item.lat && item.lng) stops.push({ lat: item.lat, lng: item.lng });
          });
        });
        setItineraryStops(stops);
      } else {
        setItineraryDays([1]);
        setItineraryStops([]);
      }
    } catch {
      console.warn('Failed to fetch itinerary context');
    }
  }, []);

  useEffect(() => {
    loadItineraryContext();
  }, [loadItineraryContext]);

  const resetToExploreLanding = useCallback(() => {
    setHasSearched(false);
    setActivities([]);
    setQuery('');
    setDestination(null);
    setCoords(null);
    setNearMeActive(false);
    setPendingVibeId(null);
    setShowVibeSearchHint(false);
    setFilterOpen(false);
    setFilters(DEFAULT_FILTERS);
    setListLayout('list');
    setViewMode('list');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItineraryContext();

      const onBackPress = () => {
        if (duplicatePrompt || dayPickerTarget) {
          setDuplicatePrompt(null);
          setDayPickerTarget(null);
          return true;
        }
        if (filterOpen) {
          setFilterOpen(false);
          return true;
        }
        if (viewMode === 'map') {
          setViewMode('list');
          return true;
        }
        if (showVibeSearchHint) {
          setShowVibeSearchHint(false);
          setPendingVibeId(null);
          return true;
        }
        if (hasSearched) {
          resetToExploreLanding();
          return true;
        }
        return false;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [loadItineraryContext, duplicatePrompt, dayPickerTarget, filterOpen, viewMode, showVibeSearchHint, hasSearched, resetToExploreLanding])
  );

  useEffect(() => {
    if (!dayPickerTarget) {
      setDuplicatePrompt(null);
    }
  }, [dayPickerTarget]);

  useEffect(() => {
    if (query.trim().length > 0) {
      setShowVibeSearchHint(false);
    }
  }, [query]);

  const assignableDays = useMemo(() => {
    const days = itineraryDays.length ? itineraryDays : [1];
    const nextDay = Math.max(...days) + 1;
    return [...days, nextDay];
  }, [itineraryDays]);

  const vibeOptions = useMemo(() => CATEGORIES.filter(category => category.id !== 'near_me'), []);
  const hasLocationContext = useMemo(
    () => nearMeActive || Boolean(query.trim()) || Boolean(destination?.trim()),
    [destination, nearMeActive, query],
  );

  const completeAddToDay = useCallback(
    async (activity: ExploreActivity, dayIndex: number, itineraryId: string, duplicateOverride: boolean) => {
      setAddingToItinerary(true);
      try {
        const nextBundle = await itineraryService.addActivityToDay({
          itineraryId,
          activityId: activity.id,
          dayIndex,
        });
        const days = nextBundle.days.map(day => day.dayIndex);
        setItineraryDays(days.length ? days : [1]);
        const stops = nextBundle.days.flatMap(day =>
          day.items
            .filter(item => item.lat != null && item.lng != null)
            .map(item => ({ lat: item.lat as number, lng: item.lng as number })),
        );
        setItineraryStops(stops);
        setDismissedActivityIds(current => new Set(current).add(getActivityIdentity(activity)));

        AccessibilityInfo.announceForAccessibility(`Added ${activity.title} to day ${dayIndex}`);
        exploreService.trackEvent({
          eventName: 'itinerary_item_added',
          activityId: activity.id,
          metadata: {
            itinerary_id: itineraryId,
            day_index: dayIndex,
            source: 'explore',
            duplicate_override: duplicateOverride,
          },
        });
      } catch (error: any) {
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not add this stop to your itinerary right now.',
          type: 'error',
        });
      } finally {
        setAddingToItinerary(false);
        setDuplicatePrompt(null);
        setDayPickerTarget(null);
      }
    },
    [showNotice],
  );

  const handleAddToDayPress = useCallback(
    async (dayIndex: number) => {
      if (!dayPickerTarget || addingToItinerary) return;
      try {
        const ensured = await itineraryService.ensureActiveItinerary({
          destinationCity: destination || query || dayPickerTarget.city || 'Open Road',
        });
        setActiveItineraryId(ensured.itineraryId);
        if (ensured.created) {
          exploreService.trackEvent({
            eventName: 'itinerary_created_auto',
            metadata: { source: 'explore_add' },
          });
        }

        const builder = await itineraryService.loadBuilderData(ensured.itineraryId);
        const normalizedTargetKeys = getActivityIdentityKeys(dayPickerTarget);
        const duplicateDay = builder.bundle?.days.find(day =>
          day.items.some(item => normalizedTargetKeys.has(normalizeIdentity(item.activityId))),
        )?.dayIndex;

        if (duplicateDay) {
          setDuplicatePrompt({
            itineraryId: ensured.itineraryId,
            dayIndex,
            duplicateDayIndex: duplicateDay,
          });
          exploreService.trackEvent({
            eventName: 'itinerary_duplicate_warning_shown',
            activityId: dayPickerTarget.id,
            metadata: {
              itinerary_id: ensured.itineraryId,
              selected_day_index: dayIndex,
              duplicate_day_index: duplicateDay,
              source: 'explore',
            },
          });
          return;
        }

        await completeAddToDay(dayPickerTarget, dayIndex, ensured.itineraryId, false);
      } catch (error: any) {
        setDuplicatePrompt(null);
        setDayPickerTarget(null);
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not prepare this add right now.',
          type: 'error',
        });
      }
    },
    [addingToItinerary, completeAddToDay, dayPickerTarget, destination, query, showNotice],
  );

  const runSearch = useCallback(
    async (params?: { 
      queryOverride?: string;
      nearMeOverride?: boolean;
      coordsOverride?: { lat: number; lng: number } | null;
      filtersOverride?: ExploreFilters;
    }) => {
      const activeQuery = params?.queryOverride ?? query;
      const activeNearMe = params?.nearMeOverride ?? nearMeActive;
      const activeCoords = params?.coordsOverride ?? coords;
      const activeFilters = params?.filtersOverride ?? filters;

      if (!activeNearMe && !activeQuery.trim()) return;

      setLoading(true);
      setHasSearched(true);
      setFilterOpen(false);
      setShowVibeSearchHint(false);

      try {
        const result = await exploreService.search({
          query: activeNearMe ? '' : activeQuery,
          destination: activeNearMe ? 'Current Location' : activeQuery,
          nearMe: activeNearMe,
          coords: activeCoords,
          radiusMeters: 10000, // Default 10km for editorial search
          filters: activeFilters,
        });

        setActivities(result.activities);
        setDestination(activeNearMe ? 'Nearby' : activeQuery.trim());
        await loadItineraryContext(activeItineraryId);
      } catch (_error) {
        console.error(_error);
      } finally {
        setLoading(false);
      }
    },
    [activeItineraryId, query, filters, loadItineraryContext, coords, nearMeActive]
  );

  const handleNearMePress = useCallback(async (options?: { filtersOverride?: ExploreFilters }) => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      showNotice({
        title: 'LOCATION DENIED',
        message: "Travis: 'I need your location to find nearby curated experiences.'",
        type: 'warning',
      });
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    const nextCoords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setCoords(nextCoords);
    setNearMeActive(true);
    if (options?.filtersOverride) {
      setFilters(options.filtersOverride);
    }
    setPendingVibeId(null);
    setShowVibeSearchHint(false);
    await runSearch({
      nearMeOverride: true,
      coordsOverride: nextCoords,
      filtersOverride: options?.filtersOverride,
    });
  }, [runSearch, showNotice]);

  const handleSearchPress = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const nextFilters = pendingVibeId
      ? { ...filters, categories: [pendingVibeId] }
      : undefined;

    setNearMeActive(false);
    const geocoded = await discoveryService.geocode(trimmed);
    if (geocoded) setCoords(geocoded);
    if (nextFilters) {
      setFilters(nextFilters);
    }
    setPendingVibeId(null);
    setShowVibeSearchHint(false);
    await runSearch({ queryOverride: trimmed, nearMeOverride: false, filtersOverride: nextFilters });
  }, [query, pendingVibeId, filters, runSearch]);

  const handleVibePress = useCallback(
    async (vibeId: string) => {
      const isPendingSelected = pendingVibeId === vibeId;
      const isFilterSelected = filters.categories.includes(vibeId);

      if (!hasLocationContext) {
        if (isPendingSelected) {
          setPendingVibeId(null);
          setShowVibeSearchHint(false);
          return;
        }

        setPendingVibeId(vibeId);
        setShowVibeSearchHint(true);
        setNearMeActive(false);
        setTimeout(() => inlineSearchRef.current?.focus(), 20);
        return;
      }

      const nextFilters: ExploreFilters = {
        ...filters,
        categories: isFilterSelected ? [] : [vibeId],
      };

      setPendingVibeId(null);
      setShowVibeSearchHint(false);
      setFilters(nextFilters);
      await runSearch({ filtersOverride: nextFilters });
    },
    [filters, hasLocationContext, pendingVibeId, runSearch],
  );

  const toggleFilterValue = useCallback((key: MultiFilterKey, value: string) => {
    setFilters(prev => {
      const currentValues = prev[key] as string[];
      const exists = currentValues.includes(value);
      const selectionLimit = FILTER_LIMITS[key] ?? MAX_MULTI_SELECT;

      let nextValues: string[] = [];
      if (exists) {
        nextValues = currentValues.filter(item => item !== value);
      } else if (selectionLimit === 1) {
        nextValues = [value];
      } else {
        nextValues = [...currentValues, value];
      }
      return { ...prev, [key]: nextValues };
    });
  }, []);

  const setMinRating = useCallback((value: number | null) => {
    setFilters(prev => ({ ...prev, minRating: value }));
  }, []);

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  const renderActivityCard = ({ item, index }: { item: ExploreActivity; index: number }) => {
    const identity = getActivityIdentity(item);
    const isDismissed = dismissedActivityIds.has(identity);
    const isGrid = listLayout === 'grid';
    
    return (
      <AnimatePresence>
        {!isDismissed && (
          <MotiView
            from={{ opacity: 0, translateY: 30 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateX: 180, scale: 0.96 }}
            transition={{ type: 'timing', duration: 450, delay: index * (isGrid ? 50 : 100) }}
            style={[styles.storyCardContainer, isGrid && styles.storyCardGridContainer]}
          >
            <TouchableOpacity
              style={[styles.storyCard, isGrid && styles.storyCardGrid]}
              onPress={() => navigation.navigate('LocationDetails', { locationId: item.canonicalKey || item.id })}
              activeOpacity={0.95}
            >
              <MotiView
                from={{ scale: 1 }}
                animate={{ scale: 1.08 }}
                transition={{
                  type: 'timing',
                  duration: 15000,
                  loop: true,
                  repeatReverse: true,
                }}
                style={StyleSheet.absoluteFill}
              >
                <Image 
                  source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800' }} 
                  style={styles.storyImage} 
                />
              </MotiView>
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.8)']}
                style={styles.storyGradient}
              />
              <View style={[styles.storyContent, isGrid && styles.storyContentGrid]}>
                <View style={[styles.storyHeader, isGrid && styles.storyHeaderGrid]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storyVibe, isGrid && styles.storyVibeGrid]}>{(item.categories?.[0] || 'ADVENTURE').toUpperCase()}</Text>
                    <Text style={[styles.storyTitle, isGrid && styles.storyTitleGrid]} numberOfLines={isGrid ? 2 : 3}>{item.title}</Text>
                  </View>
                  {!isGrid && (
                    <TouchableOpacity
                      onPress={() => setDayPickerTarget(item)}
                      style={styles.storyHeart}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${item.title} to itinerary`}
                    >
                      <Plus size={24} color="#FFF" strokeWidth={2.2} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.storyFooter, isGrid && styles.storyFooterGrid]}>
                  <View style={styles.storyMeta}>
                    <Star size={isGrid ? 10 : 14} color="#FFF" fill="#FFF" />
                    <Text style={[styles.storyMetaText, isGrid && styles.storyMetaTextGrid]}>{item.ratingAverage?.toFixed(1) || '4.5'}</Text>
                    <View style={styles.storyDot} />
                    <Text style={[styles.storyMetaText, isGrid && styles.storyMetaTextGrid]}>{item.priceTier === 'premium' ? '$$$' : item.priceTier === 'mid' ? '$$' : '$'}</Text>
                  </View>
                  {!isGrid && (
                    <>
                      <View style={styles.storySignature}>
                        <Text style={styles.storySignatureText}>CURATED BY TRAVIS</Text>
                      </View>
                      <ChevronRight size={20} color="#FFF" />
                    </>
                  )}
                  {isGrid && (
                    <TouchableOpacity
                      onPress={() => setDayPickerTarget(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${item.title} to itinerary`}
                    >
                      <Plus size={18} color="#FFF" strokeWidth={2.2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>
    );
  };

  const activeVibeLabel = useMemo(
    () => vibeOptions.find(vibe => vibe.id === pendingVibeId)?.label ?? null,
    [pendingVibeId, vibeOptions],
  );
  const canUseMapToggle = hasSearched && activities.length > 0;

  const renderSearchInput = (compact = false) => (
    <View style={[styles.searchInputShell, compact && styles.searchInputShellCompact]}>
      <SearchIcon size={compact ? 16 : 20} color={theme.colors.textSecondary} />
      <TextInput
        ref={inlineSearchRef}
        style={[styles.searchInput, compact && styles.searchInputCompact]}
        placeholder="Where to..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="words"
        onSubmitEditing={() => {
          void handleSearchPress();
        }}
      />
      {query.trim().length > 0 && (
        <TouchableOpacity
          style={styles.searchSubmit}
          onPress={() => {
            void handleSearchPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Run search"
        >
          <Text style={styles.searchSubmitText}>Go</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        key={listLayout}
        data={activities}
        keyExtractor={item => item.id}
        renderItem={renderActivityCard}
        numColumns={listLayout === 'grid' ? 2 : 1}
        columnWrapperStyle={listLayout === 'grid' ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          hasSearched ? (
            <View style={styles.header}>
              {renderSearchInput(true)}

              <View style={styles.resultsHeader}>
                <Text style={styles.resultsLabel}>
                  {loading ? 'Curating the best experiences...' : `${activities.length} curated stops in ${destination}`}
                </Text>
                <View style={styles.resultsActions}>
                  <TouchableOpacity
                    onPress={() => setListLayout(listLayout === 'list' ? 'grid' : 'list')}
                    style={styles.actionIconButton}
                  >
                    {listLayout === 'list' ? <LayoutGrid size={16} color={theme.colors.textSecondary} /> : <AlignJustify size={16} color={theme.colors.textSecondary} />}
                    <Text style={styles.actionText}>{listLayout === 'list' ? 'Grid' : 'Feed'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFilterOpen(true)} style={styles.actionIconButton}>
                    <SlidersHorizontal size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.actionText}>Refine</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loading && (
                <View>
                  <EditorialSkeleton />
                  <EditorialSkeleton />
                </View>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !hasSearched ? (
            <View style={styles.emptyState}>
              <TravisSignal status="tracking" size={120} editorial />
              <Text style={styles.emptyTitle}>Where Shall We Go?</Text>
              <Text style={styles.emptySub}>Search to discover things to do.</Text>
              {renderSearchInput(false)}
              {showVibeSearchHint && pendingVibeId && (
                <View style={styles.searchHint}>
                  <Text style={styles.searchHintText}>Enter a location for {activeVibeLabel || 'this vibe'}.</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.nearMeShortcut}
                onPress={() => {
                  void handleNearMePress();
                }}
              >
                <LocateFixed size={20} color={theme.colors.primary} />
                <Text style={styles.nearMeShortcutText}>Explore near me</Text>
              </TouchableOpacity>

              <View style={styles.emptySection}>
                <Text style={styles.emptySectionTitle}>VIBES</Text>
                <FlatList
                  horizontal
                  data={vibeOptions}
                  keyExtractor={item => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vibesList}
                  renderItem={({ item }) => {
                    const isSelected =
                      filters.categories.includes(item.id) || pendingVibeId === item.id;
                    return (
                      <TouchableOpacity
                        style={styles.overlayTrendingItem}
                        onPress={() => {
                          void handleVibePress(item.id);
                        }}
                      >
                        <View style={[styles.trendingCircleSmall, isSelected && styles.trendingCircleSmallSelected]}>
                          <Image source={{ uri: item.image }} style={styles.trendingImage} />
                        </View>
                        <Text style={[styles.trendingLabelSmall, isSelected && styles.trendingLabelSmallSelected]}>
                          {item.label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>

              <View style={styles.emptySection}>
                <Text style={styles.emptySectionTitle}>POPULAR CITIES</Text>
                <FlatList
                  horizontal
                  data={POPULAR_CITIES}
                  keyExtractor={item => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vibesList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.overlayTrendingItem}
                      onPress={() => {
                        setQuery(item.label);
                        setNearMeActive(false);
                        setPendingVibeId(null);
                        setShowVibeSearchHint(false);
                        void runSearch({ queryOverride: item.label, nearMeOverride: false });
                      }}
                    >
                      <View style={styles.trendingCircleSmall}>
                        <Image source={{ uri: item.image }} style={styles.trendingImage} />
                      </View>
                      <Text style={styles.trendingLabelSmall}>{item.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          ) : !loading ? (
            <View style={styles.emptyState}>
              <TravisSignal status="thinking" size={120} editorial />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySub}>Travis couldn't find matches for this scan. Try another destination.</Text>
            </View>
          ) : null
        }
      />

      {/* Floating Map/List Toggle */}
      <View style={styles.floatingControls}>
        <TouchableOpacity 
          style={[styles.mapToggle, !canUseMapToggle && styles.mapToggleDisabled]} 
          onPress={() => {
            if (!canUseMapToggle) return;
            setViewMode(viewMode === 'list' ? 'map' : 'list');
          }}
          disabled={!canUseMapToggle}
        >
          {viewMode === 'list' ? <MapIcon size={20} color="#000" /> : <LayoutGrid size={20} color="#000" />}
          <Text style={[styles.mapToggleText, !canUseMapToggle && styles.mapToggleTextDisabled]}>
            {viewMode === 'list' ? 'Map' : 'List'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Day Picker Tray */}
      <AnimatePresence>
        {dayPickerTarget && (
          <>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.trayBackdrop}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => {
                  setDuplicatePrompt(null);
                  setDayPickerTarget(null);
                }}
              />
            </MotiView>
            <MotiView
              from={{ translateY: 300 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={styles.curateTray}
            >
              <Text style={styles.trayTitle}>ADD TO ITINERARY</Text>
              <Text style={styles.traySubtitle}>Assign "{dayPickerTarget.title}" to a day.</Text>

              {duplicatePrompt && (
                <View style={styles.duplicateInlineCard}>
                  <Text style={styles.duplicateInlineText}>
                    {duplicatePrompt.duplicateDayIndex === duplicatePrompt.dayIndex
                      ? `Already in Day ${duplicatePrompt.dayIndex}. Add another copy?`
                      : `Already in Day ${duplicatePrompt.duplicateDayIndex}. Add to Day ${duplicatePrompt.dayIndex} too?`}
                  </Text>
                  <View style={styles.duplicateInlineActions}>
                    <TouchableOpacity
                      style={styles.duplicateInlineCancel}
                      onPress={() => setDuplicatePrompt(null)}
                      disabled={addingToItinerary}
                    >
                      <Text style={styles.duplicateInlineCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.duplicateInlineConfirm}
                      onPress={() => {
                        if (!dayPickerTarget || !duplicatePrompt) return;
                        void completeAddToDay(
                          dayPickerTarget,
                          duplicatePrompt.dayIndex,
                          duplicatePrompt.itineraryId,
                          true,
                        );
                      }}
                      disabled={addingToItinerary}
                    >
                      <Text style={styles.duplicateInlineConfirmText}>Add Anyway</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <View style={styles.trayOptions}>
                {assignableDays.map(day => (
                  <TouchableOpacity 
                    key={day} 
                    style={styles.trayOption}
                    onPress={() => {
                      void handleAddToDayPress(day);
                    }}
                    disabled={addingToItinerary}
                  >
                    <Text style={styles.trayOptionText}>{day === Math.max(...assignableDays) ? `NEW DAY ${day}` : `DAY ${day}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.trayCancel}
                onPress={() => {
                  setDuplicatePrompt(null);
                  setDayPickerTarget(null);
                }}
                disabled={addingToItinerary}
              >
                <Text style={styles.trayCancelText}>{addingToItinerary ? 'ADDING...' : 'CANCEL'}</Text>
              </TouchableOpacity>
            </MotiView>
          </>
        )}
      </AnimatePresence>

      {/* Full-Screen Filter Overlay */}
      <AnimatePresence>
        {filterOpen && (
          <MotiView
            from={{ translateY: height }}
            animate={{ translateY: 0 }}
            exit={{ translateY: height }}
            transition={{ type: 'spring', damping: 40, stiffness: 180 }}
            style={styles.searchOverlay}
          >
            <SafeAreaView style={styles.searchSafe}>
              <View style={styles.searchHeader}>
                <TouchableOpacity onPress={() => setFilterOpen(false)}>
                  <X size={28} color="#000" strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.filterHeadline}>Refine your search</Text>
              
              <FlatList
                data={[
                  { key: 'VIBES', options: CATEGORIES.filter(c => c.id !== 'near_me').map(c => ({ id: c.id, label: c.label, image: c.image })), group: 'categories' },
                  { id: 'durations', key: 'DURATION', options: DURATION_OPTIONS.map(o => ({ id: o.id, label: o.label })), group: 'durations' },
                  { id: 'availability', key: 'AVAILABILITY', options: AVAILABILITY_OPTIONS.map(o => ({ id: o, label: toTitle(o) })), group: 'availability' },
                  { id: 'rating', key: 'MINIMUM RATING', options: [null, 3, 4, 4.5].map(o => ({ id: String(o), label: o == null ? 'ANY' : `${o}+` })), group: 'minRating' },
                ]}
                keyExtractor={item => item.key}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.filterGroupSection}>
                    <Text style={styles.filterGroupTitle}>{item.key}</Text>
                    {item.group === 'categories' ? (
                      <FlatList
                        horizontal
                        data={item.options}
                        keyExtractor={option => option.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterVibesRail}
                        renderItem={({ item: option }) => {
                          const isSelected = filters.categories.includes(option.id) || pendingVibeId === option.id;
                          return (
                            <TouchableOpacity
                              style={styles.overlayTrendingItem}
                              onPress={() => toggleFilterValue('categories', option.id)}
                            >
                              <View style={[styles.trendingCircleSmall, isSelected && styles.trendingCircleSmallSelected]}>
                                <Image source={{ uri: (option as { image?: string }).image }} style={styles.trendingImage} />
                              </View>
                              <Text style={[styles.trendingLabelSmall, isSelected && styles.trendingLabelSmallSelected]}>
                                {option.label.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        }}
                      />
                    ) : (
                      <View style={styles.filterOptionsGrid}>
                        {item.options.map(option => {
                          const isSelected = item.group === 'minRating'
                            ? filters.minRating === (option.id === 'null' ? null : Number(option.id))
                            : (filters[item.group as MultiFilterKey] as string[]).includes(option.id);
                          
                          return (
                            <TouchableOpacity 
                              key={option.id}
                              onPress={() => {
                                if (item.group === 'minRating') {
                                  setMinRating(option.id === 'null' ? null : Number(option.id));
                                } else {
                                  toggleFilterValue(item.group as MultiFilterKey, option.id);
                                }
                              }}
                              style={styles.filterOption}
                            >
                              <Text style={[
                                styles.filterOptionText,
                                isSelected && styles.filterOptionTextSelected
                              ]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              />

              <View style={styles.filterActions}>
                <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
                  <Text style={styles.clearButtonText}>Reset all</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.applyButton} 
                  onPress={() => runSearch()}
                >
                  <Text style={styles.applyButtonText}>Show results</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Map View Mode */}
      {viewMode === 'map' && MapView && (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={StyleSheet.absoluteFill}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            customMapStyle={LIGHT_MAP_STYLE}
            initialRegion={coords ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 } : defaultRegion}
          >
            {activities.filter(a => a.lat && a.lng).map(activity => (
              <Marker
                key={activity.id}
                coordinate={{ latitude: activity.lat!, longitude: activity.lng! }}
              >
                <View style={styles.customMarker}>
                  <View style={styles.markerInner} />
                </View>
              </Marker>
            ))}

            {/* MAP SHADOW: The ink path connecting existing stops in the journey. */}
            {itineraryStops.length > 1 && Polyline && (
              <>
                <Polyline
                  coordinates={itineraryStops.map(s => ({ latitude: s.lat, longitude: s.lng }))}
                  strokeColor="#FFF"
                  strokeWidth={4}
                />
                <Polyline
                  coordinates={itineraryStops.map(s => ({ latitude: s.lat, longitude: s.lng }))}
                  strokeColor="rgba(26, 26, 26, 0.4)"
                  strokeWidth={2}
                  lineDashPattern={[5, 5]}
                />
              </>
            )}
          </MapView>
          <TouchableOpacity style={styles.closeMap} onPress={() => setViewMode('list')}>
            <X size={24} color="#000" />
          </TouchableOpacity>
        </MotiView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { paddingBottom: 100 },
  header: { paddingTop: 84, paddingHorizontal: 24 },
  searchInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: 22,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 14,
  },
  searchInputShellCompact: {
    height: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    paddingVertical: 0,
  },
  searchInputCompact: {
    fontSize: 15,
  },
  searchSubmit: {
    minWidth: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 10,
  },
  searchSubmitText: {
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  
  trendingSection: { marginTop: 48 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A' },
  viewAll: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#999' },
  trendingList: { paddingRight: 32 },
  trendingItem: { marginRight: 20, alignItems: 'center' },
  trendingCircle: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: '#F0F0F0', marginBottom: 8 },
  trendingImage: { width: '100%', height: '100%' },
  trendingLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1A1A1A' },
  
  resultsLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#999', flex: 1 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 10, gap: 16 },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIconButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F2F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: theme.colors.textPrimary },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 32 },
  
  nearMeShortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 16 },
  nearMeShortcutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: theme.colors.primary },
  
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  avatarButton: { marginTop: 0, marginRight: 8 },
  
  searchCurator: { flex: 1, alignItems: 'center' },
  
  storySignature: { paddingVertical: 4 },
  storySignatureText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: 1 },
  
  filterHeadline: { fontFamily: 'Inter_900Black', fontSize: 32, color: '#1A1A1A', marginBottom: 40 },
  filterGroupSection: { marginBottom: 40 },
  filterGroupTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#999', letterSpacing: 2, marginBottom: 20 },
  filterVibesRail: { paddingRight: 8 },
  filterOptionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filterOption: { paddingRight: 20, paddingVertical: 8 },
  filterOptionText: { fontFamily: 'Inter_400Regular', fontSize: 24, color: '#BBB' },
  filterOptionTextSelected: { fontFamily: 'Inter_900Black', color: '#1A1A1A' },
  
  filterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  clearButton: { paddingVertical: 12 },
  clearButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#999' },
  applyButton: { backgroundColor: '#1A1A1A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  applyButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFF' },
  
  storyCardContainer: { paddingHorizontal: 32, marginTop: 24 },
  storyCardGridContainer: { paddingHorizontal: 0, width: (Dimensions.get('window').width - 64 - 16) / 2, marginTop: 16 },
  storyCard: { width: '100%', height: 480, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F0F0F0' },
  storyCardGrid: { height: 260, borderRadius: 16 },
  storyImage: { ...StyleSheet.absoluteFillObject },
  storyGradient: { ...StyleSheet.absoluteFillObject },
  storyContent: { flex: 1, justifyContent: 'flex-end', padding: 32 },
  storyContentGrid: { padding: 16 },
  storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  storyHeaderGrid: { alignItems: 'flex-start' },
  storyVibe: { fontFamily: 'Inter_700Bold', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', letterSpacing: 2, marginBottom: 4 },
  storyVibeGrid: { fontSize: 8, letterSpacing: 1 },
  storyTitle: { fontFamily: 'Inter_900Black', fontSize: 32, color: '#FFF', lineHeight: 36 },
  storyTitleGrid: { fontSize: 18, lineHeight: 22 },
  storyHeart: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
  storyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)' },
  storyFooterGrid: { marginTop: 12, paddingTop: 12 },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storyMetaText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFF' },
  storyMetaTextGrid: { fontSize: 11 },
  storyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  
  floatingControls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 20, 
    right: 20, 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center' 
  },
  mapToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderRadius: 30, 
    gap: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 20, 
    elevation: 10 
  },
  mapToggleDisabled: {
    opacity: 0.45,
  },
  mapToggleText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#000' },
  mapToggleTextDisabled: { color: '#555' },
  
  trayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 2000,
  },
  curateTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 50,
    zIndex: 2001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  trayTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  traySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 18,
  },
  duplicateInlineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201, 122, 0, 0.35)',
    backgroundColor: 'rgba(201, 122, 0, 0.08)',
    padding: 12,
    marginBottom: 14,
  },
  duplicateInlineText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#5C4200',
    lineHeight: 18,
  },
  duplicateInlineActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  duplicateInlineCancel: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  duplicateInlineCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#444',
  },
  duplicateInlineConfirm: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  duplicateInlineConfirmText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFF',
  },
  trayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  trayOption: {
    backgroundColor: '#F2F2F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  trayOptionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#1A1A1A',
  },
  trayCancel: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  trayCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#999',
    letterSpacing: 1,
  },
  
  searchSuggestions: { marginTop: 20 },
  overlayTrending: { marginBottom: 32 },
  overlayTrendingList: { paddingRight: 32 },
  overlayTrendingItem: { marginRight: 24, alignItems: 'center' },
  trendingCircleSmall: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#F0F0F0', marginBottom: 8 },
  trendingLabelSmall: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#1A1A1A', letterSpacing: 1 },
  suggestionTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#999', letterSpacing: 2, marginBottom: 20 },

  emptyState: { minHeight: height * 0.72, paddingTop: 92, paddingHorizontal: 28, paddingBottom: 100, alignItems: 'center', justifyContent: 'flex-start' },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 30, lineHeight: 34, color: '#1A1A1A', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#999', textAlign: 'center', lineHeight: 24 },
  searchHint: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  searchHintText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#3B3B3B',
  },
  emptySection: { width: '100%', maxWidth: 460, marginTop: 20 },
  emptySectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#999', letterSpacing: 1.5, marginBottom: 10 },
  vibesList: { paddingRight: 8 },
  trendingCircleSmallSelected: {
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  trendingLabelSmallSelected: {
    color: '#1A1A1A',
  },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.background, zIndex: 1000 },
  searchSafe: { flex: 1, paddingHorizontal: 32 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, marginBottom: 40 },
  searchInputArea: { marginBottom: 40 },
  searchLargeInput: { fontFamily: 'Inter_900Black', fontSize: 48, color: '#1A1A1A' },
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  suggestionText: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#1A1A1A' },
  
  customMarker: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  markerInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000', borderWidth: 2, borderColor: '#FFF' },
  closeMap: { position: 'absolute', top: 60, right: 32, width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
});

export default ExploreScreen;
