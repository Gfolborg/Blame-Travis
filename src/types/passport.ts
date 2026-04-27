export type PassportStampSource = 'proximity_auto';

export type PassportLocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PassportStamp {
  id: string;
  userId: string;
  itineraryId: string | null;
  dayIndex: number;
  activityId: string | null;
  placeId: string;
  canonicalKey: string | null;
  title: string;
  city: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  source: PassportStampSource;
  distanceMeters: number | null;
  dayTotalStops: number | null;
  dayStampedCountAtStamp: number | null;
  stampedAt: string;
  createdAt: string;
}

export interface PassportAchievement {
  id: string;
  userId: string;
  achievementKey: string;
  metadata: Record<string, unknown>;
  unlockedAt: string;
  createdAt: string;
}

export interface PassportAchievementDefinition {
  key: string;
  title: string;
  description: string;
  group: 'journey' | 'places' | 'countries' | 'completion';
  threshold?: number;
}

export interface PassportStats {
  totalStampedStops: number;
  uniqueCities: number;
  uniqueCountries: number;
  completedDayCount: number;
  homeCountryCode: string | null;
  firstStampAt: string | null;
  lastStampAt: string | null;
}

export interface PassportDayProgress {
  itineraryId: string | null;
  dayIndex: number;
  totalStops: number;
  stampedStops: number;
  isComplete: boolean;
}

export interface PassportSnapshot {
  stamps: PassportStamp[];
  achievements: PassportAchievement[];
  stats: PassportStats;
  dayProgress: PassportDayProgress[];
  offline: boolean;
  offlineSavedAt: string | null;
  permissionStatus: PassportLocationPermissionStatus;
}

export interface AutoStampCandidate {
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
  distanceMeters: number;
  dayTotalStops: number;
}

export interface AutoStampResult {
  didStamp: boolean;
  stamp: PassportStamp | null;
  unlocked: PassportAchievementDefinition[];
  reason?: 'already_stamped' | 'persist_failed';
}
