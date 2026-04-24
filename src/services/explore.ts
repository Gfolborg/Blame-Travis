import { supabase } from './supabase';
import {
  ActivityRow,
  ExploreActivity,
  ExploreFilters,
  ExploreSearchInput,
  ExploreSearchResult,
} from '../types/explore';

const DB_RESULT_TARGET = 12;

const toLowerSet = (values: string[]) => new Set(values.map(value => value.toLowerCase()));

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

const computeDurationMinutes = (activity: ExploreActivity): number | null => {
  if (activity.durationMinutesMin != null && activity.durationMinutesMax != null) {
    return Math.round((activity.durationMinutesMin + activity.durationMinutesMax) / 2);
  }
  if (activity.durationMinutesMin != null) return activity.durationMinutesMin;
  if (activity.durationMinutesMax != null) return activity.durationMinutesMax;
  return null;
};

const matchesDurationFilter = (activity: ExploreActivity, durationFilters: ExploreFilters['durations']) => {
  if (!durationFilters.length) return true;
  const minutes = computeDurationMinutes(activity);
  if (minutes == null) return true;
  return durationFilters.some(bucket => {
    if (bucket === 'lt60') return minutes < 60;
    if (bucket === '60_180') return minutes >= 60 && minutes <= 180;
    if (bucket === '181_360') return minutes >= 181 && minutes <= 360;
    return minutes > 360;
  });
};

const matchesGroupFilter = (activity: ExploreActivity, groupTypes: ExploreFilters['groupTypes']) => {
  if (!groupTypes.length) return true;

  const categorySet = toLowerSet(activity.categories);
  const tagSet = toLowerSet(activity.tags);
  const tokens = new Set([...categorySet, ...tagSet]);
  const hasAny = (values: string[]) => values.some(value => tokens.has(value));

  return groupTypes.some(group => {
    if (group === 'family') {
      return activity.familyFriendly === true || categorySet.has('family') || tagSet.has('family');
    }
    if (group === 'solo') {
      return hasAny(['solo', 'self_guided', 'museum', 'art_gallery', 'park', 'hiking']);
    }
    if (group === 'couple') {
      return hasAny(['romantic', 'couple', 'date_night', 'spa', 'scenic_viewpoint']);
    }
    return hasAny(['group', 'friends', 'night_club', 'live_music_venue', 'amusement_park', 'bowling_alley']);
  });
};

const applyFilters = (activities: ExploreActivity[], filters: ExploreFilters) => {
  const selectedCategories = toLowerSet(filters.categories);
  const selectedAccessibility = toLowerSet(filters.accessibility);
  const selectedPriceTiers = new Set(filters.priceTiers);

  return activities.filter(activity => {
    if (selectedCategories.size) {
      const categorySet = new Set(
        [...activity.categories, ...activity.tags].map(category => category.toLowerCase())
      );
      const hasCategoryMatch = [...selectedCategories].some(category => categorySet.has(category));
      if (!hasCategoryMatch) return false;
    }

    if (selectedPriceTiers.size) {
      if (!activity.priceTier || !selectedPriceTiers.has(activity.priceTier)) return false;
    }

    if (!matchesDurationFilter(activity, filters.durations)) return false;

    if (filters.minRating != null && filters.minRating > 0) {
      if ((activity.ratingAverage || 0) < filters.minRating) return false;
    }

    if (filters.availability.length && activity.source === 'provider') {
      if (!activity.bookingSupported) return false;
    }

    if (!matchesGroupFilter(activity, filters.groupTypes)) return false;

    if (selectedAccessibility.size && activity.accessibilityTags.length) {
      const accessibilitySet = toLowerSet(activity.accessibilityTags);
      const hasAccessibilityMatch = [...selectedAccessibility].some(tag => accessibilitySet.has(tag));
      if (!hasAccessibilityMatch) return false;
    }

    return true;
  });
};

