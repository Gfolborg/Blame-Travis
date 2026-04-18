import { supabase } from './supabase';
import { Adventure, AdventureDay, AdventureDayStatus, ItineraryStop } from '../types/adventure';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const normalizeStop = (stop: any, fallbackDay?: number): ItineraryStop => ({
  order: Number(stop?.order || 1),
  day: Number(stop?.day || stop?.day_number || fallbackDay || 1),
  day_number: Number(stop?.day_number || stop?.day || fallbackDay || 1),
  place_id: String(stop?.place_id || ''),
  name: String(stop?.name || 'Unknown Stop'),
  category: String(stop?.category || 'SPOT'),
  lat: Number(stop?.lat || 0),
  lng: Number(stop?.lng || 0),
  estimated_dwell_minutes: Number(stop?.estimated_dwell_minutes || 120),
  estimated_spend: Number(stop?.estimated_spend || 0),
  why_travis_picked_this: stop?.why_travis_picked_this ? String(stop.why_travis_picked_this) : undefined,
});

const normalizeStops = (value: any, fallbackDay?: number): ItineraryStop[] => {
  if (!Array.isArray(value)) return [];
  return value.map(stop => normalizeStop(stop, fallbackDay));
};

const buildDayTitle = (dayNumber: number, stops: ItineraryStop[]) => {
  if (!stops.length) return `DAY ${dayNumber}`;
  const leadName = stops[0]?.name?.toUpperCase();
  return leadName ? `DAY ${dayNumber}: ${leadName}` : `DAY ${dayNumber}`;
};

export const buildLegacyDays = (adventure: Adventure): AdventureDay[] => {
  const groupedStops = new Map<number, ItineraryStop[]>();
  normalizeStops(adventure.itinerary_json).forEach(stop => {
    const dayNumber = stop.day || stop.day_number || 1;
    const existing = groupedStops.get(dayNumber) || [];
    existing.push({ ...stop, day: dayNumber, day_number: dayNumber });
    groupedStops.set(dayNumber, existing);
  });

  return Array.from(groupedStops.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, stops]) => ({
      adventure_id: adventure.id,
      day_number: dayNumber,
      status: 'ready',
      theme_title: buildDayTitle(dayNumber, stops),
      teaser: 'This day is already stamped and ready to go.',
      itinerary_json: stops.sort((a, b) => a.order - b.order),
      alternates_json: [],
      outline_json: stops.map(stop => ({
        name: stop.name,
        type: stop.category,
        dwell_minutes: stop.estimated_dwell_minutes,
      })),
      context_json: stops[0]
        ? {
            coords: { lat: stops[0].lat, lng: stops[0].lng },
            radius: 5000,
            location: 'current area',
          }
        : null,
    }));
};

const normalizeDayStatus = (status: unknown): AdventureDayStatus => {
  if (status === 'outline' || status === 'hydrating' || status === 'ready' || status === 'failed') {
    return status;
  }
  return 'outline';
};

const normalizeDay = (row: any): AdventureDay => ({
  id: row.id,
  adventure_id: row.adventure_id,
  day_number: Number(row.day_number),
  status: normalizeDayStatus(row.status),
  theme_title: String(row.theme_title || `DAY ${row.day_number}`),
  teaser: row.teaser ? String(row.teaser) : null,
  itinerary_json: normalizeStops(row.itinerary_json, Number(row.day_number)),
  alternates_json: normalizeStops(row.alternates_json, Number(row.day_number)),
  outline_json: Array.isArray(row.outline_json) ? row.outline_json : [],
  context_json: row.context_json ?? null,
  hydrated_at: row.hydrated_at ?? null,
  error_message: row.error_message ?? null,
});

export const flattenReadyStops = (days: AdventureDay[]): ItineraryStop[] =>
  days
    .slice()
    .sort((a, b) => a.day_number - b.day_number)
    .flatMap(day =>
      day.itinerary_json
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(stop => ({ ...stop, day: day.day_number, day_number: day.day_number }))
    );

