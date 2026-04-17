import * as Location from 'expo-location';
import { ItineraryStop, Adventure } from '../types/adventure';
import { supabase } from './supabase';
import { travisService } from './travis';
import { weatherService } from './weather';

interface DiscoveryParams {
  location?: string;
  coords?: { lat: number; lng: number };
  radius?: number;
  duration: string;
  vibe: string;
  budget: string;
  date?: Date;
}

const VIBE_TO_TYPES: Record<string, string[]> = {
  food: ['restaurant', 'cafe', 'bakery', 'bar'],
  nature: ['park', 'campground', 'zoo', 'aquarium'],
  culture: ['museum', 'art_gallery', 'tourist_attraction', 'library'],
  adventure: ['amusement_park', 'hiking_area', 'national_park', 'stadium'],
  beach: ['beach', 'park', 'tourist_attraction'],
  mountain: ['hiking_area', 'national_park', 'campground'],
  nightlife: ['night_club', 'bar', 'casino', 'bowling_alley'],
  chill: ['spa', 'park', 'library', 'book_store'],
  active: ['gym', 'stadium', 'sports_complex', 'hiking_area'],
};

const BUDGET_TO_PRICE: Record<string, string[]> = {
  low: ['PRICE_LEVEL_INEXPENSIVE'],
  mid: ['PRICE_LEVEL_MODERATE'],
  high: ['PRICE_LEVEL_EXPENSIVE'],
  travis: ['PRICE_LEVEL_VERY_EXPENSIVE'],
};

