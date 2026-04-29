import AsyncStorage from '@react-native-async-storage/async-storage';

import { itineraryService } from './itinerary';
import { supabase } from './supabase';
import { Json, Tables } from '../types/database';
import {
  AutoStampCandidate,
  AutoStampResult,
  PassportAchievement,
  PassportAchievementDefinition,
  PassportDayProgress,
  PassportLocationPermissionStatus,
  PassportSnapshot,
  PassportStamp,
} from '../types/passport';

type PassportStampRow = Tables<'passport_stamps'>;
type PassportAchievementRow = Tables<'user_achievements'>;

type AuthProgress = {
  stamps: PassportStamp[];
  achievements: PassportAchievement[];
};

type SnapshotEnvelope = {
  version: number;
  savedAt: string;
  userId: string;
  stamps: PassportStamp[];
  achievements: PassportAchievement[];
};

type GuestStore = {
  version: number;
  savedAt: string;
  stamps: PassportStamp[];
  achievements: PassportAchievement[];
};

export type PassportStopTarget = {
  itineraryId: string;
  dayIndex: number;
  activityId: string | null;
  canonicalKey: string | null;
  placeId: string;
  title: string;
  city: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  dayTotalStops: number;
};

const SNAPSHOT_VERSION = 1;
const GUEST_STORE_VERSION = 1;
const GUEST_USER_ID = 'guest-local';

const SNAPSHOT_KEY_PREFIX = 'blame_travis:passport_snapshot:';
const GUEST_STORE_KEY = 'blame_travis:passport_guest_store:v1';
const LOCATION_PERMISSION_KEY = 'blame_travis:passport_location_permission:v1';
const PASSPORT_SCHEMA_MISSING_MESSAGE =
  'Passport backend setup is incomplete. Missing table public.passport_stamps. Run Supabase migration 008_passport_stamps_and_achievements.sql.';

export const PROXIMITY_STAMP_RADIUS_METERS = 152.4;
export const AUTO_STAMP_DWELL_MS = 120000;

const PLACE_MILESTONES = [5, 10, 25, 50, 100] as const;
const COUNTRY_MILESTONES = [2, 5, 10] as const;
const COMPLETION_MILESTONES = [1, 5, 10] as const;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeCountryCode = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : null;
};

const getSnapshotKey = (userId: string) => `${SNAPSHOT_KEY_PREFIX}${userId}`;

const defaultGuestStore = (): GuestStore => ({
  version: GUEST_STORE_VERSION,
  savedAt: new Date().toISOString(),
  stamps: [],
  achievements: [],
});

const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const mapStampRow = (row: PassportStampRow): PassportStamp => ({
  id: row.id,
  userId: row.user_id,
  itineraryId: row.itinerary_id,
  dayIndex: row.day_index,
  activityId: row.activity_id,
  placeId: row.place_id,
  canonicalKey: row.canonical_key,
  title: row.title,
  city: row.city,
  countryCode: normalizeCountryCode(row.country_code),
  lat: row.lat,
  lng: row.lng,
  source: row.source === 'proximity_auto' ? 'proximity_auto' : 'proximity_auto',
  distanceMeters: row.distance_meters,
  dayTotalStops: row.day_total_stops,
  dayStampedCountAtStamp: row.day_stamped_count_at_stamp,
  stampedAt: row.stamped_at,
  createdAt: row.created_at,
});

const mapAchievementRow = (row: PassportAchievementRow): PassportAchievement => ({
  id: row.id,
  userId: row.user_id,
  achievementKey: row.achievement_key,
  metadata: parseJsonRecord(row.metadata_json),
  unlockedAt: row.unlocked_at,
  createdAt: row.created_at,
});

const sortStampsByNewest = (stamps: PassportStamp[]): PassportStamp[] =>
  [...stamps].sort((a, b) => b.stampedAt.localeCompare(a.stampedAt));

