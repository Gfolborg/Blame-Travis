/**
 * Adventure Status Types
 */
export type AdventureStatus = 'draft' | 'assigned' | 'active' | 'completed' | 'missed' | 'rerolled';

/**
 * Itinerary Stop Type
 */
export interface ItineraryStop {
  order: number;
  day?: number;
  place_id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  estimated_dwell_minutes?: number;
  estimated_spend?: number;
  why_travis_picked_this?: string;
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
}
