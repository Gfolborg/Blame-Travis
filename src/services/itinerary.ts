import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { supabase } from './supabase';
import { activitiesService } from './activities';
import { Tables } from '../types/database';
import {
  AddActivityToDayInput,
  AddSavedToDayInput,
  CreateItineraryInput,
  DayConflictSummary,
  DistanceUnit,
  EnsureActiveItineraryInput,
  HopDistanceWarning,
  ItineraryActivityItem,
  ItineraryBundle,
  ItineraryDay,
  ItineraryHeader,
  ItineraryListItem,
  ItinerarySummary,
  ItineraryWarnings,
  JourneysLoadResult,
  MoveItemToDayInput,
  RemoveItineraryItemInput,
  ReorderDayInput,
  UpdateItineraryDetailsInput,
} from '../types/itinerary';

type ItineraryRow = Tables<'itineraries'>;
type ItineraryItemRow = Tables<'itinerary_items'>;
type ActivityRow = Tables<'activities'>;
type ItineraryItemJoined = ItineraryItemRow & { activities: ActivityRow | null };

type SnapshotEnvelope = {
  version: number;
  savedAt: string;
  userId: string;
  bundle: ItineraryBundle;
};

type GuestPlannerEnvelope = {
  version: number;
  savedAt: string;
  activeItineraryId: string | null;
  bundles: ItineraryBundle[];
};

const SNAPSHOT_VERSION = 1;
const GUEST_PLANNER_VERSION = 1;
const GUEST_USER_ID = 'guest-local';
const DAY_CAPACITY_THRESHOLD = 6;
const MEDIUM_DISTANCE_THRESHOLD = 15;
const HIGH_DISTANCE_THRESHOLD = 30;
const MAX_ACTIVE_ITINERARIES = 5;

export const ITINERARY_LIMIT_ERROR_CODE = 'ITINERARY_LIMIT_REACHED' as const;
export type ItineraryLimitError = Error & {
  code: typeof ITINERARY_LIMIT_ERROR_CODE;
  count: number;
  max: number;
};

export const reorderWithIndices = <T>(values: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex < 0 || fromIndex >= values.length) return values;
  if (toIndex < 0 || toIndex >= values.length) return values;
  if (fromIndex === toIndex) return values;

  const cloned = [...values];
  const [moved] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, moved);
  return cloned;
};

export const inferDistanceUnit = (): DistanceUnit => {
  const locale = getLocales()?.[0];
  const measurementSystem = locale?.measurementSystem?.toLowerCase() || '';
  if (measurementSystem === 'us' || measurementSystem === 'uk' || measurementSystem === 'imperial') {
    return 'mi';
  }
  return 'km';
};

export const haversineDistanceKm = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(to.lat - from.lat);
  const lngDiff = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const toDistanceUnitValue = (km: number, unit: DistanceUnit): number =>
  unit === 'mi' ? km * 0.621371 : km;

export const computeDayConflicts = (days: ItineraryDay[]): DayConflictSummary[] =>
  days.map(day => {
    const seen = new Set<string>();
    let hasDuplicateActivityConflict = false;
    day.items.forEach(item => {
      if (seen.has(item.activityId)) {
        hasDuplicateActivityConflict = true;
      } else {
        seen.add(item.activityId);
      }
    });

    return {
      dayIndex: day.dayIndex,
      hasDuplicateActivityConflict,
      hasCapacityConflict: day.items.length >= DAY_CAPACITY_THRESHOLD,
    };
  });

export const computeHopWarnings = (days: ItineraryDay[], unit: DistanceUnit): HopDistanceWarning[] => {
  const warnings: HopDistanceWarning[] = [];

  days.forEach(day => {
    const ordered = [...day.items].sort((a, b) => a.positionIndex - b.positionIndex);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const from = ordered[i];
      const to = ordered[i + 1];
      if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
        continue;
      }

      const distanceKm = haversineDistanceKm({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
      const value = toDistanceUnitValue(distanceKm, unit);
      const rounded = Math.round(value * 10) / 10;

      let severity: 'none' | 'medium' | 'high' = 'none';
      if (rounded >= HIGH_DISTANCE_THRESHOLD) {
        severity = 'high';
      } else if (rounded >= MEDIUM_DISTANCE_THRESHOLD) {
        severity = 'medium';
      }

      if (severity !== 'none') {
        warnings.push({
          dayIndex: day.dayIndex,
          fromItemId: from.id,
          toItemId: to.id,
          distanceValue: rounded,
          distanceUnit: unit,
          severity,
        });
      }
    }
  });

  return warnings;
};

