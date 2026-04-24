import { activitiesService } from './activities';
import { supabase } from './supabase';

jest.mock('./places', () => ({
  placesService: {
    getPlaceDetails: jest.fn(),
  },
}));

const mockActivityRow = {
  id: '8f97e6ca-6af8-4aeb-aaf8-6e8f5b248af0',
  canonical_key: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  title: 'River Walk',
  summary: 'Scenic urban trail',
  categories: ['outdoor'],
  tags: ['friends'],
  source_priority: 'google_places',
  rating_average: 4.7,
  rating_count: 22,
  duration_minutes_min: 60,
  duration_minutes_max: 120,
  pricing_tier: 'free',
  family_friendly: true,
  accessibility_tags: [],
  booking_supported: false,
  booking_deep_link: null,
  image_url: null,
  location_city: 'Austin',
  location_region: 'TX',
  location_country_code: 'US',
  location_lat: 30.2672,
  location_lng: -97.7431,
};

const createActivitiesBuilder = () => {
  let eqColumn = '';
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn((column: string) => {
      eqColumn = column;
      return builder;
    }),
    single: jest.fn(async () => {
      if (eqColumn === 'id' || eqColumn === 'canonical_key') {
        return { data: mockActivityRow, error: null };
      }
      return { data: null, error: { message: 'Not found' } };
    }),
  };
  return builder;
};

const createSavedBuilder = (savedJoinedRows: any[] = []) => {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(async () => ({ data: savedJoinedRows, error: null })),
  };
  return builder;
};

describe('activitiesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns normalized identity keys including provider alias', () => {
    const keys = activitiesService.getIdentityKeys({
      id: mockActivityRow.id,
      canonicalKey: mockActivityRow.canonical_key,
    });

    expect(keys).toContain(mockActivityRow.id);
    expect(keys).toContain(mockActivityRow.canonical_key);
    expect(keys).toContain(`provider:${mockActivityRow.canonical_key}`);
  });

  it('uses detail cache for repeated lookups', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'activities') {
        return createActivitiesBuilder();
      }
      return createSavedBuilder();
    });

    const first = await activitiesService.getActivityDetails(mockActivityRow.id);
    const second = await activitiesService.getActivityDetails(mockActivityRow.id);

    expect(first?.id).toBe(mockActivityRow.id);
    expect(second?.id).toBe(mockActivityRow.id);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('ignores null joined rows when loading saved activities', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'saved_activities') {
        return createSavedBuilder([{ activities: null }, { activities: mockActivityRow }]);
      }
      return createActivitiesBuilder();
    });

    const saved = await activitiesService.getSavedActivities();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(mockActivityRow.id);
  });
});