const attachDays = (adventure: Adventure, days: AdventureDay[]): Adventure => ({
  ...adventure,
  days,
  itinerary_json: flattenReadyStops(days),
});

export const fetchAdventureDays = async (adventureId: string): Promise<AdventureDay[] | null> => {
  const { data, error } = await supabase
    .from('adventure_days')
    .select('*')
    .eq('adventure_id', adventureId)
    .order('day_number', { ascending: true });

  if (error) {
    if (MISSING_TABLE_CODES.has(error.code || '')) {
      return null;
    }
    throw error;
  }

  return (data || []).map(normalizeDay);
};

export const fetchAdventureById = async (adventureId: string): Promise<Adventure | null> => {
  const { data, error } = await supabase
    .from('adventures')
    .select('*')
    .eq('id', adventureId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const baseAdventure = data as unknown as Adventure;
  const dayRows = await fetchAdventureDays(adventureId);
  const days = dayRows && dayRows.length ? dayRows : buildLegacyDays(baseAdventure);
  return attachDays(baseAdventure, days);
};

export const fetchCurrentAdventureForUser = async (userId: string): Promise<Adventure | null> => {
  const { data, error } = await supabase
    .from('adventures')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['assigned', 'active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  if (!data) return null;
  const baseAdventure = data as unknown as Adventure;
  const dayRows = await fetchAdventureDays(baseAdventure.id);
  const days = dayRows && dayRows.length ? dayRows : buildLegacyDays(baseAdventure);
  return attachDays(baseAdventure, days);
};

export const getCurrentTripDay = (adventure: Adventure | null): number => {
  if (!adventure) return 1;
  if (adventure.status !== 'active') return 1;

  const startDate = new Date(adventure.drop_date);
  const today = new Date();
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;
  const maxDay = adventure.days?.length || 1;
  return Math.min(Math.max(diff, 1), maxDay);
};

export type DeskTripPhase = 'draft' | 'today' | 'next_up' | 'idle';

const getDateOnly = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getDeskTripPhase = (adventure: Adventure | null): DeskTripPhase => {
  if (!adventure) return 'idle';
  if (adventure.status === 'draft') return 'draft';
  if (adventure.status !== 'active') return 'idle';

  const startDate = getDateOnly(adventure.drop_date);
  const today = getDateOnly(new Date().toISOString());
  return startDate.getTime() > today.getTime() ? 'next_up' : 'today';
};

export const getDeskPrimaryDay = (adventure: Adventure | null): AdventureDay | null => {
  if (!adventure?.days?.length) return null;

  const sortedDays = adventure.days.slice().sort((a, b) => a.day_number - b.day_number);
  const phase = getDeskTripPhase(adventure);

  if (phase === 'draft' || phase === 'next_up') {
    return sortedDays[0];
  }

  const currentDay = getCurrentTripDay(adventure);
  return sortedDays.find(day => day.day_number === currentDay) || sortedDays[0];
};

export const getDeskUpcomingStatus = (adventure: Adventure | null): string => {
  if (!adventure?.days?.length) {
    return 'Nothing is stamped yet.';
  }

  const primaryDay = getDeskPrimaryDay(adventure);
  if (!primaryDay) {
    return 'Nothing is stamped yet.';
  }

  const sortedDays = adventure.days.slice().sort((a, b) => a.day_number - b.day_number);
  const nextDay = sortedDays.find(day => day.day_number === primaryDay.day_number + 1);

  if (!nextDay) {
    return primaryDay.status === 'ready'
      ? 'The rest of the route is already in hand.'
      : 'Travis is still tightening the route.';
  }

  if (nextDay.status === 'ready') {
    return `Day ${nextDay.day_number} is ready when you are.`;
  }

  if (nextDay.status === 'failed') {
    return `Day ${nextDay.day_number} hit static. Travis needs another pass.`;
  }

  if (nextDay.status === 'hydrating') {
    return `Day ${nextDay.day_number} is being stamped now.`;
  }

  return `Day ${nextDay.day_number} is still being stamped.`;
};
