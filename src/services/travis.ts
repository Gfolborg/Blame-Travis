import { supabase } from './supabase';

interface TravisPersonaParams {
  vibes: string;
  location: string;
  budget: string;
  stops: string[];
  weather?: string;
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

      if (data.error) {
        console.error('OpenRouter Error from Edge:', data.error);
        return this.getFallbackNarrative(params);
      }

      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Travis Service Error:', error);
      return this.getFallbackNarrative(params);
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
