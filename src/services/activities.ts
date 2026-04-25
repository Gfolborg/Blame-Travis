import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { placesService } from './places';
import { ExploreActivity, ActivityRow } from '../types/explore';

const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const GUEST_SAVED_KEY = 'activities.guest_saved.v1';

type DetailCacheEntry = {
  activity: ExploreActivity;
  cachedAt: number;
};

const detailCache = new Map<string, DetailCacheEntry>();

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeProviderId = (value: string) =>
  value.startsWith('provider:') ? value.replace('provider:', '') : value;

const buildIdentityKeys = (id: string, canonicalKey?: string | null): string[] => {
  const keySet = new Set<string>();
  const normalizedId = normalizeProviderId(id);

  keySet.add(id);
  keySet.add(normalizedId);

  if (canonicalKey) {
    keySet.add(canonicalKey);
    keySet.add(`provider:${canonicalKey}`);
  }

  return [...keySet].filter(Boolean);
};

const getCacheLookupKeys = (id: string): string[] => {
  const normalizedId = normalizeProviderId(id);
  return [`id:${id}`, `id:${normalizedId}`, `canonical:${normalizedId}`];
};

const readFromDetailCache = (id: string): ExploreActivity | null => {
  const now = Date.now();
  const lookupKeys = getCacheLookupKeys(id);

  for (const key of lookupKeys) {
    const entry = detailCache.get(key);
    if (!entry) continue;
    if (now - entry.cachedAt > DETAIL_CACHE_TTL_MS) {
      detailCache.delete(key);
      continue;
    }
    return entry.activity;
  }

  return null;
};

const writeToDetailCache = (activity: ExploreActivity, requestId?: string) => {
  const now = Date.now();
  const identityKeys = buildIdentityKeys(activity.id, activity.canonicalKey);

  for (const key of identityKeys) {
    detailCache.set(`id:${key}`, { activity, cachedAt: now });
  }

  if (activity.canonicalKey) {
    detailCache.set(`canonical:${activity.canonicalKey}`, { activity, cachedAt: now });
  }

  if (requestId) {
    for (const key of getCacheLookupKeys(requestId)) {
      detailCache.set(key, { activity, cachedAt: now });
    }
  }
};

const normalizeDbActivity = (row: ActivityRow): ExploreActivity => ({
  id: row.id,
  canonicalKey: row.canonical_key,
  title: row.title,
  summary: row.summary,
  categories: row.categories || [],
  tags: row.tags || [],
  source: 'db',
  provider: row.source_priority || null,
  ratingAverage: row.rating_average,
  ratingCount: row.rating_count,
  durationMinutesMin: row.duration_minutes_min,
  durationMinutesMax: row.duration_minutes_max,
  priceTier: row.pricing_tier,
  familyFriendly: row.family_friendly,
  accessibilityTags: row.accessibility_tags || [],
  bookingSupported: Boolean(row.booking_supported),
  bookingDeepLink: row.booking_deep_link,
  imageUrl: row.image_url,
  city: row.location_city,
  region: row.location_region,
  countryCode: row.location_country_code,
  lat: row.location_lat,
  lng: row.location_lng,
});

const mapProviderPriceTier = (input: string | null | undefined) => {
  if (!input) return 'unknown' as const;
  const normalized = input.toUpperCase();
  if (normalized.includes('FREE')) return 'free' as const;
  if (normalized.includes('INEXPENSIVE') || normalized === '$') return 'budget' as const;
  if (normalized.includes('MODERATE') || normalized === '$$') return 'mid' as const;
  if (normalized.includes('EXPENSIVE') || normalized.includes('VERY_EXPENSIVE') || normalized.length >= 3) {
    return 'premium' as const;
  }
  return 'unknown' as const;
};