const sortStampsByOldest = (stamps: PassportStamp[]): PassportStamp[] =>
  [...stamps].sort((a, b) => a.stampedAt.localeCompare(b.stampedAt));

const sortAchievementsByNewest = (achievements: PassportAchievement[]): PassportAchievement[] =>
  [...achievements].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));

const readSnapshot = async (userId: string): Promise<SnapshotEnvelope | null> => {
  try {
    const raw = await AsyncStorage.getItem(getSnapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    if (
      parsed.version !== SNAPSHOT_VERSION ||
      parsed.userId !== userId ||
      !Array.isArray(parsed.stamps) ||
      !Array.isArray(parsed.achievements)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeSnapshot = async (userId: string, progress: AuthProgress): Promise<void> => {
  const envelope: SnapshotEnvelope = {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    userId,
    stamps: sortStampsByNewest(progress.stamps),
    achievements: sortAchievementsByNewest(progress.achievements),
  };
  await AsyncStorage.setItem(getSnapshotKey(userId), JSON.stringify(envelope));
};

const readGuestStore = async (): Promise<GuestStore> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_STORE_KEY);
    if (!raw) return defaultGuestStore();
    const parsed = JSON.parse(raw) as GuestStore;
    if (
      parsed.version !== GUEST_STORE_VERSION ||
      !Array.isArray(parsed.stamps) ||
      !Array.isArray(parsed.achievements)
    ) {
      return defaultGuestStore();
    }
    return {
      ...defaultGuestStore(),
      ...parsed,
      stamps: sortStampsByNewest(parsed.stamps),
      achievements: sortAchievementsByNewest(parsed.achievements),
    };
  } catch {
    return defaultGuestStore();
  }
};

const writeGuestStore = async (store: GuestStore): Promise<void> => {
  await AsyncStorage.setItem(
    GUEST_STORE_KEY,
    JSON.stringify({
      ...store,
      version: GUEST_STORE_VERSION,
      savedAt: new Date().toISOString(),
      stamps: sortStampsByNewest(store.stamps),
      achievements: sortAchievementsByNewest(store.achievements),
    }),
  );
};

const getAuthedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    const message = error.message ?? '';
    if (message.includes('Invalid Refresh Token') || message.includes('Already Used')) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    return null;
  }
  return data.session?.user.id || null;
};

const buildDayProgressKey = (stamp: PassportStamp): string =>
  `${stamp.itineraryId || 'none'}::${stamp.dayIndex}`;

export const deriveDayProgress = (stamps: PassportStamp[]): PassportDayProgress[] => {
  const map = new Map<string, PassportDayProgress>();

  sortStampsByOldest(stamps).forEach(stamp => {
    const key = buildDayProgressKey(stamp);
    const current = map.get(key) || {
      itineraryId: stamp.itineraryId,
      dayIndex: stamp.dayIndex,
      totalStops: 0,
      stampedStops: 0,
      isComplete: false,
    };

    const nextStampedStops =
      stamp.dayStampedCountAtStamp != null
        ? Math.max(current.stampedStops, stamp.dayStampedCountAtStamp)
        : current.stampedStops + 1;
    const nextTotalStops =
      stamp.dayTotalStops != null
        ? Math.max(current.totalStops, stamp.dayTotalStops)
        : Math.max(current.totalStops, nextStampedStops);

    map.set(key, {
      ...current,
      stampedStops: nextStampedStops,
      totalStops: nextTotalStops,
      isComplete: nextTotalStops > 0 && nextStampedStops >= nextTotalStops,
    });
  });

  return [...map.values()].sort((a, b) => {
    if (a.itineraryId === b.itineraryId) {
      return a.dayIndex - b.dayIndex;
    }
    return (a.itineraryId || '').localeCompare(b.itineraryId || '');
  });
};

