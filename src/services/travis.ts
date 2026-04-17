import { supabase } from './supabase';

interface TravisPersonaParams {
  vibes: string;
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
        return this.getFallbackNarrative(params);
      }

      // The Edge function now returns the JSON object directly
      return data;
    } catch (error) {
      console.error('Travis Service Error:', error);
      return this.getFallbackNarrative(params);
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

  getFallbackNarrative(params: TravisPersonaParams) {
    const mainVibe = params.vibes.split(',')[0].toUpperCase();
    return {
      title: `THE ${mainVibe} CIRCUIT`,
      main_goal: `Explore the ${params.vibes} side of ${params.location}.`,
      notes: `I found a few spots that fit your ${params.budget} budget. Don't overthink it, just get out there and see what happens.`
    };
  }
};