const normalizeProviderActivity = (place: any): ExploreActivity => {
  const primaryType = String(place.primaryType || place.categories?.[0]?.name || 'activity');
  return {
    id: `provider:${place.id || place.fsq_id || Math.random().toString(36).slice(2)}`,
    canonicalKey: String(place.id || place.fsq_id || ''),
    title: place.displayName?.text || place.name || 'Untitled Activity',
    summary: place.editorialSummary?.text || null,
    categories: [primaryType],
    tags: [],
    source: 'provider',
    provider: 'google_places',
    ratingAverage: place.rating || null,
    ratingCount: place.userRatingCount || null,
    durationMinutesMin: null,
    durationMinutesMax: null,
    priceTier: mapProviderPriceTier(place.priceLevel || place.price),
    familyFriendly: null,
    accessibilityTags: [],
    bookingSupported: Boolean(place.bookingSupported || place.websiteUri),
    bookingDeepLink: place.websiteUri || null,
    imageUrl: null,
    city: place.addressComponents?.find((part: any) => part.types?.includes('locality'))?.shortText || null,
    region: null,
    countryCode: null,
    lat: place.location?.latitude || place.geocodes?.main?.latitude || null,
    lng: place.location?.longitude || place.geocodes?.main?.longitude || null,
  };
};

const getAuthedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    const message = error.message ?? '';
    const isInvalidRefreshToken =
      message.includes('Invalid Refresh Token') || message.includes('Already Used');
    if (isInvalidRefreshToken) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    return null;
  }
  return data.session?.user.id || null;
};

const resolveDbActivityId = async (activityId: string): Promise<string | null> => {
  if (!activityId) return null;

  if (isUuid(activityId)) {
    return activityId;
  }

  const canonicalKey = normalizeProviderId(activityId);
  const { data } = await supabase
    .from('activities')
    .select('id')
    .eq('canonical_key', canonicalKey)
    .single();

  return data?.id || null;
};

const readGuestSavedActivities = async (): Promise<ExploreActivity[]> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ExploreActivity[];
  } catch {
    return [];
  }
};

const writeGuestSavedActivities = async (activities: ExploreActivity[]): Promise<void> => {
  await AsyncStorage.setItem(GUEST_SAVED_KEY, JSON.stringify(activities));
};

const matchesActivityIdentity = (saved: Pick<ExploreActivity, 'id' | 'canonicalKey'>, activityId: string): boolean => {
  const targetCanonical = normalizeProviderId(activityId);
  const keys = buildIdentityKeys(saved.id, saved.canonicalKey);
  return keys.includes(activityId) || keys.includes(targetCanonical) || keys.includes(`provider:${targetCanonical}`);
};

export type SaveMutationReason =
  | 'activity_not_indexed'
  | 'db_error';

export type SaveMutationResult = {
  ok: boolean;
  reason?: SaveMutationReason;
};