const uniqueCount = (values: Array<string | null | undefined>): number => {
  const set = new Set<string>();
  values.forEach(value => {
    if (!value) return;
    const normalized = value.trim();
    if (normalized.length) set.add(normalized);
  });
  return set.size;
};

const isMissingPassportTableError = (error: unknown): boolean => {
  const message = String((error as { message?: string } | null)?.message || error || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.passport_stamps'") ||
    message.includes('relation "passport_stamps" does not exist') ||
    (message.includes('schema cache') && message.includes('passport_stamps'))
  );
};

const getHomeCountryCode = (stamps: PassportStamp[]): string | null =>
  sortStampsByOldest(stamps).find(stamp => stamp.countryCode)?.countryCode || null;

export const derivePassportStats = (
  stamps: PassportStamp[],
  dayProgress: PassportDayProgress[] = deriveDayProgress(stamps),
) => {
  const orderedByOldest = sortStampsByOldest(stamps);
  const orderedByNewest = sortStampsByNewest(stamps);
  const completedDayCount = dayProgress.filter(day => day.isComplete).length;

  return {
    totalStampedStops: stamps.length,
    uniqueCities: uniqueCount(
      stamps.map(stamp =>
        stamp.city
          ? `${stamp.city.trim().toLowerCase()}::${stamp.countryCode || ''}`
          : null,
      ),
    ),
    uniqueCountries: uniqueCount(stamps.map(stamp => normalizeCountryCode(stamp.countryCode))),
    completedDayCount,
    homeCountryCode: getHomeCountryCode(stamps),
    firstStampAt: orderedByOldest[0]?.stampedAt || null,
    lastStampAt: orderedByNewest[0]?.stampedAt || null,
  };
};

const ACHIEVEMENT_DEFINITIONS: PassportAchievementDefinition[] = [
  {
    key: 'first_stamp',
    title: 'First Stamp',
    description: 'Stamped your first verified stop.',
    group: 'journey',
  },
  {
    key: 'first_abroad',
    title: 'First Abroad',
    description: 'Stamped a country outside your first stamped country.',
    group: 'countries',
  },
  ...PLACE_MILESTONES.map((threshold) => ({
    key: `places_${threshold}`,
    title: `${threshold} Places`,
    description: `Stamped ${threshold} unique stops.`,
    group: 'places' as const,
    threshold,
  })),
  ...COUNTRY_MILESTONES.map((threshold) => ({
    key: `countries_${threshold}`,
    title: `${threshold} Countries`,
    description: `Stamped stops in ${threshold} countries.`,
    group: 'countries' as const,
    threshold,
  })),
  ...COMPLETION_MILESTONES.map((threshold) => ({
    key: `days_completed_${threshold}`,
    title: `${threshold} Days Completed`,
    description: `Completed ${threshold} itinerary day ${threshold === 1 ? 'chapter' : 'chapters'}.`,
    group: 'completion' as const,
    threshold,
  })),
];

const achievementByKey = new Map<string, PassportAchievementDefinition>(
  ACHIEVEMENT_DEFINITIONS.map(def => [def.key, def]),
);

export const listAchievementDefinitions = (): PassportAchievementDefinition[] => ACHIEVEMENT_DEFINITIONS;