export const discoveryService = {
  async generateAdventure(params: DiscoveryParams): Promise<Adventure> {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    console.log('--- GENERATING ADVENTURE ---');
    console.log('Params:', params);

    // 1. Determine Coordinates & Radius
    const coords = params.coords || await this.getCoordinates(params.location || 'current');
    const radius = params.radius || (params.location === 'brave' ? 50000.0 : 10000.0);
    const locationName = params.location || `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;
    
    console.log('Final Coordinates:', coords, 'Radius:', radius);
    
    // 2. Fetch Candidate Stops
    const stops = await this.fetchStopsViaEdge(coords, params.vibe, params.duration, params.budget, radius);
    console.log(`Found ${stops.length} stops.`);
    
    if (stops.length === 0) {
      throw new Error('NO_STOPS_FOUND: Travis couldn\'t find anything great in this area yet.');
    }

    // 3. Get Weather
    let weatherContext = '';
    try {
      const weather = await weatherService.getCurrentWeather(coords.lat, coords.lng);
      weatherContext = `${weather.temperature.degrees}°${weather.temperature.unit}, ${weather.weatherCondition.description.text}`;
      console.log('Weather Context:', weatherContext);
    } catch (e) {
      console.log('Weather lookup failed, proceeding.');
    }

    // 4. Generate Narrative
    console.log('Requesting AI Narrative...');
    const narrative = await travisService.generateJourneyNarrative({
      vibes: params.vibe,
      location: locationName,
      budget: params.budget,
      stops: stops.map(s => s.name),
      weather: weatherContext,
    });

    const stopsWithInsights = stops.map((s, i) => ({
      ...s,
      why_travis_picked_this: narrative.stop_insights?.[i] || '',
    }));

    // 5. Package and Save
    const adventure = this.packageAdventure(params, stopsWithInsights, userId, narrative);
    
    const { data, error } = await supabase
      .from('adventures')
      .insert({ ...adventure, hero_image_url: null } as any)
      .select()
      .single();

    if (error) {
      console.error('Supabase Save Error:', error);
      throw error;
    }

    // 6. Generate Hero Image (Synchronous - wait for it so the UI is ready)
    try {
      console.log('--- TRIGGERING IMAGE GENERATION ---');
      const { data: imageRes, error: invokeError } = await supabase.functions.invoke('generate-journey-image', {
        body: { 
          title: narrative.title, 
          location: locationName, 
          adventureId: data.id,
          goal: narrative.main_goal,
          stops: stops.map(s => s.name).slice(0, 3)
        }
      });
      
      if (invokeError) {
        console.error('Edge Function Invoke Error (image-gen):', invokeError);
      } else {
        console.log('Edge Function Response (image-gen):', imageRes);
        if (imageRes?.publicUrl) {
          data.hero_image_url = imageRes.publicUrl;
        }
      }
    } catch (e) {
      console.error('Background image generation failed (client-side catch):', e);
    }

    console.log('Adventure Stamped and Saved:', data.id);
    return data as unknown as Adventure;
  },

  async getCoordinates(location: string): Promise<{ lat: number; lng: number }> {
    if (location === 'current' || location === 'brave') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('GPS_DENIED: Travis needs your location.');
      }
      const currentPos = await Location.getCurrentPositionAsync({});
      return { lat: currentPos.coords.latitude, lng: currentPos.coords.longitude };
    }

    if (location === 'surprise' || location === 'worldwide') {
      const globalHubs = [
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { name: 'Paris', lat: 48.8566, lng: 2.3522 },
        { name: 'New York', lat: 40.7128, lng: -74.0060 },
      ];
      const city = globalHubs[Math.floor(Math.random() * globalHubs.length)];
      return { lat: city.lat, lng: city.lng };
    }

    console.log(`Invoking discover-places:geocode for query: ${location}`);
    const { data, error } = await supabase.functions.invoke('discover-places', {
      body: { action: 'geocode', payload: { query: location } }
    });

    if (error) {
      console.error('Edge Function Geocode Call Failed:', error);
      throw new Error(`EDGE_FUNCTION_ERROR: ${error.message}`);
    }

    if (!data?.places?.[0]?.location) {
      console.error('Geocode returned invalid format:', data);
      throw new Error(`CITY_NOT_FOUND: ${location}`);
    }

    return { 
      lat: data.places[0].location.latitude, 
      lng: data.places[0].location.longitude 
    };
  },

  async fetchStopsViaEdge(
    coords: { lat: number; lng: number },
    vibeStr: string,
    duration: string,
    budget: string,
    radius: number
  ): Promise<ItineraryStop[]> {
    const vibes = vibeStr.split(',');
    const priceLevels = BUDGET_TO_PRICE[budget] || ['PRICE_LEVEL_MODERATE'];
    const targetCount = duration === '1_day' ? 3 : duration === 'weekend' ? 6 : 10;
    
    let allStops: ItineraryStop[] = [];
    
    const vibeRequests = vibes.map(v => {
      const type = VIBE_TO_TYPES[v]?.[0] || 'tourist_attraction';
      return supabase.functions.invoke('discover-places', {
        body: { 
          action: 'search', 
          payload: { 
            coords, 
            vibe: v, 
            type, 
            radius, 
            targetCount: Math.ceil(targetCount / vibes.length), 
            priceLevels 
          } 
        }
      });
    });

    const results = await Promise.all(vibeRequests);

    results.forEach((res, index) => {
      if (res.data?.places) {
        res.data.places.forEach((p: any) => {
          allStops.push({
            order: 0,
            place_id: p.id,
            name: p.displayName.text,
            category: vibes[index],
            lat: p.location.latitude,
            lng: p.location.longitude,
            estimated_dwell_minutes: 60,
            estimated_spend: 0,
          });
        });
      }
    });

    const uniqueStops = Array.from(new Map(allStops.map(s => [s.place_id, s])).values());
    return uniqueStops
      .sort(() => 0.5 - Math.random())
      .slice(0, targetCount)
      .map((s, i) => {
        const totalDays = duration === '1_day' ? 1 : duration === 'weekend' ? 3 : 7;
        const day = Math.floor(i / (targetCount / totalDays)) + 1;
        const spend = budget === 'low' ? 15 : budget === 'mid' ? 45 : budget === 'high' ? 120 : 300;
        
        return { 
          ...s, 
          order: i + 1,
          day: Math.min(day, totalDays),
          estimated_spend: spend 
        };
      });
  },

  async fetchRealStops(
    coords: { lat: number; lng: number },
    vibe: string,
    duration: string,
    budget: string,
  ): Promise<ItineraryStop[]> {
    return this.fetchStopsViaEdge(coords, vibe, duration, budget, 10000.0);
  },

  packageAdventure(
    params: DiscoveryParams, 
    stops: ItineraryStop[], 
    userId: string, 
    narrative: { title: string; main_goal: string; bonus_goal: string; why_travis_picked_this: string }
  ): Adventure {
    const now = new Date();
    return {
      id: Math.random().toString(36).substr(2, 9),
      user_id: userId,
      status: 'draft',
      title: narrative.title,
      adventure_type: params.vibe,
      budget_level: params.budget,
      drop_date: now.toISOString(),
      deadline: now.toISOString(),
      itinerary_json: stops,
      main_goal: narrative.main_goal,
      bonus_goal: narrative.bonus_goal,
      why_travis_picked_this: narrative.why_travis_picked_this,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }
};
