import { Enums, Tables } from './database';

export type ActivitySource = 'db' | 'provider';
export type ExplorePriceTier = Enums<'activity_price_tier'>;
export type GroupType = 'solo' | 'couple' | 'family' | 'friends';
export type DurationBucket = 'lt60' | '60_180' | '181_360' | 'gt360';
export type AvailabilityBucket = 'today' | 'this_week' | 'weekend';
export type ViewMode = 'list' | 'map';

export interface ExploreActivity {
  id: string;
  canonicalKey: string;
  title: string;
  summary: string | null;
  categories: string[];
  tags: string[];
  source: ActivitySource;
  provider: Enums<'activity_source'> | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  durationMinutesMin: number | null;
  durationMinutesMax: number | null;
  priceTier: ExplorePriceTier | null;
  familyFriendly: boolean | null;
  accessibilityTags: string[];
  bookingSupported: boolean;
  bookingDeepLink: string | null;
  imageUrl: string | null;
  imageUrls?: string[];
  city: string | null;
  region: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ExploreFilters {
  categories: string[];
  priceTiers: ExplorePriceTier[];
  durations: DurationBucket[];
  availability: AvailabilityBucket[];
  minRating: number | null;
  groupTypes: GroupType[];
  accessibility: string[];
}

export interface ExploreSearchInput {
  query: string;
  destination: string | null;
  nearMe: boolean;
  coords: { lat: number; lng: number } | null;
  radiusMeters: number;
  filters: ExploreFilters;
  pageSize?: number;
  cursor?: number;
}

export interface ExploreSearchResult {
  activities: ExploreActivity[];
  usedProviderFallback: boolean;
  nextCursor?: number | null;
  hasMore?: boolean;
}

export type ActivityRow = Tables<'activities'>;

export const DEFAULT_FILTERS: ExploreFilters = {
  categories: [],
  priceTiers: [],
  durations: [],
  availability: [],
  minRating: null,
  groupTypes: [],
  accessibility: [],
};

export const MAX_MULTI_SELECT = 3;