export const evaluateAchievementUnlocks = (
  stamps: PassportStamp[],
  achievements: PassportAchievement[],
): PassportAchievementDefinition[] => {
  const unlocked = new Set(achievements.map(item => item.achievementKey));
  const next: PassportAchievementDefinition[] = [];
  const dayProgress = deriveDayProgress(stamps);
  const stats = derivePassportStats(stamps, dayProgress);
  const homeCountry = stats.homeCountryCode;
  const countries = new Set(
    stamps
      .map(stamp => normalizeCountryCode(stamp.countryCode))
      .filter((value): value is string => Boolean(value)),
  );

  const register = (key: string) => {
    if (unlocked.has(key)) return;
    const definition = achievementByKey.get(key);
    if (!definition) return;
    unlocked.add(key);
    next.push(definition);
  };

  if (stats.totalStampedStops >= 1) {
    register('first_stamp');
  }

  if (homeCountry && [...countries].some(countryCode => countryCode !== homeCountry)) {
    register('first_abroad');
  }

  PLACE_MILESTONES.forEach((threshold) => {
    if (stats.totalStampedStops >= threshold) {
      register(`places_${threshold}`);
    }
  });

  COUNTRY_MILESTONES.forEach((threshold) => {
    if (stats.uniqueCountries >= threshold) {
      register(`countries_${threshold}`);
    }
  });

  COMPLETION_MILESTONES.forEach((threshold) => {
    if (stats.completedDayCount >= threshold) {
      register(`days_completed_${threshold}`);
    }
  });

  return next;
};

const buildAchievementMetadata = (
  definition: PassportAchievementDefinition,
  stats: ReturnType<typeof derivePassportStats>,
): Json => ({
  group: definition.group,
  threshold: definition.threshold ?? null,
  totalStampedStops: stats.totalStampedStops,
  uniqueCountries: stats.uniqueCountries,
  completedDayCount: stats.completedDayCount,
  homeCountryCode: stats.homeCountryCode,
});

