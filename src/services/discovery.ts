import { Adventure, AdventureDay, ItineraryStop } from '../types/adventure';
import { supabase } from './supabase';
import { travisService } from './travis';
import { weatherService } from './weather';
import { fetchAdventureById, getCurrentTripDay } from './adventureData';

export interface DiscoveryParams {
  coords: { lat: number; lng: number };
  radius: number;
  days: number;
  intensity: string;
  budget: string;
  roamingMode: 'strict' | 'roam';
  maxActivities: number;
  relaxationLevel: number;
}

interface BlueprintSlot {
  name: string;
  type?: string;
  dwell_minutes?: number;
}

interface BlueprintDay {
  day: number;
  slots?: BlueprintSlot[];
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const GUEST_ID = '00000000-0000-0000-0000-000000000000';
const INITIAL_HYDRATION_WINDOW = 3;
const FORWARD_PREFETCH_DAYS = 2;
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const buildFallbackTeaser = (dayNumber: number) =>
  `Day ${dayNumber} is roughed in. Travis will stamp the exact stops as this part of the itinerary gets closer.`;

const buildThemeTitle = (dayNumber: number, slots: BlueprintSlot[]) => {
  const lead = slots[0]?.name;
  return lead ? `DAY ${dayNumber}: ${lead.toUpperCase()}` : `DAY ${dayNumber}`;
};

const uniqueByPlaceId = (stops: ItineraryStop[]) => {
  const seen = new Set<string>();
  return stops.filter(stop => {
    if (!stop.place_id || seen.has(stop.place_id)) return false;
    seen.add(stop.place_id);
    return true;
  });
};

const buildAlternateStop = (place: any, dayNumber: number, order: number): ItineraryStop => ({
  place_id: place.id,
  name: place.displayName?.text || 'Alternate Stop',
  lat: Number(place.location?.latitude || 0),
  lng: Number(place.location?.longitude || 0),
  rating: place.rating,
  category: String(place.primaryType || 'establishment').toUpperCase(),
  day: dayNumber,
  day_number: dayNumber,
  order,
  estimated_dwell_minutes: 90,
  estimated_spend: 0,
});

const extractSearchResults = async (params: {
  coords: { lat: number; lng: number };
  radius: number;
  query: string;
}) => {
  const { data } = await supabase.functions.invoke('discover-places', {
    body: {
      action: 'search',
      payload: {
        coords: params.coords,
        radius: params.radius,
        searchQuery: params.query,
        strictBounds: false,
      },
    },
  });

  return data?.places || [];
};

const hydrateDayFromOutline = async (params: {
  adventureId: string;
  dayNumber: number;
  slots: BlueprintSlot[];
  context: { coords: { lat: number; lng: number }; radius: number; location: string };
  adventureMeta: { intensity: string; budget: string };
  usedPlaceIds: Set<string>;
  themeTitle?: string;
  teaser?: string | null;
}): Promise<AdventureDay> => {
  const verifiedStops: ItineraryStop[] = [];
  const alternates: ItineraryStop[] = [];

  for (let index = 0; index < params.slots.length; index += 1) {
    const slot = params.slots[index];
    const searchResults = await extractSearchResults({
      coords: params.context.coords,
      radius: params.context.radius,
      query: `${slot.name} in ${params.context.location}`,
    });

    const primary = searchResults.find((place: any) => !params.usedPlaceIds.has(place.id));
    if (!primary) {
      continue;
    }

    params.usedPlaceIds.add(primary.id);

    verifiedStops.push({
      place_id: primary.id,
      name: primary.displayName?.text || slot.name,
      lat: Number(primary.location?.latitude || params.context.coords.lat),
      lng: Number(primary.location?.longitude || params.context.coords.lng),
      rating: primary.rating,
      category: String(primary.primaryType || slot.type || 'establishment').toUpperCase(),
      day: params.dayNumber,
      day_number: params.dayNumber,
      order: index + 1,
      estimated_dwell_minutes: slot.dwell_minutes || 120,
      estimated_spend: 0,
    });

    for (const candidate of searchResults) {
      if (alternates.length >= 3) break;
      if (!candidate?.id || params.usedPlaceIds.has(candidate.id) || candidate.id === primary.id) continue;
      params.usedPlaceIds.add(candidate.id);
      alternates.push(buildAlternateStop(candidate, params.dayNumber, alternates.length + 1));
    }
  }

  if (!verifiedStops.length) {
    return {
      adventure_id: params.adventureId,
      day_number: params.dayNumber,
      status: 'failed',
      theme_title: params.themeTitle || buildThemeTitle(params.dayNumber, params.slots),
      teaser: params.teaser || buildFallbackTeaser(params.dayNumber),
      itinerary_json: [],
      alternates_json: [],
      outline_json: params.slots,
      context_json: params.context,
      hydrated_at: null,
      error_message: 'Travis could not confirm real stops for this day yet.',
    };
  }

  const narrative = await travisService.generateJourneyNarrative({
    intensity: params.adventureMeta.intensity,
    location: params.context.location,
    budget: params.adventureMeta.budget,
    stops: verifiedStops.map(stop => stop.name),
    days: 1,
    isRoamer: false,
  });

  const stopsWithInsights = verifiedStops.map((stop, index) => ({
    ...stop,
    why_travis_picked_this: narrative?.stop_insights?.[index] || 'A sharp pick for this leg of the itinerary.',
  }));

  return {
    adventure_id: params.adventureId,
    day_number: params.dayNumber,
    status: 'ready',
    theme_title: params.themeTitle || buildThemeTitle(params.dayNumber, params.slots),
    teaser: narrative?.why_travis_picked_this || params.teaser || buildFallbackTeaser(params.dayNumber),
    itinerary_json: stopsWithInsights,
    alternates_json: uniqueByPlaceId(alternates),
    outline_json: params.slots,
    context_json: params.context,
    hydrated_at: new Date().toISOString(),
    error_message: null,
  };
};

const createOutlineDays = (
  adventureId: string,
  blueprint: BlueprintDay[],
  context: { coords: { lat: number; lng: number }; radius: number; location: string }
): AdventureDay[] =>
  blueprint.map(dayPlan => ({
    adventure_id: adventureId,
    day_number: dayPlan.day,
    status: 'outline',
    theme_title: buildThemeTitle(dayPlan.day, dayPlan.slots || []),
    teaser: buildFallbackTeaser(dayPlan.day),
    itinerary_json: [],
    alternates_json: [],
    outline_json: dayPlan.slots || [],
    context_json: context,
    hydrated_at: null,
    error_message: null,
  }));

export const discoveryService = {
  async fetchRandomHub(): Promise<{ name: string; lat: number; lng: number }> {
    try {
      const { count } = await supabase.from('global_hubs').select('*', { count: 'exact', head: true });
      const randomIndex = Math.floor(Math.random() * (count || 1));
      const { data: randomHub } = await supabase
        .from('global_hubs')
        .select('name, latitude, longitude')
        .range(randomIndex, randomIndex)
        .single();
      return { name: randomHub?.name || 'Tokyo', lat: randomHub?.latitude || 35.6762, lng: randomHub?.longitude || 139.6503 };
    } catch {
      return { name: 'Tokyo', lat: 35.6762, lng: 139.6503 };
    }
  },

  async autocomplete(input: string): Promise<any[]> {
    if (!input || input.length < 3) return [];
    try {
      const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY || '',
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify({ input, includedPrimaryTypes: ['(cities)'] }),
      });
      const data = await response.json();
      return data?.suggestions || [];
    } catch {
      return [];
    }
  },

  async geocode(query: string, placeId?: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = placeId ? `${PLACES_API_BASE}/places/${placeId}` : `${PLACES_API_BASE}/places:searchText`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY || '',
        'X-Goog-FieldMask': placeId ? 'location' : 'places.location',
      };
      const response = await fetch(url, {
        method: placeId ? 'GET' : 'POST',
        headers,
        ...(placeId ? {} : { body: JSON.stringify({ textQuery: query }) }),
      });
      const data = await response.json();
      const location = placeId ? data.location : data.places?.[0]?.location;
      return location ? { lat: location.latitude, lng: location.longitude } : null;
    } catch {
      return null;
    }
  },

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.results?.[0]?.formatted_address || 'this area';
    } catch {
      return 'this area';
    }
  },

  async fetchRealStops(
    coords: { lat: number; lng: number },
    category: string,
    _duration: string,
    _budget: string
  ): Promise<ItineraryStop[]> {
    const searchResults = await extractSearchResults({
      coords,
      radius: 10000,
      query: `best ${category.toLowerCase()} near this area`,
    });

    return uniqueByPlaceId(
      searchResults.slice(0, 6).map((place: any, index: number) => ({
        place_id: place.id,
        name: place.displayName?.text || 'Alternate Stop',
        lat: Number(place.location?.latitude || coords.lat),
        lng: Number(place.location?.longitude || coords.lng),
        rating: place.rating,
        category: String(place.primaryType || category || 'establishment').toUpperCase(),
        order: index + 1,
        day: 1,
        day_number: 1,
        estimated_dwell_minutes: 90,
        estimated_spend: 0,
      }))
    );
  },

  async hydrateAdventureDays(adventureId: string, dayNumbers: number[]): Promise<Adventure | null> {
    const uniqueDays = Array.from(new Set(dayNumbers)).sort((a, b) => a - b);
    if (!uniqueDays.length) return fetchAdventureById(adventureId);

    const adventure = await fetchAdventureById(adventureId);
    if (!adventure?.days?.length) return adventure;

    const targetDays = adventure.days.filter(day => uniqueDays.includes(day.day_number));
    if (!targetDays.length) return adventure;

    const usedPlaceIds = new Set<string>(
      adventure.days
        .filter(day => !uniqueDays.includes(day.day_number))
        .flatMap(day => day.itinerary_json.map(stop => stop.place_id))
    );

    const updatedDays: AdventureDay[] = [];
    for (const day of targetDays) {
      const hydratedDay = await hydrateDayFromOutline({
        adventureId,
        dayNumber: day.day_number,
        slots: day.outline_json || [],
        context: (day.context_json as any) || {
          coords: { lat: 0, lng: 0 },
          radius: 5000,
          location: 'this area',
        },
        adventureMeta: {
          intensity: adventure.adventure_type || 'balanced',
          budget: adventure.budget_level || 'mid',
        },
        usedPlaceIds,
        themeTitle: day.theme_title,
        teaser: day.teaser,
      });
      updatedDays.push(hydratedDay);
    }

    try {
      const { error } = await supabase.from('adventure_days').upsert(
        updatedDays.map(day => ({
          adventure_id: adventureId,
          day_number: day.day_number,
          status: day.status,
          theme_title: day.theme_title,
          teaser: day.teaser,
          itinerary_json: day.itinerary_json as any,
          alternates_json: day.alternates_json as any,
          outline_json: day.outline_json as any,
          context_json: day.context_json as any,
          hydrated_at: day.hydrated_at,
          error_message: day.error_message,
        })),
        { onConflict: 'adventure_id,day_number' }
      );

      if (error && !MISSING_TABLE_CODES.has(error.code || '')) throw error;
    } catch (error) {
      console.warn('Adventure day hydration persistence skipped:', error);
    }

    const flatReadyStops = updatedDays
      .filter(day => day.status === 'ready')
      .flatMap(day => day.itinerary_json);

    if (flatReadyStops.length) {
      await supabase
        .from('adventures')
        .update({ itinerary_json: flatReadyStops as any })
        .eq('id', adventureId);
    }

    return fetchAdventureById(adventureId);
  },

  async ensureHydrationWindow(adventure: Adventure): Promise<Adventure | null> {
    if (!adventure.days?.length) return adventure;

    const currentDay = getCurrentTripDay(adventure);
    const targetDays = adventure.days
      .filter(day => day.day_number >= currentDay && day.day_number <= currentDay + FORWARD_PREFETCH_DAYS)
      .filter(day => day.status === 'outline' || day.status === 'failed')
      .map(day => day.day_number);

    if (!targetDays.length) return adventure;
    return this.hydrateAdventureDays(adventure.id, targetDays);
  },

  async generateAdventure(params: DiscoveryParams): Promise<Adventure> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || GUEST_ID;

    console.log('--- STARTING TRI-STAGE DISCOVERY PIPELINE ---');
    const totalDays = params.days;
    const initialCity = await this.reverseGeocode(params.coords.lat, params.coords.lng);

    let weatherSummary = 'Unknown';
    try {
      const forecast = await weatherService.getDailyForecast(params.coords.lat, params.coords.lng);
      weatherSummary = forecast?.[0]?.weatherCondition?.description?.text || 'Clear';
    } catch (e) {
      console.warn('Weather lookup skipped:', e);
    }

    console.log('[STAGE 1] Travis Strategist is brainstorming...');
    const { searchQueries } = await supabase.functions
      .invoke('travis-narrative', {
        body: { action: 'generate-strategy', ...params, location: initialCity, weather: weatherSummary },
      })
      .then(res => res.data);

    console.log(`[STAGE 2] Scouting ${searchQueries.length} vibes via Foursquare...`);
    const candidatePool: any[] = [];
    const usedFsIds = new Set<string>();

    const scoutRequests = searchQueries.map((query: string) =>
      supabase.functions.invoke('discover-places', {
        body: { action: 'curate-foursquare', payload: { coords: params.coords, radius: params.radius, query } },
      })
    );

    const scoutResults = await Promise.all(scoutRequests);
    for (const { data } of scoutResults) {
      if (!data?.results) continue;
      data.results.forEach((result: any) => {
        if (usedFsIds.has(result.fsq_id)) return;
        candidatePool.push({
          name: result.name,
          category: result.categories?.[0]?.name || 'Establishment',
          fsq_id: result.fsq_id,
          description: result.description || '',
        });
        usedFsIds.add(result.fsq_id);
      });
    }

    if (candidatePool.length === 0) {
      console.log('[STAGE 2] Foursquare returned zero candidates. Falling back to Google Scout...');
      const googleScout = await Promise.all(
        searchQueries.map((query: string) =>
          supabase.functions.invoke('discover-places', {
            body: {
              action: 'search',
              payload: {
                coords: params.coords,
                searchQuery: `${query} in ${initialCity}`,
                radius: params.radius,
              },
            },
          })
        )
      );

      googleScout.forEach(({ data }) => {
        if (!data?.places) return;
        data.places.forEach((place: any) => {
          if (usedFsIds.has(place.id)) return;
          candidatePool.push({
            name: place.displayName?.text || 'Unknown',
            category: (place.primaryType || 'establishment').toUpperCase(),
            fsq_id: place.id,
            description: '',
          });
          usedFsIds.add(place.id);
        });
      });
    }

    console.log(`[STAGE 3] Travis Editor is curating ${candidatePool.length} candidates...`);
    const { blueprint } = await supabase.functions
      .invoke('travis-narrative', {
        body: { action: 'select-and-sequence', ...params, location: initialCity, candidates: candidatePool.slice(0, 50) },
      })
      .then(res => res.data);

    const normalizedBlueprint: BlueprintDay[] = (blueprint || []).map((dayPlan: any, index: number) => ({
      day: Number(dayPlan.day || index + 1),
      slots: Array.isArray(dayPlan.slots) ? dayPlan.slots : [],
    }));

    if (!normalizedBlueprint.length) {
      throw new Error("Travis couldn't map the itinerary structure. Try a different area.");
    }

    const initialOutlineStops = normalizedBlueprint
      .slice(0, Math.min(totalDays, INITIAL_HYDRATION_WINDOW))
      .flatMap(dayPlan => (dayPlan.slots || []).map((slot, index) => `${dayPlan.day}.${index + 1} ${slot.name}`));

    console.log('[NARRATIVE] Travis is reviewing the trip structure...');
    const narrative = await travisService.generateJourneyNarrative({
      ...params,
      location: initialCity,
      stops: initialOutlineStops,
      days: totalDays,
      isRoamer: params.roamingMode === 'roam',
    });

    const dummyStart = new Date().toISOString();
    const dummyEnd = new Date(Date.now() + totalDays * 86400000).toISOString();

    const { data: insertedAdventure, error: insertError } = await supabase
      .from('adventures')
      .insert({
        user_id: userId,
        status: 'draft',
        title: narrative?.title || 'NEW ADVENTURE',
        adventure_type: params.intensity,
        budget_level: params.budget,
        drop_date: dummyStart,
        deadline: dummyEnd,
        itinerary_json: [],
        main_goal: narrative?.main_goal || 'Explore.',
        bonus_goal: narrative?.bonus_goal || '',
        why_travis_picked_this: narrative?.why_travis_picked_this || '',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const adventureId = insertedAdventure.id;
    const dayContext = {
      coords: params.coords,
      radius: params.radius,
      location: initialCity,
    };

    const outlineDays = createOutlineDays(adventureId, normalizedBlueprint, dayContext);
    const usedPlaceIds = new Set<string>();
    const hydratedDays: AdventureDay[] = [];

    for (const dayPlan of normalizedBlueprint.slice(0, Math.min(totalDays, INITIAL_HYDRATION_WINDOW))) {
      hydratedDays.push(
        await hydrateDayFromOutline({
          adventureId,
          dayNumber: dayPlan.day,
          slots: dayPlan.slots || [],
          context: dayContext,
          adventureMeta: {
            intensity: params.intensity,
            budget: params.budget,
          },
          usedPlaceIds,
        })
      );
    }

    const mergedDays = outlineDays.map(outlineDay => hydratedDays.find(day => day.day_number === outlineDay.day_number) || outlineDay);
    const initialReadyStops = mergedDays.filter(day => day.status === 'ready').flatMap(day => day.itinerary_json);

    await supabase
      .from('adventures')
      .update({ itinerary_json: initialReadyStops as any })
      .eq('id', adventureId);

    try {
      const { error: dayInsertError } = await supabase.from('adventure_days').upsert(
        mergedDays.map(day => ({
          adventure_id: adventureId,
          day_number: day.day_number,
          status: day.status,
          theme_title: day.theme_title,
          teaser: day.teaser,
          itinerary_json: day.itinerary_json as any,
          alternates_json: day.alternates_json as any,
          outline_json: day.outline_json as any,
          context_json: day.context_json as any,
          hydrated_at: day.hydrated_at,
          error_message: day.error_message,
        })),
        { onConflict: 'adventure_id,day_number' }
      );

      if (dayInsertError && !MISSING_TABLE_CODES.has(dayInsertError.code || '')) {
        throw dayInsertError;
      }
    } catch (error) {
      console.warn('Adventure day persistence skipped:', error);
    }

    console.log('[STAGE 5] Travis is painting the briefing background...');
    try {
      await supabase.functions.invoke('generate-journey-image', {
        body: {
          title: narrative?.title,
          location: initialCity,
          adventureId,
          goal: narrative?.main_goal,
          intensity: params.intensity,
        },
      });
    } catch (e) {
      console.warn('[IMAGE ERROR] Travis missed a stroke (non-critical):', e);
    }

    console.log('[PIPELINE] Stamped and returning.');
    const hydratedAdventure = await fetchAdventureById(adventureId);
    return hydratedAdventure || ({ ...(insertedAdventure as any), itinerary_json: initialReadyStops, days: mergedDays } as Adventure);
  },
};
