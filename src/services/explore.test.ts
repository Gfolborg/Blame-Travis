import { exploreService } from './explore';
import { supabase } from './supabase';
import { ExploreFilters } from '../types/explore';

const mockActivities: any[] = [
  {
    id: '1',
    canonical_key: 'key1',
    title: 'Activity 1',
    summary: 'Summary 1',
    categories: ['Culture'],
    tags: ['Family'],
    status: 'active',
    rating_average: 4.5,
    rating_count: 10,
    duration_minutes_min: 60,
    duration_minutes_max: 120,
    pricing_tier: 'budget',
    family_friendly: true,
    location_city: 'Austin',
    location_lat: 30.2672,
    location_lng: -97.7431,
  },
  {
    id: '2',
    canonical_key: 'key2',
    title: 'Activity 2',
    summary: 'Summary 2',
    categories: ['Outdoor'],
    tags: [],
    status: 'active',
    rating_average: 3.5,
    rating_count: 5,
    duration_minutes_min: 300,
    duration_minutes_max: 400,
    pricing_tier: 'premium',
    family_friendly: false,
    location_city: 'Austin',
    location_lat: 30.3,
    location_lng: -97.8,
  },
  {
    id: '3',
    canonical_key: 'key3',
    title: 'Live Music Night',
    summary: 'Great for groups',
    categories: ['night_club'],
    tags: ['friends'],
    status: 'active',
    rating_average: 4.2,
    rating_count: 15,
    duration_minutes_min: 90,
    duration_minutes_max: 180,
    pricing_tier: 'mid',
    family_friendly: false,
    location_city: 'Austin',
    location_lat: 30.26,
    location_lng: -97.74,
  },
];

describe('exploreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('returns filtered results from DB', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) =>
          callback({ data: mockActivities, error: null })
        ),
      });

      const filters: ExploreFilters = {
        categories: ['Culture'],
        priceTiers: [],
        durations: [],
        availability: [],
        minRating: null,
        groupTypes: [],
        accessibility: [],
      };

      const result = await exploreService.search({
        query: '',
        destination: 'Austin',
        nearMe: false,
        coords: null,
        radiusMeters: 8000,
        filters,
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].title).toBe('Activity 1');
      expect(result.usedProviderFallback).toBe(false);
    });

    it('falls back to provider if DB results are low', async () => {
      // DB returns only 1 result (target is 12)
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) =>
          callback({ data: [mockActivities[0]], error: null })
        ),
      });

      // Provider returns another result
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          places: [
            {
              id: 'p1',
              displayName: { text: 'Provider Activity' },
              rating: 4.8,
              location: { latitude: 30.27, longitude: -97.75 },
            },
          ],
        },
        error: null,
      });

      const filters: ExploreFilters = {
        categories: [],
        priceTiers: [],
        durations: [],
        availability: [],
        minRating: null,
        groupTypes: [],
        accessibility: [],
      };

      const result = await exploreService.search({
        query: '',
        destination: 'Austin',
        nearMe: true,
        coords: { lat: 30.2672, lng: -97.7431 },
        radiusMeters: 8000,
        filters,
      });

      expect(result.activities.length).toBeGreaterThan(1);
      expect(result.usedProviderFallback).toBe(true);
    });
  });

  describe('filtering logic', () => {
    const defaultFilters: ExploreFilters = {
      categories: [],
      priceTiers: [],
      durations: [],
      availability: [],
      minRating: null,
      groupTypes: [],
      accessibility: [],
    };

    it('filters by category', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) =>
          callback({ data: mockActivities, error: null })
        ),
      });

      const result = await exploreService.search({
        query: '',
        destination: 'Austin',
        nearMe: false,
        coords: null,
        radiusMeters: 8000,
        filters: { ...defaultFilters, categories: ['Outdoor'] },
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].title).toBe('Activity 2');
    });

    it('filters by rating', async () => {
        (supabase.from as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          then: jest.fn().mockImplementation((callback) =>
            callback({ data: mockActivities, error: null })
          ),
        });
  
        const result = await exploreService.search({
          query: '',
          destination: 'Austin',
          nearMe: false,
          coords: null,
          radiusMeters: 8000,
          filters: { ...defaultFilters, minRating: 4.0 },
        });

        expect(result.activities).toHaveLength(2);
        expect(result.activities.map((a) => a.title).sort()).toEqual(['Activity 1', 'Live Music Night']);
      });

    it('filters by duration', async () => {
        (supabase.from as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          then: jest.fn().mockImplementation((callback) =>
            callback({ data: mockActivities, error: null })
          ),
        });
  
        // Activity 1 is 60-120 mins (bucket '60_180')
        // Activity 2 is 300-400 mins (bucket '181_360' or 'gt360')
        
        const result = await exploreService.search({
          query: '',
          destination: 'Austin',
          nearMe: false,
          coords: null,
          radiusMeters: 8000,
          filters: { ...defaultFilters, durations: ['60_180'] },
        });

        expect(result.activities).toHaveLength(2);
        expect(result.activities.map((a) => a.title).sort()).toEqual(['Activity 1', 'Live Music Night']);
    });

    it('filters by group type', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) =>
          callback({ data: mockActivities, error: null })
        ),
      });

      const result = await exploreService.search({
        query: '',
        destination: 'Austin',
        nearMe: false,
        coords: null,
        radiusMeters: 8000,
        filters: { ...defaultFilters, groupTypes: ['friends'] },
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].title).toBe('Live Music Night');
    });
  });
});
