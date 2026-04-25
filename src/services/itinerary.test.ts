jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ measurementSystem: 'us' }]),
}));

import {
  compactDaysAfterRemoval,
  computeDayConflicts,
  computeHopWarnings,
  reorderWithIndices,
  inferDistanceUnit,
} from './itinerary';
import { ItineraryDay } from '../types/itinerary';

const buildDay = (dayIndex: number, items: Partial<ItineraryDay['items'][number]>[]): ItineraryDay => ({
  dayIndex,
  items: items.map((item, index) => ({
    id: item.id || `item-${dayIndex}-${index}`,
    itineraryId: item.itineraryId || 'itinerary-1',
    activityId: item.activityId || `activity-${index}`,
    dayIndex,
    positionIndex: item.positionIndex ?? index,
    scheduledAt: null,
    narrativeWhy: null,
    title: item.title || `Stop ${index}`,
    imageUrl: null,
    category: 'Activity',
    city: 'Austin',
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    durationMinutesMin: null,
    durationMinutesMax: null,
  })),
});

describe('itineraryService helpers', () => {
  it('reorderWithIndices moves item in array', () => {
    const ordered = ['a', 'b', 'c', 'd'];
    expect(reorderWithIndices(ordered, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
    expect(reorderWithIndices(ordered, 0, 0)).toEqual(ordered);
  });

  it('detects duplicate and day-capacity conflicts', () => {
    const dayWithConflicts = buildDay(1, [
      { activityId: 'act-1' },
      { activityId: 'act-1' },
      { activityId: 'act-3' },
      { activityId: 'act-4' },
      { activityId: 'act-5' },
      { activityId: 'act-6' },
    ]);

    const conflicts = computeDayConflicts([dayWithConflicts]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].hasDuplicateActivityConflict).toBe(true);
    expect(conflicts[0].hasCapacityConflict).toBe(true);
  });

  it('computes distance warning thresholds in miles', () => {
    expect(inferDistanceUnit()).toBe('mi');

    const day = buildDay(1, [
      { id: 'a', lat: 30.2672, lng: -97.7431 },
      { id: 'b', lat: 30.35, lng: -97.7431 }, // medium+
      { id: 'c', lat: 30.78, lng: -97.7431 }, // high
    ]);

    const warnings = computeHopWarnings([day], 'mi');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some(warning => warning.severity === 'medium' || warning.severity === 'high')).toBe(true);
  });

  it('compacts day numbering after removing a middle day', () => {
    const day1 = buildDay(1, [{ activityId: 'a1' }]);
    const day2 = buildDay(2, [{ activityId: 'a2' }]);
    const day3 = buildDay(3, [{ activityId: 'a3' }]);
    const day4 = buildDay(4, [{ activityId: 'a4' }]);

    const compacted = compactDaysAfterRemoval([day1, day2, day3, day4], 2);

    expect(compacted.map(day => day.dayIndex)).toEqual([1, 2, 3]);
    expect(compacted[1].items[0].activityId).toBe('a3');
    expect(compacted[1].items[0].dayIndex).toBe(2);
    expect(compacted[2].items[0].activityId).toBe('a4');
    expect(compacted[2].items[0].dayIndex).toBe(3);
  });
});