const queryDbActivities = async (input: ExploreSearchInput): Promise<ExploreActivity[]> => {
  let query = supabase.from('activities').select('*').eq('status', 'active').limit(120);

  const searchTerm = input.query.trim() || input.destination?.trim() || '';
  if (searchTerm) {
    query = query.or(
      `title.ilike.%${searchTerm}%,location_city.ilike.%${searchTerm}%,location_region.ilike.%${searchTerm}%`
    );
  }

  if (input.coords) {
    const latDelta = input.radiusMeters / 111000;
    const lngDelta = input.radiusMeters / 111000;
    query = query
      .gte('location_lat', input.coords.lat - latDelta)
      .lte('location_lat', input.coords.lat + latDelta)
      .gte('location_lng', input.coords.lng - lngDelta)
      .lte('location_lng', input.coords.lng + lngDelta);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeDbActivity);
};

const queryProviderActivities = async (input: ExploreSearchInput): Promise<ExploreActivity[]> => {
  if (!input.coords) return [];

  const { data, error } = await supabase.functions.invoke('discover-places', {
    body: {
      action: 'search',
      payload: {
        coords: input.coords,
        radius: input.radiusMeters,
        searchQuery: input.query.trim() || input.destination || 'things to do',
        strictBounds: false,
      },
    },
  });

  if (error) throw error;
  const places = data?.places || [];
  return places.map(normalizeProviderActivity);
};

const dedupeActivities = (activities: ExploreActivity[]) => {
  const seen = new Set<string>();
  return activities.filter(activity => {
    const key = activity.canonicalKey || activity.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getAuthedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user.id || null;
};

const serializeFilters = (filters: ExploreFilters) => ({
  categories: filters.categories,
  priceTiers: filters.priceTiers,
  durations: filters.durations,
  availability: filters.availability,
  minRating: filters.minRating,
  groupTypes: filters.groupTypes,
  accessibility: filters.accessibility,
});

export const exploreService = {
  async search(input: ExploreSearchInput): Promise<ExploreSearchResult> {
    const dbResults = await queryDbActivities(input);
    const filteredDbResults = applyFilters(dbResults, input.filters);

    let providerResults: ExploreActivity[] = [];
    let usedProviderFallback = false;
    if (filteredDbResults.length < DB_RESULT_TARGET) {
      providerResults = applyFilters(await queryProviderActivities(input), input.filters);
      usedProviderFallback = providerResults.length > 0;
    }

    return {
      activities: dedupeActivities([...filteredDbResults, ...providerResults]),
      usedProviderFallback,
    };
  },

  async createSearchSession(filters: ExploreFilters, resultCount: number) {
    const userId = await getAuthedUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('search_sessions')
      .insert({
        user_id: userId,
        filters: serializeFilters(filters),
        result_count: resultCount,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('search session write failed:', error.message);
      return null;
    }

    return data.id;
  },

  async trackEvent(params: {
    eventName: string;
    activityId?: string | null;
    searchSessionId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const userId = await getAuthedUserId();
    if (!userId) return;

    let dbActivityId: string | null = null;
    const inputId = params.activityId;
    const isUuid = inputId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputId) : false;

    if (inputId && isUuid) {
      dbActivityId = inputId;
    } else if (inputId) {
      // Not a UUID, try to resolve from canonical_key
      const canonicalKey = inputId.startsWith('provider:') 
          ? inputId.replace('provider:', '') 
          : inputId;
          
      const { data } = await supabase
          .from('activities')
          .select('id')
          .eq('canonical_key', canonicalKey)
          .single();
      
      if (data) {
        dbActivityId = data.id;
      }
    }

    const eventMetadata = { ...(params.metadata || {}) };
    if (inputId && !dbActivityId) {
      // If we couldn't resolve a UUID, store the raw ID in metadata for audit
      eventMetadata.raw_activity_id = inputId;
    }

    const { error } = await supabase.from('activity_events').insert({
      user_id: userId,
      activity_id: dbActivityId,
      search_session_id: params.searchSessionId || null,
      event_name: params.eventName,
      metadata: eventMetadata as any,
    });

    if (error) {
      console.warn(`activity event write failed (${params.eventName}):`, error.message);
    }
  },
};
