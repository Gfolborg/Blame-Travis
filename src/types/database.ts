/* eslint-disable no-unused-vars */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          accessibility_tags: string[] | null
          booking_deep_link: string | null
          booking_supported: boolean | null
          canonical_key: string
          categories: string[] | null
          created_at: string
          duration_minutes_max: number | null
          duration_minutes_min: number | null
          family_friendly: boolean | null
          id: string
          image_url: string | null
          location_address_line: string | null
          location_city: string | null
          location_country_code: string | null
          location_lat: number | null
          location_lng: number | null
          location_region: string | null
          location_timezone: string | null
          pricing_currency: string | null
          pricing_from_minor: number | null
          pricing_is_free: boolean | null
          pricing_tier:
            | Database["public"]["Enums"]["activity_price_tier"]
            | null
          pricing_to_minor: number | null
          rating_average: number | null
          rating_count: number | null
          review_provider: Database["public"]["Enums"]["activity_source"] | null
          source_priority: Database["public"]["Enums"]["activity_source"]
          status: Database["public"]["Enums"]["activity_status"]
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          accessibility_tags?: string[] | null
          booking_deep_link?: string | null
          booking_supported?: boolean | null
          canonical_key: string
          categories?: string[] | null
          created_at?: string
          duration_minutes_max?: number | null
          duration_minutes_min?: number | null
          family_friendly?: boolean | null
          id?: string
          image_url?: string | null
          location_address_line?: string | null
          location_city?: string | null
          location_country_code?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_region?: string | null
          location_timezone?: string | null
          pricing_currency?: string | null
          pricing_from_minor?: number | null
          pricing_is_free?: boolean | null
          pricing_tier?:
            | Database["public"]["Enums"]["activity_price_tier"]
            | null
          pricing_to_minor?: number | null
          rating_average?: number | null
          rating_count?: number | null
          review_provider?:
            | Database["public"]["Enums"]["activity_source"]
            | null
          source_priority?: Database["public"]["Enums"]["activity_source"]
          status?: Database["public"]["Enums"]["activity_status"]
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          accessibility_tags?: string[] | null
          booking_deep_link?: string | null
          booking_supported?: boolean | null
          canonical_key?: string
          categories?: string[] | null
          created_at?: string
          duration_minutes_max?: number | null
          duration_minutes_min?: number | null
          family_friendly?: boolean | null
          id?: string
          image_url?: string | null
          location_address_line?: string | null
          location_city?: string | null
          location_country_code?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_region?: string | null
          location_timezone?: string | null
          pricing_currency?: string | null
          pricing_from_minor?: number | null
          pricing_is_free?: boolean | null
          pricing_tier?:
            | Database["public"]["Enums"]["activity_price_tier"]
            | null
          pricing_to_minor?: number | null
          rating_average?: number | null
          rating_count?: number | null
          review_provider?:
            | Database["public"]["Enums"]["activity_source"]
            | null
          source_priority?: Database["public"]["Enums"]["activity_source"]
          status?: Database["public"]["Enums"]["activity_status"]
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          activity_id: string | null
          event_name: string
          id: string
          metadata: Json | null
          occurred_at: string
          search_session_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_id?: string | null
          event_name: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          search_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_id?: string | null
          event_name?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          search_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_search_session_id_fkey"
            columns: ["search_session_id"]
            isOneToOne: false
            referencedRelation: "search_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_provider_refs: {
        Row: {
          activity_id: string
          id: string
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["activity_source"]
          provider_ref: string
          raw_data: Json | null
        }
        Insert: {
          activity_id: string
          id?: string
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["activity_source"]
          provider_ref: string
          raw_data?: Json | null
        }
        Update: {
          activity_id?: string
          id?: string
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["activity_source"]
          provider_ref?: string
          raw_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_provider_refs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_sources: {
        Row: {
          api_base_url: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: Database["public"]["Enums"]["activity_source"]
        }
        Insert: {
          api_base_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: Database["public"]["Enums"]["activity_source"]
        }
        Update: {
          api_base_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: Database["public"]["Enums"]["activity_source"]
        }
        Relationships: []
      }
      adventure_days: {
        Row: {
          adventure_id: string
          alternates_json: Json
          context_json: Json | null
          created_at: string
          day_number: number
          error_message: string | null
          hydrated_at: string | null
          id: string
          itinerary_json: Json
          outline_json: Json
          status: string
          teaser: string | null
          theme_title: string
          updated_at: string
        }
        Insert: {
          adventure_id: string
          alternates_json?: Json
          context_json?: Json | null
          created_at?: string
          day_number: number
          error_message?: string | null
          hydrated_at?: string | null
          id?: string
          itinerary_json?: Json
          outline_json?: Json
          status?: string
          teaser?: string | null
          theme_title: string
          updated_at?: string
        }
        Update: {
          adventure_id?: string
          alternates_json?: Json
          context_json?: Json | null
          created_at?: string
          day_number?: number
          error_message?: string | null
          hydrated_at?: string | null
          id?: string
          itinerary_json?: Json
          outline_json?: Json
          status?: string
          teaser?: string | null
          theme_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_days_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
        ]
      }
      adventures: {
        Row: {
          adventure_type: string | null
          bonus_goal: string | null
          budget_level: string | null
          created_at: string
          deadline: string
          drop_date: string
          hero_image_url: string | null
          id: string
          itinerary_json: Json | null
          main_goal: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          why_travis_picked_this: string | null
        }
        Insert: {
          adventure_type?: string | null
          bonus_goal?: string | null
          budget_level?: string | null
          created_at?: string
          deadline: string
          drop_date: string
          hero_image_url?: string | null
          id?: string
          itinerary_json?: Json | null
          main_goal?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          why_travis_picked_this?: string | null
        }
        Update: {
          adventure_type?: string | null
          bonus_goal?: string | null
          budget_level?: string | null
          created_at?: string
          deadline?: string
          drop_date?: string
          hero_image_url?: string | null
          id?: string
          itinerary_json?: Json | null
          main_goal?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          why_travis_picked_this?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adventures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intents: {
        Row: {
          activity_id: string
          id: string
          itinerary_id: string | null
          itinerary_item_id: string | null
          last_transition_at: string
          provider: Database["public"]["Enums"]["activity_source"]
          provider_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["booking_intent_status"]
          user_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          itinerary_id?: string | null
          itinerary_item_id?: string | null
          last_transition_at?: string
          provider: Database["public"]["Enums"]["activity_source"]
          provider_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["booking_intent_status"]
          user_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          itinerary_id?: string | null
          itinerary_item_id?: string | null
          last_transition_at?: string
          provider?: Database["public"]["Enums"]["activity_source"]
          provider_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["booking_intent_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intents_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_itinerary_item_id_fkey"
            columns: ["itinerary_item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_outcomes: {
        Row: {
          booked_for_start_at: string | null
          booking_intent_id: string
          created_at: string
          currency: string | null
          id: string
          provider_confirmation_ref: string | null
          status: Database["public"]["Enums"]["booking_outcome_status"]
          total_minor: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_for_start_at?: string | null
          booking_intent_id: string
          created_at?: string
          currency?: string | null
          id?: string
          provider_confirmation_ref?: string | null
          status?: Database["public"]["Enums"]["booking_outcome_status"]
          total_minor?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_for_start_at?: string | null
          booking_intent_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          provider_confirmation_ref?: string | null
          status?: Database["public"]["Enums"]["booking_outcome_status"]
          total_minor?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_outcomes_booking_intent_id_fkey"
            columns: ["booking_intent_id"]
            isOneToOne: true
            referencedRelation: "booking_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      global_hubs: {
        Row: {
          country_code: string | null
          created_at: string | null
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          created_at: string
          destination_city: string
          end_date: string | null
          id: string
          legacy_adventure_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["itinerary_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_city: string
          end_date?: string | null
          id?: string
          legacy_adventure_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["itinerary_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_city?: string
          end_date?: string | null
          id?: string
          legacy_adventure_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["itinerary_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          activity_id: string
          created_at: string
          day_index: number
          id: string
          itinerary_id: string
          narrative_why: string | null
          position_index: number
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          day_index?: number
          id?: string
          itinerary_id: string
          narrative_why?: string | null
          position_index?: number
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          day_index?: number
          id?: string
          itinerary_id?: string
          narrative_why?: string | null
          position_index?: number
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          assignment_date: string
          created_at: string
          deadline: string
          estimated_budget: number | null
          estimated_duration_minutes: number | null
          id: string
          itinerary_json: Json | null
          mission_type: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          why_travis_picked_this: string | null
        }
        Insert: {
          assignment_date: string
          created_at?: string
          deadline: string
          estimated_budget?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          itinerary_json?: Json | null
          mission_type?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          why_travis_picked_this?: string | null
        }
        Update: {
          assignment_date?: string
          created_at?: string
          deadline?: string
          estimated_budget?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          itinerary_json?: Json | null
          mission_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          why_travis_picked_this?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          adventure_id: string | null
          body: string
          channel: string
          created_at: string
          dedupe_key: string
          failure_reason: string | null
          id: string
          opened_at: string | null
          profile_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          adventure_id?: string | null
          body: string
          channel: string
          created_at?: string
          dedupe_key: string
          failure_reason?: string | null
          id?: string
          opened_at?: string | null
          profile_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          adventure_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          dedupe_key?: string
          failure_reason?: string | null
          id?: string
          opened_at?: string | null
          profile_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_devices: {
        Row: {
          app_version: string | null
          created_at: string
          disabled_at: string | null
          expo_push_token: string | null
          id: string
          install_id: string
          last_seen_at: string | null
          permission_status: string
          platform: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          disabled_at?: string | null
          expo_push_token?: string | null
          id?: string
          install_id: string
          last_seen_at?: string | null
          permission_status?: string
          platform: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          disabled_at?: string | null
          expo_push_token?: string | null
          id?: string
          install_id?: string
          last_seen_at?: string | null
          permission_status?: string
          platform?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_stamps: {
        Row: {
          activity_id: string | null
          canonical_key: string | null
          city: string | null
          country_code: string | null
          created_at: string
          day_index: number
          day_stamped_count_at_stamp: number | null
          day_total_stops: number | null
          distance_meters: number | null
          id: string
          itinerary_id: string | null
          lat: number | null
          lng: number | null
          place_id: string
          source: string
          stamped_at: string
          title: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          canonical_key?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          day_index?: number
          day_stamped_count_at_stamp?: number | null
          day_total_stops?: number | null
          distance_meters?: number | null
          id?: string
          itinerary_id?: string | null
          lat?: number | null
          lng?: number | null
          place_id: string
          source?: string
          stamped_at?: string
          title?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          canonical_key?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          day_index?: number
          day_stamped_count_at_stamp?: number | null
          day_total_stops?: number | null
          distance_meters?: number | null
          id?: string
          itinerary_id?: string | null
          lat?: number | null
          lng?: number | null
          place_id?: string
          source?: string
          stamped_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_stamps_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_stamps_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_stamp_art_manifest: {
        Row: {
          achievement_key: string
          created_at: string
          locked_storage_path: string | null
          storage_path: string
          theme_metadata: Json
          updated_at: string
          version: number
        }
        Insert: {
          achievement_key: string
          created_at?: string
          locked_storage_path?: string | null
          storage_path: string
          theme_metadata?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          achievement_key?: string
          created_at?: string
          locked_storage_path?: string | null
          storage_path?: string
          theme_metadata?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          budget_default: number | null
          created_at: string
          home_city: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          notifications_enabled: boolean
          spontaneity_level: string
          time_default: number | null
          transport_mode: string
          travis_tone: string
          updated_at: string
        }
        Insert: {
          budget_default?: number | null
          created_at?: string
          home_city?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id: string
          notifications_enabled?: boolean
          spontaneity_level?: string
          time_default?: number | null
          transport_mode?: string
          travis_tone?: string
          updated_at?: string
        }
        Update: {
          budget_default?: number | null
          created_at?: string
          home_city?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          notifications_enabled?: boolean
          spontaneity_level?: string
          time_default?: number | null
          transport_mode?: string
          travis_tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_activities: {
        Row: {
          activity_id: string
          id: string
          notes: string | null
          saved_at: string
          search_session_id: string | null
          source_context: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          notes?: string | null
          saved_at?: string
          search_session_id?: string | null
          source_context?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          notes?: string | null
          saved_at?: string
          search_session_id?: string | null
          source_context?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_activities_search_session_id_fkey"
            columns: ["search_session_id"]
            isOneToOne: false
            referencedRelation: "search_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      search_sessions: {
        Row: {
          created_at: string
          filters: Json
          id: string
          result_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          result_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          result_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          created_at: string
          id: string
          metadata_json: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          created_at?: string
          id?: string
          metadata_json?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          created_at?: string
          id?: string
          metadata_json?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          accessibility_requirements: string[] | null
          created_at: string
          home_city: string | null
          id: string
          preferred_categories: string[] | null
          preferred_price_tiers:
            | Database["public"]["Enums"]["activity_price_tier"][]
            | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          accessibility_requirements?: string[] | null
          created_at?: string
          home_city?: string | null
          id?: string
          preferred_categories?: string[] | null
          preferred_price_tiers?:
            | Database["public"]["Enums"]["activity_price_tier"][]
            | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          accessibility_requirements?: string[] | null
          created_at?: string
          home_city?: string | null
          id?: string
          preferred_categories?: string[] | null
          preferred_price_tiers?:
            | Database["public"]["Enums"]["activity_price_tier"][]
            | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_price_tier: "free" | "budget" | "mid" | "premium" | "unknown"
      activity_source: "google_places" | "foursquare" | "viator" | "manual"
      activity_status: "active" | "hidden" | "deprecated"
      booking_intent_status:
        | "initiated"
        | "provider_redirected"
        | "abandoned"
        | "confirmed"
        | "failed"
      booking_outcome_status:
        | "booked"
        | "cancelled"
        | "refunded"
        | "attended"
        | "no_show"
      itinerary_status:
        | "draft"
        | "ready"
        | "in_progress"
        | "completed"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_price_tier: ["free", "budget", "mid", "premium", "unknown"],
      activity_source: ["google_places", "foursquare", "viator", "manual"],
      activity_status: ["active", "hidden", "deprecated"],
      booking_intent_status: [
        "initiated",
        "provider_redirected",
        "abandoned",
        "confirmed",
        "failed",
      ],
      booking_outcome_status: [
        "booked",
        "cancelled",
        "refunded",
        "attended",
        "no_show",
      ],
      itinerary_status: [
        "draft",
        "ready",
        "in_progress",
        "completed",
        "archived",
      ],
    },
  },
} as const