export const activitiesService = {
  getIdentityKeys(activity: Pick<ExploreActivity, 'id' | 'canonicalKey'>): string[] {
    return buildIdentityKeys(activity.id, activity.canonicalKey);
  },

  async getActivityDetails(id: string): Promise<ExploreActivity | null> {
    const cached = readFromDetailCache(id);
    if (cached) {
      return cached;
    }

    // 1. Try DB first
    if (!id.startsWith('provider:')) {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const normalized = normalizeDbActivity(data);
        writeToDetailCache(normalized, id);
        return normalized;
      }
      
      // Also try by canonical key if id is not UUID but looks like a key
      const { data: dataByKey, error: errorByKey } = await supabase
        .from('activities')
        .select('*')
        .eq('canonical_key', id)
        .single();
        
      if (!errorByKey && dataByKey) {
        const normalized = normalizeDbActivity(dataByKey);
        writeToDetailCache(normalized, id);
        return normalized;
      }
    }

    // 2. If not found or is provider ID, try provider
    const providerId = id.startsWith('provider:') ? id.replace('provider:', '') : id;
    try {
      const place = await placesService.getPlaceDetails(providerId);
      if (place) {
        const normalized = normalizeProviderActivity(place);
        writeToDetailCache(normalized, id);
        return normalized;
      }
    } catch (err) {
      console.warn('Provider detail fetch failed:', err);
    }

    return null;
  },

  async isSaved(activityId: string): Promise<boolean> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const local = await readGuestSavedActivities();
      return local.some(item => matchesActivityIdentity(item, activityId));
    }

    const dbActivityId = await resolveDbActivityId(activityId);
    if (!dbActivityId) return false;

    const { data, error } = await supabase
      .from('saved_activities')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_id', dbActivityId)
      .single();

    return !error && !!data;
  },

  async saveActivity(params: {
    activityId: string;
    context: 'list' | 'map' | 'details' | 'collection';
    searchSessionId?: string | null;
    activitySnapshot?: ExploreActivity;
  }): Promise<SaveMutationResult> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const local = await readGuestSavedActivities();
      const alreadySaved = local.some(item => matchesActivityIdentity(item, params.activityId));
      if (alreadySaved) return { ok: true };

      const nextActivity = params.activitySnapshot || (await this.getActivityDetails(params.activityId));
      if (!nextActivity) {
        return { ok: false, reason: 'activity_not_indexed' };
      }

      await writeGuestSavedActivities([nextActivity, ...local]);
      writeToDetailCache(nextActivity, params.activityId);
      return { ok: true };
    }

    const dbActivityId = await resolveDbActivityId(params.activityId);
    if (!dbActivityId) {
      console.warn('Attempted to save an activity not in DB:', params.activityId);
      return { ok: false, reason: 'activity_not_indexed' };
    }

    const payload = {
      user_id: userId,
      activity_id: dbActivityId,
      source_context: params.context,
      search_session_id: params.searchSessionId || null,
    };

    let { error } = await supabase.from('saved_activities').upsert(payload, {
      onConflict: 'user_id,activity_id',
      ignoreDuplicates: true,
    });

    // If the session reference is invalid/missing, retry without search_session_id.
    if (error && (error.code === '23503' || error.code === '42501')) {
      const retry = await supabase.from('saved_activities').upsert(
        { ...payload, search_session_id: null },
        {
          onConflict: 'user_id,activity_id',
          ignoreDuplicates: true,
        },
      );
      error = retry.error;
    }

    if (error) {
      console.warn('saveActivity failed:', error.message);
      return { ok: false, reason: 'db_error' };
    }

    return { ok: true };
  },

  async unsaveActivity(activityId: string): Promise<boolean> {
    const userId = await getAuthedUserId();
    if (!userId) {
      const local = await readGuestSavedActivities();
      const next = local.filter(item => !matchesActivityIdentity(item, activityId));
      await writeGuestSavedActivities(next);
      return true;
    }

    const dbActivityId = await resolveDbActivityId(activityId);
    if (!dbActivityId) return false;

    const { error } = await supabase
      .from('saved_activities')
      .delete()
      .eq('user_id', userId)
      .eq('activity_id', dbActivityId);

    return !error;
  },

  async getSavedActivities(): Promise<ExploreActivity[]> {
    const userId = await getAuthedUserId();
    if (!userId) return readGuestSavedActivities();

    const { data, error } = await supabase
      .from('saved_activities')
      .select('activities (*)')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) return [];

    const savedActivityRows: ActivityRow[] = (data || [])
      .map((row: any) => row.activities)
      .filter((activity: ActivityRow | null | undefined): activity is ActivityRow => Boolean(activity));

    return savedActivityRows.map(normalizeDbActivity);
  },

  async getTravisExplanation(activity: ExploreActivity): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('travis-narrative', {
        body: {
          action: 'get-activity-explanation',
          activityTitle: activity.title,
          activitySummary: activity.summary,
          categories: activity.categories,
          location: activity.city || activity.region || 'Unknown',
        },
      });

      if (error || !data?.explanation) {
        return `Travis: 'This spot has the right energy for your journey. Don't overthink it, just go.'`;
      }

      return data.explanation;
    } catch {
      return `Travis: 'I looked at the dossier and this is the one. No further questions.'`;
    }
  },
};
