import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  FlatList,
  Modal,
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
} from '../types/explore';
import { exploreService } from '../services/explore';
import { discoveryService } from '../services/discovery';
import { isItineraryLimitError, itineraryService } from '../services/itinerary';
import { ItineraryDay, ItineraryHeader, ItineraryListItem } from '../types/itinerary';
import { Calendar } from 'react-native-calendars';

const { height, width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'near_me', label: 'Nearby', image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=400' },
  { id: 'outdoor', label: 'Outdoor', image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&q=80&w=400' },
  { id: 'culture', label: 'Culture', image: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&q=80&w=400' },
  { id: 'food', label: 'Food', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400' },
  { id: 'nightlife', label: 'Nightlife', image: 'https://picsum.photos/seed/nightlife-vibe/400/400' },
  { id: 'family', label: 'Family', image: 'https://picsum.photos/seed/family-vibe/400/400' },
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
type CitySuggestion = {
  placeId: string | null;
  label: string;
};
const FILTER_LIMITS: Record<MultiFilterKey, number> = {
  categories: MAX_MULTI_SELECT,
  priceTiers: MAX_MULTI_SELECT,
  durations: MAX_MULTI_SELECT,
  availability: 1,
  groupTypes: 2,
  accessibility: MAX_MULTI_SELECT,
};

const toTitle = (value: string) =>
  value
    .split('_')
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const normalizeIdentity = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('provider:') ? value.replace('provider:', '') : value;
};

const buildMarkedRange = (startDate: string, endDate: string): Record<string, any> => {
  if (!startDate) return {};
  if (!endDate || endDate < startDate) {
    return {
      [startDate]: { startingDay: true, endingDay: true, color: theme.colors.textPrimary, textColor: '#FFF' },
    };
  }

  const marks: Record<string, any> = {};
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const cursor = new Date(start);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    marks[iso] = { color: theme.colors.textPrimary, textColor: '#FFF' };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  marks[startDate] = { ...marks[startDate], startingDay: true };
  marks[endDate] = { ...marks[endDate], endingDay: true };
  return marks;
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

const FALLBACK_RAIL_IMAGE = require('../../assets/icon.png');

const ExploreScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const inlineSearchRef = useRef<TextInput>(null);
  const { showNotice } = useNotice();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [listLayout, setListLayout] = useState<'list' | 'grid'>('list');
  const [activities, setActivities] = useState<ExploreActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingVibeId, setPendingVibeId] = useState<string | null>(null);
  const [showVibeSearchHint, setShowVibeSearchHint] = useState(false);
  const [failedRailImages, setFailedRailImages] = useState<Record<string, true>>({});
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarApplying, setCalendarApplying] = useState(false);
  const [calendarStartDate, setCalendarStartDate] = useState('');
  const [calendarEndDate, setCalendarEndDate] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<{
    itineraryId: string;
    title: string;
    destinationCity: string;
  } | null>(null);
  const [itinerarySelectionPrompt, setItinerarySelectionPrompt] = useState<ItineraryListItem[] | null>(null);
  const [addActionMenuActivity, setAddActionMenuActivity] = useState<ExploreActivity | null>(null);
  const [addActionStep, setAddActionStep] = useState<'pick_itinerary' | 'pick_day'>('pick_day');
  const [addTargetItineraryId, setAddTargetItineraryId] = useState<string | null>(null);
  const [addTargetItineraryLabel, setAddTargetItineraryLabel] = useState<string | null>(null);
  // Curation State
  const [itineraryDays, setItineraryDays] = useState<number[]>([]);
  const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);
  const [addingToItinerary, setAddingToItinerary] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    itineraryId: string;
    dayIndex: number;
    duplicateDayIndex: number;
  } | null>(null);
  const latestSearchContextRef = useRef<{ destination: string | null; query: string }>({
    destination: null,
    query: '',
  });

  const closeInlineAddPanel = useCallback(() => {
    setDuplicatePrompt(null);
    setItinerarySelectionPrompt(null);
    setAddActionMenuActivity(null);
    setAddActionStep('pick_day');
    setAddTargetItineraryId(null);
    setAddTargetItineraryLabel(null);
  }, []);

  const loadItineraryContext = useCallback(async (selectedId?: string | null) => {
    try {
      const builder = await itineraryService.loadBuilderData(selectedId);
      setActiveItineraryId(builder.activeItineraryId);
      if (builder.bundle) {
        const days = builder.bundle.days.map((d: ItineraryDay) => d.dayIndex);
        setItineraryDays(days.length > 0 ? days : [1]);
      } else {
        setItineraryDays([1]);
      }
    } catch {
      console.warn('Failed to fetch itinerary context');
    }
  }, []);

  useEffect(() => {
    loadItineraryContext();
  }, [loadItineraryContext]);

  useEffect(() => {
    latestSearchContextRef.current = { destination, query };
  }, [destination, query]);

  useEffect(() => {
    const term = query.trim();
    if (nearMeActive || term.length < 3) {
      setCitySuggestions([]);
      setAutocompleteLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setAutocompleteLoading(true);
      const rawSuggestions = await discoveryService.autocomplete(term);
      if (cancelled) return;

      const seen = new Set<string>();
      const normalized: CitySuggestion[] = rawSuggestions
        .map((entry: any) => {
          const placeId = entry?.placePrediction?.placeId || entry?.placeId || null;
          const label =
            entry?.placePrediction?.text?.text ||
            entry?.text?.text ||
            entry?.description ||
            '';
          return {
            placeId: typeof placeId === 'string' ? placeId : null,
            label: typeof label === 'string' ? label.trim() : '',
          };
        })
        .filter(item => item.label.length > 0)
        .filter(item => {
          const key = `${item.placeId || 'none'}:${item.label.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 7);

      setCitySuggestions(normalized);
      setAutocompleteLoading(false);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [nearMeActive, query]);

  const resetToExploreLanding = useCallback(() => {
    setHasSearched(false);
    setActivities([]);
    setQuery('');
    setDestination(null);
    setCoords(null);
    setNearMeActive(false);
    setPendingVibeId(null);
    setShowVibeSearchHint(false);
    setCitySuggestions([]);
    setAutocompleteLoading(false);
    setCalendarOpen(false);
    setCalendarApplying(false);
    setCalendarStartDate('');
    setCalendarEndDate('');
    setCalendarTarget(null);
    setAddActionMenuActivity(null);
    setAddActionStep('pick_day');
    setAddTargetItineraryId(null);
    setAddTargetItineraryLabel(null);
    setDuplicatePrompt(null);
    setItinerarySelectionPrompt(null);
    setFilterOpen(false);
    setFilters(DEFAULT_FILTERS);
    setListLayout('list');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItineraryContext();

      const onBackPress = () => {
        if (duplicatePrompt) {
          setDuplicatePrompt(null);
          return true;
        }
        if (calendarOpen) {
          setCalendarOpen(false);
          return true;
        }
        if (addActionMenuActivity && addActionStep === 'pick_itinerary') {
          if (addTargetItineraryId) {
            setItinerarySelectionPrompt(null);
            setAddActionStep('pick_day');
          } else {
            closeInlineAddPanel();
          }
          return true;
        }
        if (itinerarySelectionPrompt) {
          setItinerarySelectionPrompt(null);
          setAddActionStep('pick_day');
          return true;
        }
        if (addActionMenuActivity) {
          closeInlineAddPanel();
          return true;
        }
        if (filterOpen) {
          setFilterOpen(false);
          return true;
        }
        if (citySuggestions.length > 0) {
          setCitySuggestions([]);
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
    }, [loadItineraryContext, duplicatePrompt, calendarOpen, itinerarySelectionPrompt, addActionMenuActivity, addActionStep, addTargetItineraryId, closeInlineAddPanel, filterOpen, citySuggestions.length, showVibeSearchHint, hasSearched, resetToExploreLanding])
  );

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
  const maxAssignableDay = useMemo(
    () => (assignableDays.length ? Math.max(...assignableDays) : 1),
    [assignableDays],
  );
  const activeInlineActivityIdentity = useMemo(
    () => (addActionMenuActivity ? getActivityIdentity(addActionMenuActivity) : null),
    [addActionMenuActivity],
  );
  const flatListPerfKey = useMemo(() => {
    const duplicateKey = duplicatePrompt
      ? `${duplicatePrompt.itineraryId}:${duplicatePrompt.dayIndex}:${duplicatePrompt.duplicateDayIndex}`
      : 'none';
    return [
      activeInlineActivityIdentity || 'none',
      addActionStep,
      addTargetItineraryId || 'none',
      duplicateKey,
      addingToItinerary ? 'busy' : 'idle',
      listLayout,
    ].join('|');
  }, [
    activeInlineActivityIdentity,
    addActionStep,
    addTargetItineraryId,
    duplicatePrompt,
    addingToItinerary,
    listLayout,
  ]);

  const vibeOptions = useMemo(() => CATEGORIES.filter(category => category.id !== 'near_me'), []);
  const hasLocationContext = useMemo(
    () => nearMeActive || Boolean(query.trim()) || Boolean(destination?.trim()),
    [destination, nearMeActive, query],
  );
  const shouldShowCitySuggestions = useMemo(
    () => !nearMeActive && query.trim().length >= 3 && (autocompleteLoading || citySuggestions.length > 0),
    [autocompleteLoading, citySuggestions.length, nearMeActive, query],
  );
  const calendarMarkedDates = useMemo(
    () => buildMarkedRange(calendarStartDate, calendarEndDate),
    [calendarEndDate, calendarStartDate],
  );

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
    setCalendarApplying(false);
    setCalendarStartDate('');
    setCalendarEndDate('');
    setCalendarTarget(null);
  }, []);

  const openCalendarForHeader = useCallback((header: Pick<ItineraryHeader, 'id' | 'title' | 'destinationCity' | 'startDate' | 'endDate'>) => {
    setCalendarTarget({
      itineraryId: header.id,
      title: header.title,
      destinationCity: header.destinationCity,
    });
    setCalendarStartDate(header.startDate || '');
    setCalendarEndDate(header.endDate || '');
    setCalendarOpen(true);
  }, []);

  const createAndActivateItineraryForCity = useCallback(
    async (selectedCity: string) => {
      const created = await itineraryService.createItinerary({
        title: `${selectedCity} Trip`,
        destinationCity: selectedCity,
        startDate: null,
        endDate: null,
      });
      await loadItineraryContext(created.id);
      openCalendarForHeader(created);
      return created;
    },
    [loadItineraryContext, openCalendarForHeader],
  );

  const markRailImageFailed = useCallback((key: string) => {
    setFailedRailImages(current => (current[key] ? current : { ...current, [key]: true }));
  }, []);

  const handleCalendarDayPress = useCallback(
    (dateString: string) => {
      if (!calendarStartDate || (calendarStartDate && calendarEndDate)) {
        setCalendarStartDate(dateString);
        setCalendarEndDate('');
        return;
      }

      if (dateString < calendarStartDate) {
        setCalendarStartDate(dateString);
        setCalendarEndDate('');
        return;
      }

      setCalendarEndDate(dateString);
    },
    [calendarEndDate, calendarStartDate],
  );

  const handleApplyCalendarDates = useCallback(async () => {
    if (!calendarTarget || !calendarStartDate) {
      closeCalendar();
      return;
    }
    setCalendarApplying(true);
    try {
      await itineraryService.updateItineraryDetails({
        itineraryId: calendarTarget.itineraryId,
        title: calendarTarget.title,
        destinationCity: calendarTarget.destinationCity,
        startDate: calendarStartDate,
        endDate: calendarEndDate || calendarStartDate,
      });
      await loadItineraryContext(calendarTarget.itineraryId);
      closeCalendar();
    } catch (error: any) {
      showNotice({
        title: 'DATES NOT SAVED',
        message: error?.message || 'Could not update itinerary dates right now.',
        type: 'error',
      });
      setCalendarApplying(false);
    }
  }, [calendarEndDate, calendarStartDate, calendarTarget, closeCalendar, loadItineraryContext, showNotice]);

  const showItineraryLimitWarning = useCallback(() => {
    showNotice({
      title: 'LIMIT REACHED',
      message: "Travis: 'You can keep up to 5 itineraries at a time. Delete one to create another.'",
      type: 'warning',
    });
    exploreService.trackEvent({
      eventName: 'itinerary_limit_warning_shown',
      metadata: {
        source: 'explore_add',
        max_itineraries: 5,
      },
    });
  }, [showNotice]);

  const selectTargetItinerary = useCallback(
    async (
      itineraryId: string,
      selectionMode: 'auto_created' | 'single' | 'remembered' | 'picker',
      targetLabel?: string | null,
    ) => {
      await itineraryService.setPreferredAddTargetItineraryId(itineraryId);
      setAddTargetItineraryId(itineraryId);
      setAddTargetItineraryLabel(targetLabel || null);
      setItinerarySelectionPrompt(null);
      setAddActionStep('pick_day');
      await loadItineraryContext(itineraryId);
      if (addActionMenuActivity) {
        exploreService.trackEvent({
          eventName: 'itinerary_target_selected',
          activityId: addActionMenuActivity.id,
          metadata: {
            source: 'explore',
            itinerary_id: itineraryId,
            selection_mode: selectionMode,
          },
        });
      }
    },
    [addActionMenuActivity, loadItineraryContext],
  );

  const resolveAddTargetForActivity = useCallback(
    async (
      activity: ExploreActivity,
      options: { forcePicker?: boolean; useLastItinerary?: boolean } = {},
    ): Promise<string | null> => {
      try {
        const { forcePicker = false, useLastItinerary = true } = options;
        const fallbackDestination =
          latestSearchContextRef.current.destination ||
          latestSearchContextRef.current.query ||
          activity.city ||
          'Open Road';
        const builder = await itineraryService.loadBuilderData();
        const selectableItineraries = builder.itineraries.filter(itinerary => itinerary.status !== 'archived');
        if (!selectableItineraries.length) {
          const ensured = await itineraryService.ensureActiveItinerary({
            destinationCity: fallbackDestination,
          });
          if (ensured.created) {
            exploreService.trackEvent({
              eventName: 'itinerary_created_auto',
              metadata: { source: 'explore_add' },
            });
          }
          await selectTargetItinerary(ensured.itineraryId, 'auto_created', fallbackDestination);
          return ensured.itineraryId;
        }

        if (selectableItineraries.length === 1) {
          const single = selectableItineraries[0];
          await selectTargetItinerary(single.id, 'single', single.destinationCity || single.title);
          return single.id;
        }

        if (!forcePicker && useLastItinerary) {
          const preferred = await itineraryService.getPreferredAddTargetItineraryId();
          if (preferred) {
            const match = selectableItineraries.find(itinerary => itinerary.id === preferred);
            if (match) {
              await selectTargetItinerary(match.id, 'remembered', match.destinationCity || match.title);
              return match.id;
            }
          }
        }

        setItinerarySelectionPrompt(selectableItineraries);
        setAddActionStep('pick_itinerary');
        return null;
      } catch (error: any) {
        if (isItineraryLimitError(error)) {
          showItineraryLimitWarning();
          return null;
        }
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not prepare itinerary selection right now.',
          type: 'error',
        });
        return null;
      }
    },
    [selectTargetItinerary, showItineraryLimitWarning, showNotice],
  );

  const beginAddToItinerary = useCallback(
    async (activity: ExploreActivity) => {
      const incomingKey = getActivityIdentity(activity);
      const activeKey = addActionMenuActivity ? getActivityIdentity(addActionMenuActivity) : null;
      if (activeKey === incomingKey) {
        closeInlineAddPanel();
        return;
      }
      setAddActionMenuActivity(activity);
      setAddActionStep('pick_day');
      setAddTargetItineraryId(null);
      setAddTargetItineraryLabel(null);
      setDuplicatePrompt(null);
      setItinerarySelectionPrompt(null);
      await resolveAddTargetForActivity(activity, { useLastItinerary: true });
    },
    [addActionMenuActivity, closeInlineAddPanel, resolveAddTargetForActivity],
  );

  const handleToggleItineraryPicker = useCallback(async () => {
    if (!addActionMenuActivity) return;
    if (addActionStep === 'pick_itinerary' && addTargetItineraryId) {
      setItinerarySelectionPrompt(null);
      setAddActionStep('pick_day');
      return;
    }

    setDuplicatePrompt(null);
    await resolveAddTargetForActivity(addActionMenuActivity, { forcePicker: true, useLastItinerary: false });
  }, [addActionMenuActivity, addActionStep, addTargetItineraryId, resolveAddTargetForActivity]);

  const handleCreateItineraryFromInlineAdd = useCallback(async () => {
    if (!addActionMenuActivity) return;
    setDuplicatePrompt(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const fallbackDestination =
        latestSearchContextRef.current.destination ||
        latestSearchContextRef.current.query ||
        addActionMenuActivity.city ||
        'Open Road';
      const created = await itineraryService.createItinerary({
        title: `Trip ${today}`,
        destinationCity: fallbackDestination,
        startDate: null,
        endDate: null,
      });
      exploreService.trackEvent({
        eventName: 'itinerary_created_auto',
        metadata: {
          source: 'explore_add',
          trigger: 'inline_add_create',
        },
      });
      await selectTargetItinerary(created.id, 'auto_created', created.destinationCity || created.title);
      const builder = await itineraryService.loadBuilderData(created.id);
      setItinerarySelectionPrompt(builder.itineraries);
    } catch (error: any) {
      if (isItineraryLimitError(error)) {
        showItineraryLimitWarning();
        return;
      }
      showNotice({
        title: 'ADD FAILED',
        message: error?.message || 'Could not create a new itinerary right now.',
        type: 'error',
      });
    }
  }, [addActionMenuActivity, selectTargetItinerary, showItineraryLimitWarning, showNotice]);

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
        setItinerarySelectionPrompt(null);
        setAddActionMenuActivity(null);
        setAddActionStep('pick_day');
        setAddTargetItineraryId(null);
        setAddTargetItineraryLabel(null);
      }
    },
    [showNotice],
  );

  const handleAddToDayPress = useCallback(
    async (dayIndex: number) => {
      if (!addActionMenuActivity || addingToItinerary) return;
      let targetItineraryId = addTargetItineraryId;
      if (!targetItineraryId) {
        targetItineraryId = await resolveAddTargetForActivity(addActionMenuActivity, { useLastItinerary: true });
      }
      if (!targetItineraryId) {
        showNotice({
          title: 'CHOOSE ITINERARY',
          message: "Travis: 'Pick an itinerary first, then choose your day.'",
          type: 'warning',
        });
        return;
      }
      try {
        const builder = await itineraryService.loadBuilderData(targetItineraryId);
        if (!builder.bundle) {
          await itineraryService.setPreferredAddTargetItineraryId(null);
          setAddTargetItineraryId(null);
          setAddTargetItineraryLabel(null);
          setDuplicatePrompt(null);
          setItinerarySelectionPrompt(null);
          setAddActionStep('pick_itinerary');
          showNotice({
            title: 'ITINERARY UNAVAILABLE',
            message: 'That itinerary is no longer available. Pick another itinerary.',
            type: 'warning',
          });
          return;
        }

        const normalizedTargetKeys = getActivityIdentityKeys(addActionMenuActivity);
        const duplicateDay = builder.bundle?.days.find(day =>
          day.items.some(item => normalizedTargetKeys.has(normalizeIdentity(item.activityId))),
        )?.dayIndex;

        if (duplicateDay) {
          setDuplicatePrompt({
            itineraryId: targetItineraryId,
            dayIndex,
            duplicateDayIndex: duplicateDay,
          });
          exploreService.trackEvent({
            eventName: 'itinerary_duplicate_warning_shown',
            activityId: addActionMenuActivity.id,
            metadata: {
              itinerary_id: targetItineraryId,
              selected_day_index: dayIndex,
              duplicate_day_index: duplicateDay,
              source: 'explore',
            },
          });
          return;
        }

        await completeAddToDay(addActionMenuActivity, dayIndex, targetItineraryId, false);
      } catch (error: any) {
        setDuplicatePrompt(null);
        setAddActionMenuActivity(null);
        setAddActionStep('pick_day');
        setAddTargetItineraryId(null);
        setAddTargetItineraryLabel(null);
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not prepare this add right now.',
          type: 'error',
        });
      }
    },
    [addActionMenuActivity, addTargetItineraryId, addingToItinerary, completeAddToDay, resolveAddTargetForActivity, showNotice],
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

  const handleCitySelection = useCallback(
    async ({
      cityLabel,
      placeId,
      source,
    }: {
      cityLabel: string;
      placeId?: string | null;
      source: 'manual' | 'suggestion' | 'popular_city';
    }) => {
      const trimmedCity = cityLabel.trim();
      if (!trimmedCity) return;
      try {
        setQuery(trimmedCity);
        setCitySuggestions([]);
        setNearMeActive(false);
        setPendingVibeId(null);
        setShowVibeSearchHint(false);

        const geocoded = await discoveryService.geocode(trimmedCity, placeId || undefined);
        if (geocoded) setCoords(geocoded);

        const builder = await itineraryService.loadBuilderData();
        const existingBundle = builder.bundle;

        if (!existingBundle || !builder.activeItineraryId) {
          await createAndActivateItineraryForCity(trimmedCity);
        } else {
          await loadItineraryContext(builder.activeItineraryId);
        }

        const nextFilters = pendingVibeId
          ? { ...filters, categories: [pendingVibeId] }
          : undefined;
        if (nextFilters) {
          setFilters(nextFilters);
        }

        exploreService.trackEvent({
          eventName: 'explore_city_selected',
          metadata: {
            source,
            city: trimmedCity,
            place_id: placeId || null,
          },
        });

        await runSearch({ queryOverride: trimmedCity, nearMeOverride: false, filtersOverride: nextFilters });
      } catch (error: any) {
        showNotice({
          title: 'SEARCH FAILED',
          message: error?.message || 'Could not initialize this city right now.',
          type: 'error',
        });
      }
    },
    [createAndActivateItineraryForCity, filters, loadItineraryContext, pendingVibeId, runSearch, showNotice],
  );

  const handleSearchPress = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    await handleCitySelection({ cityLabel: trimmed, source: 'manual' });
  }, [handleCitySelection, query]);

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

  const renderActivityCard = useCallback(({ item }: { item: ExploreActivity; index: number }) => {
    const identity = getActivityIdentity(item);
    const isGrid = listLayout === 'grid';
    const isInlineAddOpen = activeInlineActivityIdentity === identity;
    const itineraryChips = itinerarySelectionPrompt || [];
    const inlinePanelOverlayStyle = isGrid ? styles.inlineAddPanelOverlayGrid : styles.inlineAddPanelOverlayList;

    return (
      <View style={[styles.storyCardContainer, isGrid && styles.storyCardGridContainer]}>
        <TouchableOpacity
          style={[styles.storyCard, isGrid && styles.storyCardGrid]}
          onPress={() => navigation.navigate('LocationDetails', { locationId: item.canonicalKey || item.id })}
          activeOpacity={0.95}
        >
          <View style={StyleSheet.absoluteFill}>
            <Image 
              source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800' }} 
              style={styles.storyImage} 
            />
          </View>
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
                  onPress={() => {
                    void beginAddToItinerary(item);
                  }}
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
                  onPress={() => {
                    void beginAddToItinerary(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.title} to itinerary`}
                >
                  <Plus size={18} color="#FFF" strokeWidth={2.2} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isInlineAddOpen && (
          <>
            <TouchableOpacity
              style={styles.inlineBackdrop}
              activeOpacity={1}
              onPress={closeInlineAddPanel}
              accessibilityRole="button"
              accessibilityLabel="Close add panel"
            />
            <View style={[styles.inlineAddPanel, inlinePanelOverlayStyle, isGrid && styles.inlineAddPanelGrid]}>
              <View style={styles.inlineAddHeader}>
                <TouchableOpacity
                  style={styles.inlineItinerarySummary}
                  onPress={() => {
                    void handleToggleItineraryPicker();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change itinerary"
                >
                  <Text style={styles.inlineItineraryCaption}>ITINERARY</Text>
                  <Text style={styles.inlineItineraryValue} numberOfLines={1}>
                    {addTargetItineraryLabel ? `Itinerary: ${addTargetItineraryLabel}` : 'Itinerary: Choose one'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inlineCreateItineraryButton}
                  onPress={() => {
                    void handleCreateItineraryFromInlineAdd();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Create new itinerary"
                >
                  <Plus size={16} color="#4A4A4A" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {addActionStep === 'pick_itinerary' && (
                <View style={styles.inlineChipRow}>
                  {itineraryChips.length > 0 ? (
                    itineraryChips.map(itinerary => (
                      <TouchableOpacity
                        key={itinerary.id}
                        style={[styles.inlineChip, addTargetItineraryId === itinerary.id && styles.inlineChipSelected]}
                        onPress={() => {
                          void selectTargetItinerary(
                            itinerary.id,
                            'picker',
                            itinerary.destinationCity || itinerary.title,
                          );
                        }}
                        disabled={addingToItinerary}
                      >
                        <Text
                          style={[
                            styles.inlineChipText,
                            addTargetItineraryId === itinerary.id && styles.inlineChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {(itinerary.destinationCity || itinerary.title).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.inlineHelperText}>No itineraries yet. Tap the gray + to create one.</Text>
                  )}
                </View>
              )}

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
                        if (!duplicatePrompt) return;
                        void completeAddToDay(
                          item,
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

              {addActionStep === 'pick_day' && (
                <View style={styles.inlineChipRow}>
                  {assignableDays.map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.inlineChip, !addTargetItineraryId && styles.inlineChipDisabled]}
                      onPress={() => {
                        void handleAddToDayPress(day);
                      }}
                      disabled={addingToItinerary || !addTargetItineraryId}
                    >
                      <Text style={styles.inlineChipText}>
                        {day === maxAssignableDay ? `NEW DAY ${day}` : `DAY ${day}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.inlineCloseButton}
                onPress={closeInlineAddPanel}
                disabled={addingToItinerary}
              >
                <Text style={styles.inlineCloseButtonText}>{addingToItinerary ? 'Adding...' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }, [
    listLayout,
    activeInlineActivityIdentity,
    itinerarySelectionPrompt,
    beginAddToItinerary,
    navigation,
    addTargetItineraryLabel,
    handleToggleItineraryPicker,
    handleCreateItineraryFromInlineAdd,
    addActionStep,
    addTargetItineraryId,
    addingToItinerary,
    selectTargetItinerary,
    duplicatePrompt,
    completeAddToDay,
    assignableDays,
    maxAssignableDay,
    handleAddToDayPress,
    closeInlineAddPanel,
  ]);

  const activeVibeLabel = useMemo(
    () => vibeOptions.find(vibe => vibe.id === pendingVibeId)?.label ?? null,
    [pendingVibeId, vibeOptions],
  );

  const renderSearchInput = (compact = false) => (
    <View style={styles.searchInputWrap}>
      <View style={[styles.searchInputShell, compact && styles.searchInputShellCompact]}>
        <SearchIcon size={compact ? 16 : 20} color={theme.colors.textSecondary} />
        <TextInput
          ref={inlineSearchRef}
          style={[styles.searchInput, compact && styles.searchInputCompact]}
          placeholder="Where to..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={value => {
            setQuery(value);
            if (nearMeActive) setNearMeActive(false);
          }}
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

      {shouldShowCitySuggestions && (
        <View style={[styles.citySuggestionsCard, compact && styles.citySuggestionsCardCompact]}>
          {autocompleteLoading && citySuggestions.length === 0 ? (
            <View style={styles.citySuggestionRow}>
              <Text style={styles.citySuggestionText}>Searching cities...</Text>
            </View>
          ) : (
            citySuggestions.map(item => (
              <TouchableOpacity
                key={`${item.placeId || 'none'}-${item.label}`}
                style={styles.citySuggestionRow}
                onPress={() => {
                  void handleCitySelection({
                    cityLabel: item.label,
                    placeId: item.placeId,
                    source: 'suggestion',
                  });
                }}
              >
                <Text style={styles.citySuggestionText} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
  const extractActivityKey = useCallback((item: ExploreActivity) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        key={listLayout}
        data={activities}
        keyExtractor={extractActivityKey}
        renderItem={renderActivityCard}
        extraData={flatListPerfKey}
        numColumns={listLayout === 'grid' ? 2 : 1}
        columnWrapperStyle={listLayout === 'grid' ? styles.gridRow : undefined}
        initialNumToRender={listLayout === 'grid' ? 8 : 5}
        maxToRenderPerBatch={listLayout === 'grid' ? 10 : 6}
        updateCellsBatchingPeriod={50}
        windowSize={listLayout === 'grid' ? 9 : 7}
        removeClippedSubviews
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
                          <Image
                            source={failedRailImages[`vibe:${item.id}`] ? FALLBACK_RAIL_IMAGE : { uri: item.image }}
                            style={styles.trendingImage}
                            onError={() => markRailImageFailed(`vibe:${item.id}`)}
                          />
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
                        void handleCitySelection({ cityLabel: item.label, source: 'popular_city' });
                      }}
                    >
                      <View style={styles.trendingCircleSmall}>
                        <Image
                          source={failedRailImages[`city:${item.id}`] ? FALLBACK_RAIL_IMAGE : { uri: item.image }}
                          style={styles.trendingImage}
                          onError={() => markRailImageFailed(`city:${item.id}`)}
                        />
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

      {/* Full-Screen Filter Overlay */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.searchOverlay}>
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
                                <Image
                                  source={
                                    failedRailImages[`vibe:${option.id}`] || !(option as { image?: string }).image
                                      ? FALLBACK_RAIL_IMAGE
                                      : { uri: (option as { image?: string }).image as string }
                                  }
                                  style={styles.trendingImage}
                                  onError={() => markRailImageFailed(`vibe:${option.id}`)}
                                />
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
        </View>
      </Modal>

      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={closeCalendar}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarCard}>
            <Text style={styles.calendarTitle}>Set trip dates (optional)</Text>
            <Text style={styles.calendarSubtitle}>
              {calendarTarget?.destinationCity || 'Your itinerary'}
            </Text>
            <Text style={styles.calendarHint}>Pick a start and end date, or set them later.</Text>
            <Calendar
              markingType="period"
              markedDates={calendarMarkedDates}
              theme={{
                calendarBackground: '#FFFFFF',
                dayTextColor: '#1A1A1A',
                monthTextColor: '#1A1A1A',
                textDayFontFamily: 'Inter_500Medium',
                textMonthFontFamily: 'Inter_700Bold',
                textDayHeaderFontFamily: 'Inter_600SemiBold',
              }}
              onDayPress={day => handleCalendarDayPress(day.dateString)}
            />
            <View style={styles.calendarActions}>
              <TouchableOpacity style={styles.calendarSecondary} onPress={closeCalendar} disabled={calendarApplying}>
                <Text style={styles.calendarSecondaryText}>Set Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarPrimary, (!calendarStartDate || calendarApplying) && styles.calendarPrimaryDisabled]}
                onPress={() => {
                  void handleApplyCalendarDates();
                }}
                disabled={!calendarStartDate || calendarApplying}
              >
                <Text style={styles.calendarPrimaryText}>{calendarApplying ? 'Saving...' : 'Apply Dates'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  searchInputWrap: {
    width: '100%',
  },
  citySuggestionsCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  citySuggestionsCardCompact: {
    marginTop: 6,
  },
  citySuggestionRow: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F2',
  },
  citySuggestionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1A1A1A',
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
  
  storyCardContainer: { paddingHorizontal: 32, marginTop: 24, position: 'relative' },
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

  inlineAddPanel: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 12,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 14,
  },
  inlineBackdrop: {
    position: 'absolute',
    zIndex: 20,
    top: -height,
    bottom: -height,
    left: -width,
    right: -width,
    backgroundColor: 'rgba(9, 12, 18, 0.34)',
  },
  inlineAddPanelOverlayList: {
    left: 42,
    right: 42,
    bottom: 56,
  },
  inlineAddPanelOverlayGrid: {
    left: 8,
    right: 8,
    bottom: 24,
  },
  inlineAddPanelGrid: {
    borderRadius: 12,
    padding: 10,
  },
  inlineAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  inlineItinerarySummary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFB',
  },
  inlineItineraryCaption: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#787878',
    letterSpacing: 1.1,
  },
  inlineItineraryValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#1A1A1A',
    marginTop: 2,
  },
  inlineCreateItineraryButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3E4E8',
  },
  inlineChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  inlineChip: {
    backgroundColor: '#F2F2F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  inlineChipSelected: {
    backgroundColor: '#1A1A1A',
  },
  inlineChipDisabled: {
    opacity: 0.45,
  },
  inlineChipText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#1A1A1A',
  },
  inlineChipTextSelected: {
    color: '#FFF',
  },
  inlineHelperText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#5A5A5A',
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
  inlineCloseButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  inlineCloseButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#666',
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
  calendarBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
  },
  calendarCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 14,
  },
  calendarTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  calendarSubtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  calendarHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    marginBottom: 8,
  },
  calendarActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  calendarSecondary: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  calendarSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#444',
  },
  calendarPrimary: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  calendarPrimaryDisabled: {
    opacity: 0.45,
  },
  calendarPrimaryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
});

export default ExploreScreen;
