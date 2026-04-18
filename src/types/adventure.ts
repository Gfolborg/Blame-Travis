/**
 * Adventure Status Types
 */
export type AdventureStatus = 'draft' | 'assigned' | 'active' | 'completed' | 'missed' | 'rerolled';
export type AdventureDayStatus = 'outline' | 'hydrating' | 'ready' | 'failed';

/**
 * Itinerary Stop Type
 */
export interface ItineraryStop {
  order: number;
  day?: number;
  day_number?: number;
  place_id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  rating?: number;
  estimated_dwell_minutes?: number;
  estimated_spend?: number;
  why_travis_picked_this?: string;
}

export interface AdventureDay {
  id?: string;
  adventure_id?: string;
  day_number: number;
  status: AdventureDayStatus;
  theme_title: string;
  teaser?: string | null;
  itinerary_json: ItineraryStop[];
  alternates_json: ItineraryStop[];
  outline_json?: Array<{
    name: string;
    type?: string;
    dwell_minutes?: number;
  }> | null;
  context_json?: {
    coords: { lat: number; lng: number };
    radius: number;
    location: string;
  } | null;
  hydrated_at?: string | null;
  error_message?: string | null;
}

/**
 * Adventure Interface
 */
export interface Adventure {
  id: string;
  user_id: string;
  status: AdventureStatus;
  title: string;
  adventure_type: string;
  budget_level?: string;
  drop_date: string;
  deadline: string;
  estimated_budget?: number;
  estimated_duration_minutes?: number;
  why_travis_picked_this?: string;
  hero_image_url?: string | null;
  itinerary_json: ItineraryStop[];
  main_goal: string;
  bonus_goal?: string;
  created_at: string;
  updated_at: string;
  days?: AdventureDay[];
}