const readRemoteProgress = async (userId: string): Promise<AuthProgress> => {
  const [stampResponse, achievementResponse] = await Promise.all([
    supabase
      .from('passport_stamps')
      .select('*')
      .eq('user_id', userId)
      .order('stamped_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false }),
  ]);

  if (stampResponse.error) {
    throw new Error(stampResponse.error.message || 'Failed to load passport stamps.');
  }
  if (achievementResponse.error) {
    throw new Error(achievementResponse.error.message || 'Failed to load passport achievements.');
  }

  return {
    stamps: (stampResponse.data || []).map(mapStampRow),
    achievements: (achievementResponse.data || []).map(mapAchievementRow),
  };
};

const insertAchievementsRemote = async (
  userId: string,
  definitions: PassportAchievementDefinition[],
  stats: ReturnType<typeof derivePassportStats>,
): Promise<PassportAchievement[]> => {
  if (!definitions.length) return [];

  const now = new Date().toISOString();
  const payload = definitions.map(definition => ({
    user_id: userId,
    achievement_key: definition.key,
    metadata_json: buildAchievementMetadata(definition, stats),
    unlocked_at: now,
  }));

  const { data, error } = await supabase
    .from('user_achievements')
    .upsert(payload, {
      onConflict: 'user_id,achievement_key',
      ignoreDuplicates: true,
    })
    .select('*');

  if (error) {
    return [];
  }

  return (data || []).map(mapAchievementRow);
};

const countStampedForDay = (
  stamps: PassportStamp[],
  itineraryId: string,
  dayIndex: number,
): number =>
  stamps.filter(stamp => stamp.itineraryId === itineraryId && stamp.dayIndex === dayIndex).length;

const toAchievementObject = (
  userId: string,
  definition: PassportAchievementDefinition,
  stats: ReturnType<typeof derivePassportStats>,
): PassportAchievement => {
  const now = new Date().toISOString();
  return {
    id: `guest-achievement-${definition.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    achievementKey: definition.key,
    metadata: parseJsonRecord(buildAchievementMetadata(definition, stats)),
    unlockedAt: now,
    createdAt: now,
  };
};

const toSnapshot = (
  progress: AuthProgress,
  permissionStatus: PassportLocationPermissionStatus,
  offline: boolean,
  offlineSavedAt: string | null,
): PassportSnapshot => {
  const dayProgress = deriveDayProgress(progress.stamps);
  return {
    stamps: sortStampsByNewest(progress.stamps),
    achievements: sortAchievementsByNewest(progress.achievements),
    stats: derivePassportStats(progress.stamps, dayProgress),
    dayProgress,
    offline,
    offlineSavedAt,
    permissionStatus,
  };
};

const createStampFromCandidate = (
  userId: string,
  candidate: AutoStampCandidate,
  dayStampedCountAtStamp: number,
): PassportStamp => {
  const now = new Date().toISOString();
  return {
    id: `guest-stamp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    itineraryId: candidate.itineraryId,
    dayIndex: candidate.dayIndex,
    activityId: candidate.activityId,
    placeId: candidate.placeId,
    canonicalKey: candidate.canonicalKey,
    title: candidate.title,
    city: candidate.city,
    countryCode: normalizeCountryCode(candidate.countryCode),
    lat: candidate.lat,
    lng: candidate.lng,
    source: 'proximity_auto',
    distanceMeters: candidate.distanceMeters,
    dayTotalStops: candidate.dayTotalStops,
    dayStampedCountAtStamp,
    stampedAt: now,
    createdAt: now,
  };
};

export const buildPlaceId = (params: {
  canonicalKey?: string | null;
  activityId?: string | null;
  fallbackId: string;
}): string => {
  if (params.canonicalKey && params.canonicalKey.trim().length) {
    return params.canonicalKey.trim();
  }
  if (params.activityId && params.activityId.trim().length) {
    return params.activityId.trim();
  }
  return params.fallbackId;
};

export const computeDistanceMeters = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latDiff = toRadians(to.lat - from.lat);
  const lngDiff = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

export const passportService = {
  async getLocationPermissionStatus(): Promise<PassportLocationPermissionStatus> {
    try {
      const raw = await AsyncStorage.getItem(LOCATION_PERMISSION_KEY);
      if (raw === 'granted' || raw === 'denied' || raw === 'undetermined') {
        return raw;
      }
      return 'undetermined';
    } catch {
      return 'undetermined';
    }
  },

  async setLocationPermissionStatus(status: PassportLocationPermissionStatus): Promise<void> {
    await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, status);
  },

  async loadSnapshot(): Promise<PassportSnapshot> {
    const permissionStatus = await this.getLocationPermissionStatus();
    const userId = await getAuthedUserId();

    if (!userId) {
      const guestStore = await readGuestStore();
      return toSnapshot(
        {
          stamps: guestStore.stamps,
          achievements: guestStore.achievements,
        },
        permissionStatus,
        false,
        guestStore.savedAt,
      );
    }

    try {
      const remote = await readRemoteProgress(userId);
      await writeSnapshot(userId, remote);
      return toSnapshot(remote, permissionStatus, false, null);
    } catch (error: any) {
      const snapshot = await readSnapshot(userId);
      if (snapshot) {
        return toSnapshot(
          {
            stamps: snapshot.stamps,
            achievements: snapshot.achievements,
          },
          permissionStatus,
          true,
          snapshot.savedAt,
        );
      }
      if (isMissingPassportTableError(error)) {
        throw new Error(PASSPORT_SCHEMA_MISSING_MESSAGE);
      }
      throw new Error(error?.message || 'Failed to load passport data.');
    }
  },

  async listActiveItineraryStops(): Promise<{ itineraryId: string | null; stops: PassportStopTarget[] }> {
    const result = await itineraryService.loadBuilderData();
    if (!result.activeItineraryId || !result.bundle) {
      return { itineraryId: null, stops: [] };
    }

    const stops = result.bundle.days.flatMap(day => {
      const totalStops = day.items.length;
      return day.items
        .filter(item => item.lat != null && item.lng != null)
        .map(item => ({
          itineraryId: result.activeItineraryId as string,
          dayIndex: day.dayIndex,
          activityId: item.activityId || null,
          canonicalKey: item.canonicalKey,
          placeId: buildPlaceId({
            canonicalKey: item.canonicalKey,
            activityId: item.activityId,
            fallbackId: item.id,
          }),
          title: item.title,
          city: item.city,
          countryCode: normalizeCountryCode(item.countryCode),
          lat: item.lat as number,
          lng: item.lng as number,
          dayTotalStops: totalStops,
        }));
    });

    return {
      itineraryId: result.activeItineraryId,
      stops,
    };
  },

  async recordAutoStamp(candidate: AutoStampCandidate): Promise<AutoStampResult> {
    const userId = await getAuthedUserId();
    const ownerId = userId || GUEST_USER_ID;

    if (!userId) {
      const guestStore = await readGuestStore();
      if (guestStore.stamps.some(stamp => stamp.placeId === candidate.placeId)) {
        return { didStamp: false, stamp: null, unlocked: [], reason: 'already_stamped' };
      }

      const dayStampedCountAtStamp =
        countStampedForDay(guestStore.stamps, candidate.itineraryId, candidate.dayIndex) + 1;
      const stamp = createStampFromCandidate(ownerId, candidate, dayStampedCountAtStamp);
      const nextStamps = [stamp, ...guestStore.stamps];
      const unlocks = evaluateAchievementUnlocks(nextStamps, guestStore.achievements);
      const stats = derivePassportStats(nextStamps);
      const nextAchievements = [
        ...guestStore.achievements,
        ...unlocks.map(unlock => toAchievementObject(ownerId, unlock, stats)),
      ];

      await writeGuestStore({
        ...guestStore,
        stamps: nextStamps,
        achievements: nextAchievements,
      });

      return {
        didStamp: true,
        stamp,
        unlocked: unlocks,
      };
    }

    let remote: AuthProgress;
    try {
      remote = await readRemoteProgress(userId);
    } catch {
      return { didStamp: false, stamp: null, unlocked: [], reason: 'persist_failed' };
    }

    if (remote.stamps.some(stamp => stamp.placeId === candidate.placeId)) {
      return { didStamp: false, stamp: null, unlocked: [], reason: 'already_stamped' };
    }

    const dayStampedCountAtStamp =
      countStampedForDay(remote.stamps, candidate.itineraryId, candidate.dayIndex) + 1;

    const payload = {
      user_id: userId,
      itinerary_id: isUuid(candidate.itineraryId) ? candidate.itineraryId : null,
      day_index: candidate.dayIndex,
      activity_id: candidate.activityId && isUuid(candidate.activityId) ? candidate.activityId : null,
      place_id: candidate.placeId,
      canonical_key: candidate.canonicalKey,
      title: candidate.title,
      city: candidate.city,
      country_code: normalizeCountryCode(candidate.countryCode),
      lat: candidate.lat,
      lng: candidate.lng,
      source: 'proximity_auto' as const,
      distance_meters: Number(candidate.distanceMeters.toFixed(2)),
      day_total_stops: candidate.dayTotalStops,
      day_stamped_count_at_stamp: dayStampedCountAtStamp,
    };

    const { data: insertedStampData, error: insertError } = await supabase
      .from('passport_stamps')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return { didStamp: false, stamp: null, unlocked: [], reason: 'already_stamped' };
      }
      return { didStamp: false, stamp: null, unlocked: [], reason: 'persist_failed' };
    }

    const stamped = mapStampRow(insertedStampData);
    const nextStamps = [stamped, ...remote.stamps];
    const unlocks = evaluateAchievementUnlocks(nextStamps, remote.achievements);
    const stats = derivePassportStats(nextStamps);
    const insertedAchievements = await insertAchievementsRemote(userId, unlocks, stats);

    const mergedAchievementsByKey = new Map<string, PassportAchievement>();
    [...remote.achievements, ...insertedAchievements].forEach(achievement => {
      mergedAchievementsByKey.set(achievement.achievementKey, achievement);
    });

    await writeSnapshot(userId, {
      stamps: nextStamps,
      achievements: [...mergedAchievementsByKey.values()],
    });

    return {
      didStamp: true,
      stamp: stamped,
      unlocked: unlocks,
    };
  },
};
