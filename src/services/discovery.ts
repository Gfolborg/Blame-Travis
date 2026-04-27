import { Adventure, AdventureDay, ItineraryStop } from '../types/adventure';
import { placesService } from './places';
import { supabase } from './supabase';
import { travisService } from './travis';
import { fetchAdventureById, getCurrentTripDay } from './adventureData';

export interface DiscoveryParams {
  coords: { lat: number; lng: number };
  radius: number;
  days: number;
  intensity: string;
  budget: string;
  roamingMode: 'strict' | 'roam';
  maxActivities: number;
  relaxationLevel?: number;
}

interface BlueprintSlot {
  name: string;
  type?: string;
  fsq_id?: string;
  dwell_minutes?: number;
}

interface BlueprintDay {
  day: number;
  slots?: BlueprintSlot[];
}

const GOOGLE_MAPS_PUBLIC_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const IS_DEV_RUNTIME =
  typeof globalThis !== 'undefined' &&
  (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ === true;
const CLIENT_DISCOVERY_FALLBACK_ENABLED =
  IS_DEV_RUNTIME || process.env.EXPO_PUBLIC_ENABLE_CLIENT_DISCOVERY_FALLBACK === 'true';
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

const hasPlaceId = (value: unknown): value is { place_id?: string } =>
  typeof value === 'object' && value !== null && 'place_id' in value;

const canUseClientDiscoveryFallback = () =>
  CLIENT_DISCOVERY_FALLBACK_ENABLED && GOOGLE_MAPS_PUBLIC_KEY.length > 0;

const fetchAutocompleteViaClient = async (input: string): Promise<any[]> => {
  const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_PUBLIC_KEY,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
    },
    body: JSON.stringify({
      input,
      includedPrimaryTypes: ['(cities)'],
    }),
  });
  const data = await response.json();
  return data?.suggestions || [];
};

const fetchGeocodeViaClient = async (
  query: string,
  placeId?: string,
): Promise<{ lat: number; lng: number } | null> => {
  const url = placeId ? `${PLACES_API_BASE}/places/${placeId}` : `${PLACES_API_BASE}/places:searchText`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_PUBLIC_KEY,
    'X-Goog-FieldMask': placeId ? 'location' : 'places.location',
  };
  const response = await fetch(url, {
    method: placeId ? 'GET' : 'POST',
    headers,
    ...(placeId ? {} : { body: JSON.stringify({ textQuery: query }) }),
  });
  const data = await response.json();
  const location = placeId ? data?.location : data?.places?.[0]?.location;
  return location ? { lat: location.latitude, lng: location.longitude } : null;
};

