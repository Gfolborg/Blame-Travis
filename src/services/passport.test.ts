jest.mock('./itinerary', () => ({
  itineraryService: {
    loadBuilderData: jest.fn(),
  },
}));

import {
  buildPlaceId,
  computeDistanceMeters,
  deriveDayProgress,
  derivePassportStats,
  evaluateAchievementUnlocks,
} from './passport';
import { PassportAchievement, PassportStamp } from '../types/passport';

const buildStamp = (partial: Partial<PassportStamp>): PassportStamp => ({
  id: partial.id || `stamp-${Math.random().toString(36).slice(2, 8)}`,
  userId: partial.userId || 'guest-local',
  itineraryId: partial.itineraryId ?? 'itinerary-1',
  dayIndex: partial.dayIndex ?? 1,
  activityId: partial.activityId ?? 'activity-1',
  placeId: partial.placeId || `place-${Math.random().toString(36).slice(2, 8)}`,
  canonicalKey: partial.canonicalKey ?? null,
  title: partial.title || 'Stop',
  city: partial.city ?? 'Austin',
  countryCode: partial.countryCode ?? 'US',
  lat: partial.lat ?? 30.2672,
  lng: partial.lng ?? -97.7431,
  source: 'proximity_auto',
  distanceMeters: partial.distanceMeters ?? 12,
  dayTotalStops: partial.dayTotalStops ?? 2,
  dayStampedCountAtStamp: partial.dayStampedCountAtStamp ?? 1,
  stampedAt: partial.stampedAt || new Date().toISOString(),
  createdAt: partial.createdAt || new Date().toISOString(),
});

const buildAchievement = (key: string): PassportAchievement => ({
  id: `achievement-${key}`,
  userId: 'guest-local',
  achievementKey: key,
  metadata: {},
  unlockedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

describe('passport service helpers', () => {
  it('builds stable place identity with canonical key first', () => {
    expect(
      buildPlaceId({
        canonicalKey: 'provider:abc',
        activityId: 'activity-1',
        fallbackId: 'fallback',
      }),
    ).toBe('provider:abc');
    expect(
      buildPlaceId({
        canonicalKey: '',
        activityId: 'activity-2',
        fallbackId: 'fallback',
      }),
    ).toBe('activity-2');
  });

  it('computes geodesic distance in meters', () => {
    const meters = computeDistanceMeters(
      { lat: 30.2672, lng: -97.7431 },
      { lat: 30.2679, lng: -97.742 },
    );
    expect(meters).toBeGreaterThan(50);
    expect(meters).toBeLessThan(200);
  });

  it('derives completed day progress from stamped counts', () => {
    const stamps: PassportStamp[] = [
      buildStamp({
        id: 's1',
        itineraryId: 'itinerary-1',
        dayIndex: 1,
        placeId: 'place-a',
        dayTotalStops: 2,
        dayStampedCountAtStamp: 1,
      }),
      buildStamp({
        id: 's2',
        itineraryId: 'itinerary-1',
        dayIndex: 1,
        placeId: 'place-b',
        dayTotalStops: 2,
        dayStampedCountAtStamp: 2,
      }),
    ];

    const progress = deriveDayProgress(stamps);
    expect(progress).toHaveLength(1);
    expect(progress[0].isComplete).toBe(true);
    expect(progress[0].stampedStops).toBe(2);
    expect(progress[0].totalStops).toBe(2);
  });

  it('derives passport stats for unique city and country counts', () => {
    const stamps: PassportStamp[] = [
      buildStamp({ id: 's1', placeId: 'a', city: 'Austin', countryCode: 'US' }),
      buildStamp({ id: 's2', placeId: 'b', city: 'Dallas', countryCode: 'US' }),
      buildStamp({ id: 's3', placeId: 'c', city: 'Paris', countryCode: 'FR' }),
    ];

    const stats = derivePassportStats(stamps);
    expect(stats.totalStampedStops).toBe(3);
    expect(stats.uniqueCities).toBe(3);
    expect(stats.uniqueCountries).toBe(2);
    expect(stats.homeCountryCode).toBe('US');
  });

  it('unlocks first-abroad, place, country, and completion achievements when thresholds are met', () => {
    const stamps: PassportStamp[] = [
      buildStamp({
        id: 's1',
        stampedAt: '2026-04-01T10:00:00.000Z',
        placeId: 'us-1',
        countryCode: 'US',
        dayIndex: 1,
        dayTotalStops: 1,
        dayStampedCountAtStamp: 1,
      }),
      buildStamp({
        id: 's2',
        stampedAt: '2026-04-03T10:00:00.000Z',
        placeId: 'fr-1',
        countryCode: 'FR',
        dayIndex: 2,
        dayTotalStops: 1,
        dayStampedCountAtStamp: 1,
      }),
      buildStamp({
        id: 's3',
        stampedAt: '2026-04-04T10:00:00.000Z',
        placeId: 'mx-1',
        countryCode: 'MX',
        dayIndex: 3,
        dayTotalStops: 1,
        dayStampedCountAtStamp: 1,
      }),
      buildStamp({
        id: 's4',
        stampedAt: '2026-04-05T10:00:00.000Z',
        placeId: 'ca-1',
        countryCode: 'CA',
        dayIndex: 4,
        dayTotalStops: 1,
        dayStampedCountAtStamp: 1,
      }),
      buildStamp({
        id: 's5',
        stampedAt: '2026-04-06T10:00:00.000Z',
        placeId: 'jp-1',
        countryCode: 'JP',
        dayIndex: 5,
        dayTotalStops: 1,
        dayStampedCountAtStamp: 1,
      }),
    ];

    const existing = [buildAchievement('first_stamp')];
    const unlocked = evaluateAchievementUnlocks(stamps, existing);
    const keys = unlocked.map(item => item.key);

    expect(keys).toContain('first_abroad');
    expect(keys).toContain('places_5');
    expect(keys).toContain('countries_2');
    expect(keys).toContain('countries_5');
    expect(keys).toContain('days_completed_1');
    expect(keys).toContain('days_completed_5');
  });
});
