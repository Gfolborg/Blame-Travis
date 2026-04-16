import { supabase } from './supabase';

export interface WeatherData {
  temperature: {
    degrees: number;
    unit: string;
  };
  weatherCondition: {
    iconBaseUri: string;
    description: {
      text: string;
    };
  };
  // Add other fields as needed based on API response
}

export const weatherService = {
  /**
   * Fetches current weather for a location.
   */
  async getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { lat, lng, type: 'current' }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  },

  /**
   * Fetches daily forecast for a location.
   */
  async getDailyForecast(lat: number, lng: number) {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { lat, lng, type: 'daily' }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching daily forecast:', error);
      throw error;
    }
  }
};
