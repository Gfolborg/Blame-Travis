import { supabase } from './supabase';

interface TravisPersonaParams {
  intensity: string;
  location: string;
  budget: string;
  stops: string[];
  weather?: string;
  days: number;
  isRoamer: boolean;
}

export const travisService = {
  async generateJourneyNarrative(params: TravisPersonaParams) {
    try {
      const { data, error } = await supabase.functions.invoke('travis-narrative', {
        body: params
      });

      if (error) {
        console.error('Travis Edge Function Error:', error);
        return this.getFallbackNarrative({ ...params, vibes: params.intensity });
      }

      // The Edge function now returns the JSON object directly
      return data;
    } catch (error) {
      console.error('Travis Service Error:', error);
      return this.getFallbackNarrative({ ...params, vibes: params.intensity });
    }
  },

  async generateScoutQueries(params: {
    intensity: string;
    location: string;
    budget: string;
    weather?: string;
    relaxationLevel?: number;
    radius?: number;
  }): Promise<{ activityQueries: string[]; foodQueries: string[]; nearbyCity?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('travis-narrative', {
        body: {
          action: 'generate-scout-queries',
          ...params
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Scout Query Generation Error:', error);
      // Fallback queries if AI fails
      return {
        activityQueries: ['top tourist attraction', 'scenic landmark', 'local museum'],
        foodQueries: ['highly rated restaurant', 'popular cafe']
      };
    }
  },

  async planRegionalAnchors(start: { lat: number; lng: number }, days: number): Promise<Array<{ lat: number; lng: number; dayStart: number; dayEnd: number; name: string }>> {
    try {
      const { data, error } = await supabase.functions.invoke('travis-narrative', {
        body: {
          action: 'plan-anchors',
          start,
          days
        }
      });

      if (error || !data?.anchors) {
        console.warn('Anchor planning failed, staying put.', error);
        return [{ ...start, dayStart: 1, dayEnd: days, name: 'Starting Point' }];
      }

      return data.anchors;
    } catch (e) {
      return [{ ...start, dayStart: 1, dayEnd: days, name: 'Starting Point' }];
    }
  },

  async planItineraryStructure(params: any): Promise<any[]> {
    try {
      const { data, error } = await supabase.functions.invoke('travis-narrative', {
        body: { 
          action: 'plan-structure', 
          ...params
        }
      });
      if (error) throw error;
      return data?.blueprint || [];
    } catch (e) {
      console.error('Itinerary structure planning failed:', e);
      // Basic static fallback if AI fails
      return Array.from({ length: params.days }, (_, i) => ({
        day: i + 1,
        type: 'explore',
        slots: ['activity', 'food', 'activity']
      }));
    }
  },

  getFallbackNarrative(params: any) {
    const label = (params.intensity || params.vibes || 'BALANCED').toString();
    return {
      title: `THE ${label.toUpperCase()} CIRCUIT`,
      main_goal: `Complete this ${label} journey in ${params.location}.`,
      bonus_goal: "Don't get lost.",
      why_travis_picked_this: "I looked at the map and this seemed like the only way to save your weekend.",
      stop_insights: params.stops.map(() => "A solid choice for this itinerary."),
      notes: `I found a few spots that fit your ${params.budget} budget. Don't overthink it, just get out there and see what happens.`
    };
  }
};