export const buildItinerarySummary = (
  days: ItineraryDay[],
  dayConflicts: DayConflictSummary[],
  hopWarnings: HopDistanceWarning[]
): ItinerarySummary => {
  const plannedDayCount = Math.max(days.length, 1);
  const totalItemCount = days.reduce((sum, day) => sum + day.items.length, 0);
  const averageItemsPerDay = Number((totalItemCount / plannedDayCount).toFixed(2));
  const daysWithCapacityConflict = dayConflicts.filter(day => day.hasCapacityConflict).length;
  const highDistanceHopCount = hopWarnings.filter(hop => hop.severity === 'high').length;

  return {
    plannedDayCount,
    totalItemCount,
    averageItemsPerDay,
    daysWithCapacityConflict,
    highDistanceHopCount,
  };
};

const getSnapshotKey = (userId: string) => `blame_travis:itinerary_snapshot:${userId}`;
const GUEST_PLANNER_KEY = 'blame_travis:guest_itinerary_planner:v1';
const getPreferredAddTargetKey = (userId: string) => `blame_travis:preferred_add_target:${userId}`;

const createItineraryLimitError = (count: number): ItineraryLimitError => {
  const error = new Error(`You can keep up to ${MAX_ACTIVE_ITINERARIES} itineraries at a time.`) as ItineraryLimitError;
  error.code = ITINERARY_LIMIT_ERROR_CODE;
  error.count = count;
  error.max = MAX_ACTIVE_ITINERARIES;
  return error;
};

export const isItineraryLimitError = (error: unknown): error is ItineraryLimitError =>
  Boolean(error) &&
  typeof error === 'object' &&
  (error as Partial<ItineraryLimitError>).code === ITINERARY_LIMIT_ERROR_CODE;

const getAuthedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user.id || null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeProviderId = (value: string) =>
  value.startsWith('provider:') ? value.replace('provider:', '') : value;

const resolvePersistableActivityId = async (activityId: string): Promise<string | null> => {
  if (!activityId) return null;
  if (isUuid(activityId)) return activityId;

  const canonicalKey = normalizeProviderId(activityId);
  const { data } = await supabase.from('activities').select('id').eq('canonical_key', canonicalKey).single();
  return data?.id || null;
};

const mapItineraryHeader = (row: ItineraryRow): ItineraryHeader => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  destinationCity: row.destination_city,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status,
  updatedAt: row.updated_at,
  createdAt: row.created_at,
  legacyAdventureId: row.legacy_adventure_id,
});

const toListItem = (header: ItineraryHeader): ItineraryListItem => ({
  id: header.id,
  title: header.title,
  destinationCity: header.destinationCity,
  status: header.status,
  updatedAt: header.updatedAt,
  startDate: header.startDate,
  endDate: header.endDate,
  legacyAdventureId: header.legacyAdventureId,
});

const mapJoinedItem = (row: ItineraryItemJoined): ItineraryActivityItem | null => {
  if (!row.activities) return null;
  return {
    id: row.id,
    itineraryId: row.itinerary_id,
    activityId: row.activity_id,
    dayIndex: row.day_index > 0 ? row.day_index : 1,
    positionIndex: row.position_index,
    scheduledAt: row.scheduled_at,
    narrativeWhy: row.narrative_why,
    title: row.activities.title,
    imageUrl: row.activities.image_url,
    category: row.activities.categories?.[0] || null,
    city: row.activities.location_city,
    lat: row.activities.location_lat,
    lng: row.activities.location_lng,
    durationMinutesMin: row.activities.duration_minutes_min,
    durationMinutesMax: row.activities.duration_minutes_max,
  };
};

const buildDays = (items: ItineraryActivityItem[]): ItineraryDay[] => {
  const dayMap = new Map<number, ItineraryActivityItem[]>();
  items.forEach(item => {
    const current = dayMap.get(item.dayIndex) || [];
    current.push(item);
    dayMap.set(item.dayIndex, current);
  });

  return [...dayMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayIndex, dayItems]) => ({
      dayIndex,
      items: [...dayItems].sort((a, b) => a.positionIndex - b.positionIndex),
    }));
};

export const compactDaysAfterRemoval = (days: ItineraryDay[], removedDayIndex: number): ItineraryDay[] =>
  days
    .map(day => {
      if (day.dayIndex === removedDayIndex) {
        return null;
      }
      if (day.dayIndex < removedDayIndex) {
        return {
          ...day,
          items: day.items.map(item => ({ ...item })),
        };
      }

      return {
        dayIndex: day.dayIndex - 1,
        items: day.items.map(item => ({
          ...item,
          dayIndex: Math.max(1, item.dayIndex - 1),
        })),
      };
    })
    .filter((day): day is ItineraryDay => Boolean(day))
    .sort((a, b) => a.dayIndex - b.dayIndex);

const computeWarnings = (days: ItineraryDay[]): ItineraryWarnings => {
  const distanceUnit = inferDistanceUnit();
  const dayConflicts = computeDayConflicts(days);
  const hopWarnings = computeHopWarnings(days, distanceUnit);
  return { dayConflicts, hopWarnings };
};