const fetchReverseGeocodeViaClient = async (lat: number, lng: number): Promise<string> => {
  const url = `${GEOCODING_API_BASE}?latlng=${lat},${lng}&result_type=locality&key=${GOOGLE_MAPS_PUBLIC_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return data?.results?.[0]?.formatted_address || 'this area';
};

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
    let richData: any = null;

    // OPTION 1: ID-FIRST HYDRATION (PREFERRED)
    if (slot.fsq_id) {
      console.log(`[HYDRATE] Fetching rich details for: ${slot.name} (${slot.fsq_id})`);
      const isGoogleId = !slot.fsq_id.includes('-'); // Foursquare IDs are usually hex-hyphen-hex
      
      const { data } = await supabase.functions.invoke('discover-places', {
        body: {
          action: isGoogleId ? 'get-place-details' : 'get-foursquare-details',
          payload: { fsq_id: slot.fsq_id, placeId: slot.fsq_id }
        }
      });
      richData = data;
    }

    // OPTION 2: SEARCH FALLBACK
    if (!richData) {
      const searchResults = await extractSearchResults({
        coords: params.context.coords,
        radius: params.context.radius,
        query: `${slot.name} in ${params.context.location}`,
      });
      richData = searchResults.find((place: any) => !params.usedPlaceIds.has(place.id));
    }

    if (!richData) continue;

    const placeId = richData.id || richData.fsq_id;
    params.usedPlaceIds.add(placeId);

    // Format Image URL (Handle FS vs Google formats)
    let imageUrl = '';
    if (richData.photos?.[0]) {
      const p = richData.photos[0];
      if (p.prefix && p.suffix) {
        // Foursquare format
        imageUrl = `${p.prefix}original${p.suffix}`;
      } else if (p.name) {
        imageUrl = placesService.getPhotoUri(p.name, 400);
      }
    }

    verifiedStops.push({
      place_id: placeId,
      name: richData.displayName?.text || richData.name || slot.name,
      lat: Number(richData.location?.latitude || richData.geocodes?.main?.latitude || params.context.coords.lat),
      lng: Number(richData.location?.longitude || richData.geocodes?.main?.longitude || params.context.coords.lng),
      rating: richData.rating ? (richData.rating > 5 ? richData.rating / 2 : richData.rating) : 4.0,
      category: String(richData.primaryType || richData.categories?.[0]?.name || slot.type || 'establishment').toUpperCase(),
      day: params.dayNumber,
      day_number: params.dayNumber,
      order: index + 1,
      estimated_dwell_minutes: slot.dwell_minutes || 120,
      estimated_spend: 0,
      image_url: imageUrl,
      price_level: richData.price ? '$'.repeat(richData.price) : (richData.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '$' : richData.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$' : '$$'),
    });
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
      const { data, error } = await supabase.functions.invoke('discover-places', {
        body: {
          action: 'autocomplete-cities',
          payload: { input },
        },
      });
      const suggestions = data?.suggestions || [];
      if (!error && suggestions.length > 0) {
        return suggestions;
      }
      if (!canUseClientDiscoveryFallback()) {
        return suggestions;
      }
      return await fetchAutocompleteViaClient(input);
    } catch {
      if (canUseClientDiscoveryFallback()) {
        try {
          return await fetchAutocompleteViaClient(input);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  async geocode(query: string, placeId?: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('discover-places', {
        body: {
          action: 'geocode',
          payload: { query, placeId },
        },
      });
      if (error && !canUseClientDiscoveryFallback()) return null;
      const location = data?.location || data?.places?.[0]?.location;
      if (location) return { lat: location.latitude, lng: location.longitude };
      if (!canUseClientDiscoveryFallback()) return null;
      return await fetchGeocodeViaClient(query, placeId);
    } catch {
      if (canUseClientDiscoveryFallback()) {
        try {
          return await fetchGeocodeViaClient(query, placeId);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('discover-places', {
        body: {
          action: 'reverse-geocode-locality',
          payload: { lat, lng },
        },
      });
      if (!error) {
        const formatted = data?.formatted_address || data?.formattedAddress;
        if (formatted) {
          return formatted;
        }
      }
      if (!canUseClientDiscoveryFallback()) return 'this area';
      return await fetchReverseGeocodeViaClient(lat, lng);
    } catch {
      if (canUseClientDiscoveryFallback()) {
        try {
          return await fetchReverseGeocodeViaClient(lat, lng);
        } catch {
          return 'this area';
        }
      }
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

  async searchNearbyFood(coords: { lat: number; lng: number }, radius: number = 2000): Promise<ItineraryStop[]> {
    console.log(`[DISCOVERY] Searching for food near ${coords.lat}, ${coords.lng} using Foursquare...`);
    
    try {
      const { data } = await supabase.functions.invoke('discover-places', {
        body: {
          action: 'search-food-foursquare',
          payload: { coords, radius, query: 'restaurants, cafes' },
        },
      });

      const results = data?.results || [];
      
      // FALLBACK: If Foursquare returns nothing (very remote or overseas gap), try Google
      if (results.length === 0) {
        console.log('[DISCOVERY] Foursquare returned zero results. Engaging Google Fallback...');
        const googleData = await extractSearchResults({
          coords,
          radius: 5000,
          query: 'restaurants and cafes near me',
        });

        return googleData.map((p: any, idx: number) => ({
          place_id: p.id,
          name: p.displayName?.text || 'Local Spot',
          lat: p.location?.latitude || coords.lat,
          lng: p.location?.longitude || coords.lng,
          rating: p.rating || 4.0,
          category: 'FOOD',
          day_number: 1,
          order: idx + 1,
          estimated_dwell_minutes: 60,
          why_travis_picked_this: "I had to check the satellites, but this spot looks reliable.",
        }));
      }

      return results.map((r: any, idx: number) => {
        let imageUrl = '';
        if (r.photos?.[0]) {
          const photo = r.photos[0];
          if (photo.prefix && photo.suffix) {
            imageUrl = `${photo.prefix}original${photo.suffix}`;
          } else if (photo.name) {
            imageUrl = placesService.getPhotoUri(photo.name, 400);
          }
        }
        const priceString = r.price ? '$'.repeat(r.price) : '$$';

        return {
          place_id: r.fsq_id,
          name: r.name,
          lat: r.geocodes?.main?.latitude || coords.lat,
          lng: r.geocodes?.main?.longitude || coords.lng,
          rating: r.rating ? r.rating / 2 : 4.0,
          category: (r.categories?.[0]?.name || 'FOOD').toUpperCase(),
          day_number: 1,
          order: idx + 1,
          estimated_dwell_minutes: 60,
          image_url: imageUrl,
          price_level: priceString,
          why_travis_picked_this: "I noticed you were looking a bit peckish. This spot is solid.",
        };
      });
    } catch (e) {
      console.error('[DISCOVERY] Search failed:', e);
      return [];
    }
  },

  async injectStopIntoItinerary(adventureId: string, stop: ItineraryStop): Promise<boolean> {
    try {
      // 1. Update master adventure itinerary (legacy compatibility/flat view)
      const { data: adventure } = await supabase
        .from('adventures')
        .select('itinerary_json')
        .eq('id', adventureId)
        .single();

      if (!adventure) return false;

      const currentItinerary = Array.isArray(adventure.itinerary_json) ? adventure.itinerary_json : [];
      const updatedItinerary = [...currentItinerary, { ...stop, order: currentItinerary.length + 1 }];

      const { error: masterError } = await supabase
        .from('adventures')
        .update({ itinerary_json: updatedItinerary as any })
        .eq('id', adventureId);

      if (masterError) throw masterError;

      // 2. Update specific day in adventure_days (Desk view source of truth)
      // For now, we'll assume we are adding to the currently active day or Day 1 if ambiguous
      const { data: dayData } = await supabase
        .from('adventure_days')
        .select('itinerary_json')
        .eq('adventure_id', adventureId)
        .eq('day_number', stop.day_number || 1)
        .single();

      if (dayData) {
        const dayItinerary = Array.isArray(dayData.itinerary_json) ? dayData.itinerary_json : [];
        const updatedDayItinerary = [...dayItinerary, { ...stop, order: dayItinerary.length + 1 }];
        
        await supabase
          .from('adventure_days')
          .update({ itinerary_json: updatedDayItinerary as any })
          .eq('adventure_id', adventureId)
          .eq('day_number', stop.day_number || 1);
      }

      return true;
    } catch (e) {
      console.error('[DISCOVERY] Failed to inject stop:', e);
      return false;
    }
  },

  async removeStopFromItinerary(adventureId: string, stopId: string, dayNumber: number): Promise<boolean> {
    try {
      // 1. Update master adventure itinerary
      const { data: adventure } = await supabase
        .from('adventures')
        .select('itinerary_json')
        .eq('id', adventureId)
        .single();

      if (adventure) {
        const currentItinerary = Array.isArray(adventure.itinerary_json) ? adventure.itinerary_json : [];
        const updatedItinerary = currentItinerary.filter(item => !hasPlaceId(item) || item.place_id !== stopId);
        
        await supabase
          .from('adventures')
          .update({ itinerary_json: updatedItinerary as any })
          .eq('id', adventureId);
      }

      // 2. Update individual day
      const { data: dayData } = await supabase
        .from('adventure_days')
        .select('itinerary_json')
        .eq('adventure_id', adventureId)
        .eq('day_number', dayNumber)
        .single();

      if (dayData) {
        const dayItinerary = Array.isArray(dayData.itinerary_json) ? dayData.itinerary_json : [];
        const updatedDayItinerary = dayItinerary.filter(item => !hasPlaceId(item) || item.place_id !== stopId);
        
        await supabase
          .from('adventure_days')
          .update({ itinerary_json: updatedDayItinerary as any })
          .eq('adventure_id', adventureId)
          .eq('day_number', dayNumber);
      }

      return true;
    } catch (e) {
      console.error('[DISCOVERY] Failed to remove stop:', e);
      return false;
    }
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

    console.log('--- [V2.1] TRI-STAGE DISCOVERY PIPELINE ---');
    const totalDays = params.days;
    const initialCity = await this.reverseGeocode(params.coords.lat, params.coords.lng);

    console.log('[STAGE 1] Travis Strategist is brainstorming...');
    const { searchQueries } = await supabase.functions
      .invoke('travis-narrative', {
        body: { 
          action: 'generate-strategy', 
          location: initialCity 
        },
      })
      .then(res => res.data);

    console.log('[STAGE 1] Search Strategy (Raw):', JSON.stringify(searchQueries));

    // HARD GUARDRAIL: PRODUCTION-GRADE SANITIZATION (V2.2 - NOUN-FIRST)
    const BANNED_WORDS = [
      'cafe', 'restaurant', 'food', 'brunch', 'bakery', 'kitchen', 'grill', 'bistro', 'dining', 'bar', 'coffee', 'tea',
      'historic', 'vintage', 'artsy', 'cozy', 'hidden', 'local', 'independent', 'boutique', 'seaside', 'coastal', 'g Gulf',
      'gilded', 'age', 'mansion', 'tour', 'stroll', 'crawl', 'viewpoint', 'spot', 'district', 'heritage'
    ];
    
    const cleanedQueries: Array<{ label: string; confidence: string }> = (searchQueries || [])
      .slice(0, 7)
      .map((q: any): { label: string; confidence: string } => {
        const rawLabel = typeof q === 'string' ? q : q.label;
        const confidence = String(q.confidence || 'medium');
        
        // 1. Scrub commas and split
        const words = rawLabel.replace(/,/g, '').split(' ');
        
        // 2. Filter out AI Fluff and Food
        const filtered = words.filter((word: string) => !BANNED_WORDS.includes(word.toLowerCase()));
        
        // 3. NOUN-FIRST: Take the LAST 2 words (usually the actual category)
        const label = filtered.slice(-2).join(' ');
        const finalLabel = label.length > 2 ? label : `Landmark`;
        
        return { label: finalLabel, confidence };
      });

    console.log(
      '[STAGE 1] Search Strategy (Cleaned):',
      cleanedQueries.map((q: { label: string; confidence: string }) => `${q.label} (${q.confidence})`).join(', ')
    );

    console.log(`[STAGE 2] Scouting all ${cleanedQueries.length} categories via single Edge Batch...`);
    const candidatePool: any[] = [];
    const usedFsIds = new Set<string>();

    const { data: batchData } = await supabase.functions.invoke('discover-places', {
      body: { 
        action: 'curate-foursquare', 
        payload: { 
          coords: params.coords, 
          radius: params.radius, 
          queries: cleanedQueries.map((q: { label: string }) => q.label)
        } 
      },
    });

    if (batchData?.results) {
      batchData.results.forEach((result: any) => {
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
        body: { 
          action: 'select-and-sequence', 
          ...params, 
          location: initialCity, 
          candidates: candidatePool.slice(0, 40),
          maxActivities: params.maxActivities
        },
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

    if (user?.id) {
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
    } else {
      console.log('[STAGE 5] Skipping hero generation for guest flow (auth required).');
    }

    console.log('[PIPELINE] Stamped and returning.');
    const hydratedAdventure = await fetchAdventureById(adventureId);
    return hydratedAdventure || ({ ...(insertedAdventure as any), itinerary_json: initialReadyStops, days: mergedDays } as Adventure);
  },
};
