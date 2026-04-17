import * as Location from 'expo-location';
import { ItineraryStop, Adventure } from '../types/adventure';
import { supabase } from './supabase';
import { travisService } from './travis';
import { weatherService } from './weather';

interface DiscoveryParams {
  coords?: { lat: number; lng: number };
  radius?: number;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  vibe: string;
  budget: string;
  roamingMode: 'strict' | 'roam';
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
  async fetchRandomHub(): Promise<{ name: string; lat: number; lng: number }> {
    try {
      const { count } = await supabase.from('global_hubs').select('*', { count: 'exact', head: true });
      const randomIndex = Math.floor(Math.random() * (count || 1));
      
      const { data: randomHub, error: fetchError } = await supabase
        .from('global_hubs')
        .select('name, latitude, longitude')
        .range(randomIndex, randomIndex)
        .single();

      if (fetchError || !randomHub) throw fetchError || new Error('No hubs found');

      return {
        name: randomHub.name,
        lat: randomHub.latitude,
        lng: randomHub.longitude
      };
    } catch (e) {
      console.error('Failed to fetch random hub from Supabase:', e);
      return { name: 'Tokyo', lat: 35.6762, lng: 139.6503 };
    }
  },

  async generateAdventure(params: DiscoveryParams): Promise<Adventure> {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    console.log('--- STARTING DISCOVERY PIPELINE ---');
    console.log('User Params:', params);

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    console.log(`Calculating for ${totalDays} days.`);
    
    // 1. Determine Starting Coordinates & Radius
    const startCoords = params.coords || { lat: 37.78825, lng: -122.4324 };
    const baseRadius = params.radius || 10000.0;
    
    let anchors: Array<{ lat: number; lng: number; dayStart: number; dayEnd: number; name: string }> = [];

    // 2. Plot Anchors (Strategic City Picking)
    if (params.roamingMode === 'roam' && totalDays > 1) {
      console.log(`[ROAMER] Requesting Travis to plan anchors for ${totalDays} days...`);
      anchors = await travisService.planRegionalAnchors(startCoords, totalDays);
      console.log(`[ROAMER] Travis picked ${anchors.length} anchors:`, anchors.map(a => a.name).join(' -> '));
    } else {
      console.log('[BASE CAMP] Sticking to user-defined coordinates.');
      anchors = [{ ...startCoords, dayStart: 1, dayEnd: totalDays, name: 'Starting Point' }];
    }

    // 3. Fetch Stops for each Anchor (Tactical Place Discovery)
    let allStops: ItineraryStop[] = [];
    for (const anchor of anchors) {
      const isTransit = (anchor as any).type === 'transit';
      const daysInAnchor = anchor.dayEnd - anchor.dayStart + 1;
      
      // Transit days only get 1-2 stops (roadside gems), 
      // Explore days get 3 standard stops per day.
      const targetStops = isTransit ? 1 : daysInAnchor * 3;
      const searchRadius = isTransit ? 50000.0 : baseRadius; // Broaden search for transit

      console.log(`[SCOUTING] Exploring area around ${anchor.name} (${(anchor as any).type || 'explore'}) for ${targetStops} stops...`);
      
      const stops = await this.fetchStopsViaEdge(
        { lat: anchor.lat, lng: anchor.lng },
        params.vibe,
        targetStops,
        params.budget,
        searchRadius,
        params.roamingMode === 'strict'
      );

      console.log(`[SCOUTING] Found ${stops.length} candidates near ${anchor.name}.`);

      // Assign days correctly to stops
      const anchoredStops = stops.map((s, i) => {
        const stopsPerDay = isTransit ? 1 : 3;
        const dayOffset = Math.floor(i / stopsPerDay);
        return {
          ...s,
          day: Math.min(anchor.dayEnd, anchor.dayStart + dayOffset)
        };
      });

      allStops = [...allStops, ...anchoredStops];
    }

    if (allStops.length === 0) {
      console.error('[ERROR] Discovery chain returned 0 results.');
      throw new Error('NO_STOPS_FOUND: Travis couldn\'t find anything great in this area.');
    }

    console.log(`--- TOTAL STOPS DISCOVERED: ${allStops.length} ---`);

    // 4. Generate Narrative & Insights (Storytelling)
    console.log('[NARRATIVE] Travis is reviewing the results and writing the briefing...');
    const narrative = await travisService.generateJourneyNarrative({
      vibes: params.vibe,
      location: anchors[0].name,
      budget: params.budget,
      stops: allStops.map(s => s.name),
      days: totalDays,
      isRoamer: params.roamingMode === 'roam'
    });

    const stopsWithInsights = allStops.map((s, i) => ({
      ...s,
      why_travis_picked_this: narrative.stop_insights?.[i] || '',
    }));

    // 5. Package and Save to Database
    const adventureData: Partial<Adventure> = {
      user_id: userId,
      status: 'draft',
      title: narrative.title,
      adventure_type: params.vibe,
      budget_level: params.budget,
      drop_date: params.startDate,
      deadline: params.endDate,
      itinerary_json: stopsWithInsights,
      main_goal: narrative.main_goal,
      bonus_goal: narrative.bonus_goal,
      why_travis_picked_this: narrative.why_travis_picked_this,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('[DB] Stamping the adventure into the vault...');
    const { data, error } = await supabase
      .from('adventures')
      .insert(adventureData as any)
      .select()
      .single();

    if (error) {
      console.error('[DB ERROR] Failed to save adventure:', error);
      throw error;
    }

    // 6. Generate Hero Image (Async - triggers in background)
    console.log('[IMAGE] Triggering background painting...');
    supabase.functions.invoke('generate-journey-image', {
      body: { 
        title: narrative.title, 
        location: anchors[0].name, 
        adventureId: data.id,
        goal: narrative.main_goal,
        stops: allStops.map(s => s.name).slice(0, 3)
      }
    });

    console.log('--- PIPELINE COMPLETE ---');
    return data as unknown as Adventure;
  },

  async fetchStopsViaEdge(
    coords: { lat: number; lng: number },
    vibeStr: string,
    targetCount: number,
    budget: string,
    radius: number,
    strictBounds: boolean
  ): Promise<ItineraryStop[]> {
    const vibes = vibeStr.split(',');
    const priceLevels = BUDGET_TO_PRICE[budget] || ['PRICE_LEVEL_MODERATE'];
    
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
            targetCount: Math.ceil(targetCount / vibes.length) + 2, 
            priceLevels,
            strictBounds
          } 
        }
      });
    });

    const results = await Promise.all(vibeRequests);

    results.forEach((res, index) => {
      if (res.error) {
        console.warn(`[PLACE ERROR] Search failed for vibe ${vibes[index]}:`, res.error);
        return;
      }
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
    
    // Sort and limit
    return uniqueStops
      .sort(() => 0.5 - Math.random())
      .slice(0, targetCount)
      .map((s, i) => ({ 
        ...s, 
        order: i + 1,
      }));
  },
};