const readSnapshot = async (userId: string): Promise<SnapshotEnvelope | null> => {
  try {
    const raw = await AsyncStorage.getItem(getSnapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    if (parsed.version !== SNAPSHOT_VERSION || parsed.userId !== userId || !parsed.bundle) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeSnapshot = async (userId: string, bundle: ItineraryBundle): Promise<void> => {
  const envelope: SnapshotEnvelope = {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    userId,
    bundle,
  };
  await AsyncStorage.setItem(getSnapshotKey(userId), JSON.stringify(envelope));
};

const readGuestPlanner = async (): Promise<GuestPlannerEnvelope> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_PLANNER_KEY);
    if (!raw) {
      return {
        version: GUEST_PLANNER_VERSION,
        savedAt: new Date().toISOString(),
        activeItineraryId: null,
        bundles: [],
      };
    }

    const parsed = JSON.parse(raw) as GuestPlannerEnvelope;
    if (parsed.version !== GUEST_PLANNER_VERSION || !Array.isArray(parsed.bundles)) {
      return {
        version: GUEST_PLANNER_VERSION,
        savedAt: new Date().toISOString(),
        activeItineraryId: null,
        bundles: [],
      };
    }

    return parsed;
  } catch {
    return {
      version: GUEST_PLANNER_VERSION,
      savedAt: new Date().toISOString(),
      activeItineraryId: null,
      bundles: [],
    };
  }
};

const countGuestSelectableItineraries = (store: GuestPlannerEnvelope): number =>
  store.bundles.filter(bundle => bundle.header.status !== 'archived').length;

const enforceGuestItineraryLimit = (store: GuestPlannerEnvelope): void => {
  const count = countGuestSelectableItineraries(store);
  if (count >= MAX_ACTIVE_ITINERARIES) {
    throw createItineraryLimitError(count);
  }
};

const preferredTargetStorageKeyForUser = (userId: string | null): string =>
  getPreferredAddTargetKey(userId || GUEST_USER_ID);

const clearPreferredTargetIfMatches = async (userId: string | null, itineraryId: string): Promise<void> => {
  const key = preferredTargetStorageKeyForUser(userId);
  const current = await AsyncStorage.getItem(key);
  if (current === itineraryId) {
    await AsyncStorage.removeItem(key);
  }
};

const writeGuestPlanner = async (envelope: GuestPlannerEnvelope): Promise<void> => {
  await AsyncStorage.setItem(
    GUEST_PLANNER_KEY,
    JSON.stringify({
      ...envelope,
      version: GUEST_PLANNER_VERSION,
      savedAt: new Date().toISOString(),
    }),
  );
};

const recomputeBundle = (bundle: ItineraryBundle, updatedAt?: string): ItineraryBundle => {
  const days = bundle.days
    .map(day => ({
      dayIndex: day.dayIndex,
      items: [...day.items]
        .sort((a, b) => a.positionIndex - b.positionIndex)
        .map((item, index) => ({ ...item, positionIndex: index })),
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);

  const warnings = computeWarnings(days);
  const summary = buildItinerarySummary(days, warnings.dayConflicts, warnings.hopWarnings);

  return {
    ...bundle,
    header: {
      ...bundle.header,
      updatedAt: updatedAt || new Date().toISOString(),
    },
    days,
    warnings,
    summary,
  };
};

const createEmptyBundle = (header: ItineraryHeader): ItineraryBundle =>
  recomputeBundle({
    header,
    days: [],
    warnings: { dayConflicts: [], hopWarnings: [] },
    summary: {
      plannedDayCount: 1,
      totalItemCount: 0,
      averageItemsPerDay: 0,
      daysWithCapacityConflict: 0,
      highDistanceHopCount: 0,
    },
  });

const withGuestBundleMutation = async (
  itineraryId: string,
  mutator: (_bundle: ItineraryBundle) => Promise<ItineraryBundle> | ItineraryBundle,
): Promise<ItineraryBundle> => {
  const store = await readGuestPlanner();
  const index = store.bundles.findIndex(bundle => bundle.header.id === itineraryId);
  if (index < 0) {
    throw new Error('Unable to locate itinerary.');
  }

  const next = await mutator(store.bundles[index]);
  const normalized = recomputeBundle(next);
  const nextStore: GuestPlannerEnvelope = {
    ...store,
    activeItineraryId: itineraryId,
    bundles: store.bundles.map((bundle, i) => (i === index ? normalized : bundle)),
  };
  await writeGuestPlanner(nextStore);
  return normalized;
};

const fetchItineraryBundle = async (itineraryId: string): Promise<ItineraryBundle> => {
  const { data: itineraryData, error: itineraryError } = await supabase
    .from('itineraries')
    .select('*')
    .eq('id', itineraryId)
    .single();
  if (itineraryError || !itineraryData) {
    throw new Error(itineraryError?.message || 'Failed to load itinerary.');
  }

  const { data: itemData, error: itemError } = await supabase
    .from('itinerary_items')
    .select('id,itinerary_id,activity_id,day_index,position_index,narrative_why,scheduled_at,updated_at,created_at,activities(*)')
    .eq('itinerary_id', itineraryId)
    .order('day_index', { ascending: true })
    .order('position_index', { ascending: true });
  if (itemError) {
    throw new Error(itemError.message || 'Failed to load itinerary items.');
  }

  const mappedItems = ((itemData || []) as ItineraryItemJoined[])
    .map(mapJoinedItem)
    .filter((item): item is ItineraryActivityItem => Boolean(item));

  const days = buildDays(mappedItems);
  const warnings = computeWarnings(days);
  const summary = buildItinerarySummary(days, warnings.dayConflicts, warnings.hopWarnings);

  return {
    header: mapItineraryHeader(itineraryData),
    days,
    warnings,
    summary,
  };
};

const touchItinerary = async (itineraryId: string): Promise<void> => {
  await supabase
    .from('itineraries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itineraryId);
};

const listSelectableItinerariesForUser = async (userId: string): Promise<ItineraryListItem[]> => {
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load itineraries.');
  }

  return (data || []).map(row => toListItem(mapItineraryHeader(row)));
};

const applyDayOrder = async (itineraryId: string, dayIndex: number, orderedIds: string[]): Promise<void> => {
  if (!orderedIds.length) return;

  // Phase 1: temporary high index range to avoid unique collisions during reshuffle.
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('itinerary_items')
        .update({ day_index: dayIndex, position_index: 1000 + index })
        .eq('id', id)
        .eq('itinerary_id', itineraryId)
    )
  );

  // Phase 2: final contiguous indices.
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('itinerary_items')
        .update({ day_index: dayIndex, position_index: index })
        .eq('id', id)
        .eq('itinerary_id', itineraryId)
    )
  );
};

const reindexDay = async (itineraryId: string, dayIndex: number): Promise<void> => {
  const { data, error } = await supabase
    .from('itinerary_items')
    .select('id,position_index')
    .eq('itinerary_id', itineraryId)
    .eq('day_index', dayIndex)
    .order('position_index', { ascending: true });
  if (error) {
    throw new Error(error.message || 'Failed to load day for reindex.');
  }

  const orderedIds = (data || []).map(row => row.id);
  await applyDayOrder(itineraryId, dayIndex, orderedIds);
};

const refreshBundleAndSnapshot = async (userId: string, itineraryId: string): Promise<ItineraryBundle> => {
  const bundle = await fetchItineraryBundle(itineraryId);
  await writeSnapshot(userId, bundle);
  return bundle;
};

export const itineraryService = {
  async loadBuilderData(selectedItineraryId?: string | null): Promise<JourneysLoadResult> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const guestStore = await readGuestPlanner();
      const selectableBundles = guestStore.bundles.filter(bundle => bundle.header.status !== 'archived');
      const itineraries = selectableBundles
        .map(bundle => toListItem(bundle.header))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      if (!itineraries.length) {
        return {
          itineraries: [],
          activeItineraryId: null,
          bundle: null,
          offline: false,
          offlineSavedAt: guestStore.savedAt,
        };
      }

      const activeId =
        selectedItineraryId && itineraries.some(itinerary => itinerary.id === selectedItineraryId)
          ? selectedItineraryId
          : guestStore.activeItineraryId && itineraries.some(itinerary => itinerary.id === guestStore.activeItineraryId)
            ? guestStore.activeItineraryId
            : itineraries[0].id;

      const bundle = selectableBundles.find(item => item.header.id === activeId) || null;

      return {
        itineraries,
        activeItineraryId: activeId,
        bundle,
        offline: false,
        offlineSavedAt: guestStore.savedAt,
      };
    }

    try {
      const itineraries = await listSelectableItinerariesForUser(userId);
      if (!itineraries.length) {
        return {
          itineraries,
          activeItineraryId: null,
          bundle: null,
          offline: false,
          offlineSavedAt: null,
        };
      }

      const activeId =
        selectedItineraryId && itineraries.some(itinerary => itinerary.id === selectedItineraryId)
          ? selectedItineraryId
          : itineraries[0].id;

      const bundle = await fetchItineraryBundle(activeId);
      await writeSnapshot(userId, bundle);

      return {
        itineraries,
        activeItineraryId: activeId,
        bundle,
        offline: false,
        offlineSavedAt: null,
      };
    } catch (error) {
      const snapshot = await readSnapshot(userId);
      if (snapshot) {
        return {
          itineraries: [toListItem(snapshot.bundle.header)],
          activeItineraryId: snapshot.bundle.header.id,
          bundle: snapshot.bundle,
          offline: true,
          offlineSavedAt: snapshot.savedAt,
        };
      }
      throw error;
    }
  },

  async createItinerary(input: CreateItineraryInput): Promise<ItineraryHeader> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const store = await readGuestPlanner();
      enforceGuestItineraryLimit(store);

      const now = new Date().toISOString();
      const id = `guest-itinerary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const header: ItineraryHeader = {
        id,
        userId: GUEST_USER_ID,
        title: input.title.trim(),
        destinationCity: input.destinationCity.trim(),
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        status: 'draft',
        updatedAt: now,
        createdAt: now,
        legacyAdventureId: null,
      };

      const bundle = createEmptyBundle(header);
      await writeGuestPlanner({
        ...store,
        activeItineraryId: id,
        bundles: [bundle, ...store.bundles.filter(existing => existing.header.id !== id)],
      });
      return header;
    }

    const selectable = await listSelectableItinerariesForUser(userId);
    if (selectable.length >= MAX_ACTIVE_ITINERARIES) {
      throw createItineraryLimitError(selectable.length);
    }

    const { data, error } = await supabase
      .from('itineraries')
      .insert({
        user_id: userId,
        title: input.title.trim(),
        destination_city: input.destinationCity.trim(),
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        status: 'draft',
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message || 'Unable to create itinerary.');
    }

    const header = mapItineraryHeader(data);
    const emptyBundle = createEmptyBundle(header);
    await writeSnapshot(userId, emptyBundle);
    return header;
  },

  async ensureActiveItinerary(input: EnsureActiveItineraryInput = {}): Promise<{
    itineraryId: string;
    created: boolean;
    header: ItineraryHeader;
  }> {
    const loaded = await itineraryService.loadBuilderData();
    if (loaded.activeItineraryId && loaded.bundle) {
      return {
        itineraryId: loaded.activeItineraryId,
        created: false,
        header: loaded.bundle.header,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const created = await itineraryService.createItinerary({
      title: input.title?.trim() || `Trip ${today}`,
      destinationCity: input.destinationCity?.trim() || 'Open Road',
      startDate: null,
      endDate: null,
    });
    return {
      itineraryId: created.id,
      created: true,
      header: created,
    };
  },

  async addSavedActivityToDay(input: AddSavedToDayInput): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, async bundle => {
        const details = await activitiesService.getActivityDetails(input.activityId);
        if (!details) {
          throw new Error('Unable to load saved activity details.');
        }

        const dayIndex = Math.max(1, input.dayIndex);
        const nextDays = bundle.days.map(day => ({
          ...day,
          items: [...day.items],
        }));
        const day = nextDays.find(row => row.dayIndex === dayIndex);
        const nextPosition = day ? day.items.length : 0;

        const item: ItineraryActivityItem = {
          id: `guest-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          itineraryId: bundle.header.id,
          activityId: details.id,
          dayIndex,
          positionIndex: nextPosition,
          scheduledAt: null,
          narrativeWhy: null,
          title: details.title,
          imageUrl: details.imageUrl,
          category: details.categories[0] || null,
          city: details.city,
          lat: details.lat,
          lng: details.lng,
          durationMinutesMin: details.durationMinutesMin,
          durationMinutesMax: details.durationMinutesMax,
        };

        if (day) {
          day.items.push(item);
        } else {
          nextDays.push({ dayIndex, items: [item] });
        }

        return {
          ...bundle,
          days: nextDays,
        };
      });
    }

    const dayIndex = Math.max(1, input.dayIndex);
    const resolvedActivityId = await resolvePersistableActivityId(input.activityId);
    if (!resolvedActivityId) {
      throw new Error('Unable to add this activity right now. It is not indexed for itinerary use.');
    }

    const { data: dayRows, error: dayError } = await supabase
      .from('itinerary_items')
      .select('id,position_index')
      .eq('itinerary_id', input.itineraryId)
      .eq('day_index', dayIndex)
      .order('position_index', { ascending: true });
    if (dayError) {
      throw new Error(dayError.message || 'Unable to load day.');
    }

    const nextPosition =
      dayRows && dayRows.length
        ? Math.max(...dayRows.map(row => row.position_index ?? 0)) + 1
        : 0;

    let { error: insertError } = await supabase.from('itinerary_items').insert({
      itinerary_id: input.itineraryId,
      activity_id: resolvedActivityId,
      day_index: dayIndex,
      position_index: nextPosition,
    });

    if (insertError?.code === '23505') {
      await reindexDay(input.itineraryId, dayIndex);

      const { data: normalizedRows, error: normalizedError } = await supabase
        .from('itinerary_items')
        .select('position_index')
        .eq('itinerary_id', input.itineraryId)
        .eq('day_index', dayIndex)
        .order('position_index', { ascending: false })
        .limit(1);
      if (normalizedError) {
        throw new Error(normalizedError.message || 'Unable to normalize itinerary day.');
      }

      const retryPosition =
        normalizedRows && normalizedRows.length ? (normalizedRows[0].position_index ?? 0) + 1 : 0;
      const retry = await supabase.from('itinerary_items').insert({
        itinerary_id: input.itineraryId,
        activity_id: resolvedActivityId,
        day_index: dayIndex,
        position_index: retryPosition,
      });
      insertError = retry.error;
    }

    if (insertError) {
      throw new Error(insertError.message || 'Unable to add activity to itinerary.');
    }

    await touchItinerary(input.itineraryId);
    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async addActivityToDay(input: AddActivityToDayInput): Promise<ItineraryBundle> {
    return itineraryService.addSavedActivityToDay(input);
  },

  async removeLatestActivityFromDay(input: {
    itineraryId: string;
    activityId: string;
    dayIndex: number;
  }): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, bundle => {
        const targetDay = bundle.days.find(day => day.dayIndex === input.dayIndex);
        if (!targetDay) return bundle;

        const normalizedTarget = normalizeProviderId(input.activityId);
        const latestIndex = [...targetDay.items]
          .map((item, index) => ({ item, index }))
          .reverse()
          .find(({ item }) => normalizeProviderId(item.activityId) === normalizedTarget)?.index;

        if (latestIndex == null) return bundle;

        const nextDays = bundle.days
          .map(day =>
            day.dayIndex === input.dayIndex
              ? { ...day, items: day.items.filter((_, index) => index !== latestIndex) }
              : day
          )
          .filter(day => day.items.length > 0);
        return {
          ...bundle,
          days: nextDays,
        };
      });
    }

    const resolvedActivityId = await resolvePersistableActivityId(input.activityId);
    if (!resolvedActivityId) {
      throw new Error('Unable to undo add for this activity.');
    }

    const { data: row, error: rowError } = await supabase
      .from('itinerary_items')
      .select('id,position_index')
      .eq('itinerary_id', input.itineraryId)
      .eq('day_index', input.dayIndex)
      .eq('activity_id', resolvedActivityId)
      .order('position_index', { ascending: false })
      .limit(1)
      .single();
    if (rowError || !row) {
      throw new Error('No recent itinerary assignment found to undo.');
    }

    const { error: deleteError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('id', row.id)
      .eq('itinerary_id', input.itineraryId);
    if (deleteError) {
      throw new Error(deleteError.message || 'Unable to undo this add right now.');
    }

    await reindexDay(input.itineraryId, input.dayIndex);
    await touchItinerary(input.itineraryId);
    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async updateItineraryDetails(input: UpdateItineraryDetailsInput): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    const title = input.title.trim();
    const destinationCity = input.destinationCity.trim();
    if (title.length < 3 || title.length > 80) {
      throw new Error('Title must be between 3 and 80 characters.');
    }
    if (destinationCity.length < 2 || destinationCity.length > 80) {
      throw new Error('Destination must be between 2 and 80 characters.');
    }

    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, bundle => ({
        ...bundle,
        header: {
          ...bundle.header,
          title,
          destinationCity,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          updatedAt: new Date().toISOString(),
        },
      }));
    }

    const { error } = await supabase
      .from('itineraries')
      .update({
        title,
        destination_city: destinationCity,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.itineraryId)
      .eq('user_id', userId);
    if (error) {
      throw new Error(error.message || 'Unable to update itinerary details.');
    }

    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async removeItem(input: RemoveItineraryItemInput): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, bundle => {
        const nextDays = bundle.days
          .map(day => ({
            ...day,
            items: day.items.filter(item => item.id !== input.itemId),
          }))
          .filter(day => day.items.length > 0);

        return {
          ...bundle,
          days: nextDays,
        };
      });
    }

    const { data: row, error: rowError } = await supabase
      .from('itinerary_items')
      .select('id,day_index')
      .eq('id', input.itemId)
      .eq('itinerary_id', input.itineraryId)
      .single();
    if (rowError || !row) {
      throw new Error(rowError?.message || 'Unable to locate itinerary item.');
    }

    const { error: deleteError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('id', input.itemId)
      .eq('itinerary_id', input.itineraryId);
    if (deleteError) {
      throw new Error(deleteError.message || 'Unable to remove itinerary item.');
    }

    await reindexDay(input.itineraryId, row.day_index);
    await touchItinerary(input.itineraryId);
    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async reorderDayItems(input: ReorderDayInput): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, bundle => {
        const nextDays = bundle.days.map(day => {
          if (day.dayIndex !== input.dayIndex) return { ...day, items: [...day.items] };
          const reordered = reorderWithIndices(day.items, input.fromIndex, input.toIndex).map((item, index) => ({
            ...item,
            dayIndex: input.dayIndex,
            positionIndex: index,
          }));
          return { ...day, items: reordered };
        });

        return {
          ...bundle,
          days: nextDays,
        };
      });
    }

    const { data, error } = await supabase
      .from('itinerary_items')
      .select('id,position_index')
      .eq('itinerary_id', input.itineraryId)
      .eq('day_index', input.dayIndex)
      .order('position_index', { ascending: true });
    if (error) {
      throw new Error(error.message || 'Unable to load day for reorder.');
    }

    const ordered = data || [];
    if (
      input.fromIndex < 0 ||
      input.fromIndex >= ordered.length ||
      input.toIndex < 0 ||
      input.toIndex >= ordered.length ||
      input.fromIndex === input.toIndex
    ) {
      return refreshBundleAndSnapshot(userId, input.itineraryId);
    }

    const nextOrder = reorderWithIndices(ordered, input.fromIndex, input.toIndex);

    await applyDayOrder(
      input.itineraryId,
      input.dayIndex,
      nextOrder.map(row => row.id)
    );

    await touchItinerary(input.itineraryId);
    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async moveItemToDay(input: MoveItemToDayInput): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(input.itineraryId, bundle => {
        const targetDayIndex = Math.max(1, input.targetDayIndex);
        const currentDays = bundle.days.map(day => ({ ...day, items: [...day.items] }));

        let movingItem: ItineraryActivityItem | null = null;
        const sourceDayIndex = currentDays.find(day => day.items.some(item => item.id === input.itemId))?.dayIndex;
        if (sourceDayIndex == null) {
          throw new Error('Unable to locate item to move.');
        }

        const nextDays = currentDays
          .map(day => {
            if (day.dayIndex !== sourceDayIndex) return day;
            const sourceItems = day.items.filter(item => {
              if (item.id === input.itemId) {
                movingItem = item;
                return false;
              }
              return true;
            });
            return { ...day, items: sourceItems };
          })
          .filter(day => day.items.length > 0 || day.dayIndex === targetDayIndex);

        if (!movingItem) {
          throw new Error('Unable to locate item to move.');
        }
        const moving: ItineraryActivityItem = movingItem as ItineraryActivityItem;

        let targetDay = nextDays.find(day => day.dayIndex === targetDayIndex);
        if (!targetDay) {
          targetDay = { dayIndex: targetDayIndex, items: [] };
          nextDays.push(targetDay);
        }

        const insertAt = Math.max(0, Math.min(input.targetIndex ?? targetDay.items.length, targetDay.items.length));
        targetDay.items.splice(insertAt, 0, {
          ...moving,
          dayIndex: targetDayIndex,
        });

        const normalizedDays = nextDays.map(day => ({
          ...day,
          items: day.items.map((item, index) => ({ ...item, dayIndex: day.dayIndex, positionIndex: index })),
        }));

        return {
          ...bundle,
          days: normalizedDays,
        };
      });
    }

    const targetDayIndex = Math.max(1, input.targetDayIndex);

    const { data, error } = await supabase
      .from('itinerary_items')
      .select('id,day_index,position_index')
      .eq('itinerary_id', input.itineraryId)
      .order('day_index', { ascending: true })
      .order('position_index', { ascending: true });
    if (error) {
      throw new Error(error.message || 'Unable to load itinerary for move.');
    }

    const rows = data || [];
    const moving = rows.find(row => row.id === input.itemId);
    if (!moving) {
      throw new Error('Unable to locate item to move.');
    }

    if (moving.day_index === targetDayIndex) {
      const fromIndex = rows
        .filter(row => row.day_index === moving.day_index)
        .sort((a, b) => a.position_index - b.position_index)
        .findIndex(row => row.id === moving.id);
      const toIndex = input.targetIndex ?? fromIndex;
      return itineraryService.reorderDayItems({
        itineraryId: input.itineraryId,
        dayIndex: moving.day_index,
        fromIndex,
        toIndex,
      });
    }

    const sourceRows = rows
      .filter(row => row.day_index === moving.day_index && row.id !== moving.id)
      .sort((a, b) => a.position_index - b.position_index);
    const targetRows = rows
      .filter(row => row.day_index === targetDayIndex)
      .sort((a, b) => a.position_index - b.position_index);

    const insertAt = Math.max(0, Math.min(input.targetIndex ?? targetRows.length, targetRows.length));
    const targetIds = targetRows.map(row => row.id);
    targetIds.splice(insertAt, 0, moving.id);

    const tempPosition = 9000 + Math.floor(Math.random() * 1000);
    const { error: tempMoveError } = await supabase
      .from('itinerary_items')
      .update({ day_index: targetDayIndex, position_index: tempPosition })
      .eq('id', moving.id)
      .eq('itinerary_id', input.itineraryId);
    if (tempMoveError) {
      throw new Error(tempMoveError.message || 'Unable to prepare cross-day move.');
    }

    await applyDayOrder(
      input.itineraryId,
      moving.day_index,
      sourceRows.map(row => row.id)
    );
    await applyDayOrder(input.itineraryId, targetDayIndex, targetIds);

    await touchItinerary(input.itineraryId);
    return refreshBundleAndSnapshot(userId, input.itineraryId);
  },

  async getItineraryCreateCapacity(): Promise<{ count: number; max: number; canCreate: boolean }> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const store = await readGuestPlanner();
      const count = countGuestSelectableItineraries(store);
      return {
        count,
        max: MAX_ACTIVE_ITINERARIES,
        canCreate: count < MAX_ACTIVE_ITINERARIES,
      };
    }

    const itineraries = await listSelectableItinerariesForUser(userId);
    const count = itineraries.length;
    return {
      count,
      max: MAX_ACTIVE_ITINERARIES,
      canCreate: count < MAX_ACTIVE_ITINERARIES,
    };
  },

  async getPreferredAddTargetItineraryId(): Promise<string | null> {
    const userId = await getAuthedUserId();
    const key = preferredTargetStorageKeyForUser(userId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    try {
      if (!userId) {
        const store = await readGuestPlanner();
        const exists = store.bundles.some(
          bundle => bundle.header.id === stored && bundle.header.status !== 'archived'
        );
        if (!exists) {
          await AsyncStorage.removeItem(key);
          return null;
        }
        return stored;
      }

      const itineraries = await listSelectableItinerariesForUser(userId);
      const exists = itineraries.some(itinerary => itinerary.id === stored);
      if (!exists) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return stored;
    } catch {
      return stored;
    }
  },

  async setPreferredAddTargetItineraryId(itineraryId: string | null): Promise<void> {
    const userId = await getAuthedUserId();
    const key = preferredTargetStorageKeyForUser(userId);
    if (!itineraryId) {
      await AsyncStorage.removeItem(key);
      return;
    }

    if (!userId) {
      const store = await readGuestPlanner();
      const exists = store.bundles.some(
        bundle => bundle.header.id === itineraryId && bundle.header.status !== 'archived'
      );
      if (!exists) {
        throw new Error('Unable to set preferred itinerary target.');
      }
      await AsyncStorage.setItem(key, itineraryId);
      return;
    }

    const itineraries = await listSelectableItinerariesForUser(userId);
    const exists = itineraries.some(itinerary => itinerary.id === itineraryId);
    if (!exists) {
      throw new Error('Unable to set preferred itinerary target.');
    }
    await AsyncStorage.setItem(key, itineraryId);
  },

  async deleteItinerary(itineraryId: string): Promise<void> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const store = await readGuestPlanner();
      const nextStore: GuestPlannerEnvelope = {
        ...store,
        activeItineraryId: store.activeItineraryId === itineraryId ? null : store.activeItineraryId,
        bundles: store.bundles.filter(bundle => bundle.header.id !== itineraryId),
      };
      await writeGuestPlanner(nextStore);
      await clearPreferredTargetIfMatches(null, itineraryId);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('itinerary_id', itineraryId);
    if (deleteItemsError) {
      throw new Error(deleteItemsError.message || 'Failed to clear itinerary items.');
    }

    const { error: deleteItineraryError } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', itineraryId);
    if (deleteItineraryError) {
      throw new Error(deleteItineraryError.message || 'Failed to delete itinerary.');
    }

    await clearPreferredTargetIfMatches(userId, itineraryId);
    await AsyncStorage.removeItem(getSnapshotKey(userId));
  },

  async removeDay(itineraryId: string, dayIndex: number): Promise<ItineraryBundle> {
    const userId = await getAuthedUserId();
    if (!userId) {
      return withGuestBundleMutation(itineraryId, bundle => {
        const nextDays = compactDaysAfterRemoval(bundle.days, dayIndex);
        return {
          ...bundle,
          days: nextDays,
        };
      });
    }

    const { error: deleteError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('itinerary_id', itineraryId)
      .eq('day_index', dayIndex);
    if (deleteError) {
      throw new Error(deleteError.message || 'Failed to remove day items.');
    }

    const { data: remainingRows, error: remainingRowsError } = await supabase
      .from('itinerary_items')
      .select('id,day_index,position_index')
      .eq('itinerary_id', itineraryId)
      .order('day_index', { ascending: true })
      .order('position_index', { ascending: true });
    if (remainingRowsError) {
      throw new Error(remainingRowsError.message || 'Failed to compact itinerary days.');
    }

    const sourceDayMap = new Map<number, string[]>();
    (remainingRows || []).forEach(row => {
      const current = sourceDayMap.get(row.day_index) || [];
      current.push(row.id);
      sourceDayMap.set(row.day_index, current);
    });

    const sourceDayIndexes = [...sourceDayMap.keys()].sort((a, b) => a - b);
    for (const sourceDayIndex of sourceDayIndexes) {
      const ids = sourceDayMap.get(sourceDayIndex) || [];
      if (!ids.length) continue;
      const targetDayIndex = sourceDayIndex > dayIndex ? sourceDayIndex - 1 : sourceDayIndex;
      await applyDayOrder(itineraryId, targetDayIndex, ids);
    }

    await touchItinerary(itineraryId);
    return refreshBundleAndSnapshot(userId, itineraryId);
  },
};
