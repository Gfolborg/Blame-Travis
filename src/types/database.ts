export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      adventure_days: {
        Row: {
          adventure_id: string;
          alternates_json: Json | null;
          context_json: Json | null;
          created_at: string;
          day_number: number;
          error_message: string | null;
          hydrated_at: string | null;
          id: string;
          itinerary_json: Json | null;
          outline_json: Json | null;
          status: string;
          teaser: string | null;
          theme_title: string;
          updated_at: string;
        };
        Insert: {
          adventure_id: string;
          alternates_json?: Json | null;
          context_json?: Json | null;
          created_at?: string;
          day_number: number;
          error_message?: string | null;
          hydrated_at?: string | null;
          id?: string;
          itinerary_json?: Json | null;
          outline_json?: Json | null;
          status?: string;
          teaser?: string | null;
          theme_title: string;
          updated_at?: string;
        };
        Update: {
          adventure_id?: string;
          alternates_json?: Json | null;
          context_json?: Json | null;
          created_at?: string;
          day_number?: number;
          error_message?: string | null;
          hydrated_at?: string | null;
          id?: string;
          itinerary_json?: Json | null;
          outline_json?: Json | null;
          status?: string;
          teaser?: string | null;
          theme_title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'adventure_days_adventure_id_fkey';
            columns: ['adventure_id'];
            isOneToOne: false;
            referencedRelation: 'adventures';
            referencedColumns: ['id'];
          },
        ];
      };
      adventures: {
        Row: {
          bonus_goal: string | null;
          drop_date: string;
          created_at: string;
          deadline: string;
          estimated_budget: number | null;
          estimated_duration_minutes: number | null;
          hero_image_url: string | null;
          id: string;
          itinerary_json: Json | null;
          main_goal: string | null;
          adventure_type: string | null;
          budget_level: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
          why_travis_picked_this: string | null;
        };
        Insert: {
          bonus_goal?: string | null;
          drop_date: string;
          created_at?: string;
          deadline: string;
          estimated_budget?: number | null;
          estimated_duration_minutes?: number | null;
          hero_image_url?: string | null;
          id?: string;
          itinerary_json?: Json | null;
          main_goal?: string | null;
          adventure_type?: string | null;
          budget_level?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          why_travis_picked_this?: string | null;
        };
        Update: {
          bonus_goal?: string | null;
          drop_date?: string;
          created_at?: string;
          deadline?: string;
          estimated_budget?: number | null;
          estimated_duration_minutes?: number | null;
          hero_image_url?: string | null;
          id?: string;
          itinerary_json?: Json | null;
          main_goal?: string | null;
          adventure_type?: string | null;
          budget_level?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          why_travis_picked_this?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'adventures_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      global_hubs: {
        Row: {
          id: string;
          latitude: number;
          longitude: number;
          name: string;
        };
        Insert: {
          id?: string;
          latitude: number;
          longitude: number;
          name: string;
        };
        Update: {
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          budget_default: number | null;
          created_at: string;
          home_city: string | null;
          home_lat: number | null;
          home_lng: number | null;
          id: string;
          is_premium: boolean;
          rerolls_today: number;
          last_reroll_date: string | null;
          notifications_enabled: boolean;
          spontaneity_level: string;
          time_default: number | null;
          transport_mode: string;
          travis_tone: string;
          updated_at: string;
        };
        Insert: {
          budget_default?: number | null;
          created_at?: string;
          home_city?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          id: string;
          is_premium?: boolean;
          rerolls_today?: number;
          last_reroll_date?: string | null;
          notifications_enabled?: boolean;
          spontaneity_level?: string;
          time_default?: number | null;
          transport_mode?: string;
          travis_tone?: string;
          updated_at?: string;
        };
        Update: {
          budget_default?: number | null;
          created_at?: string;
          home_city?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          id?: string;
          is_premium?: boolean;
          rerolls_today?: number;
          last_reroll_date?: string | null;
          notifications_enabled?: boolean;
          spontaneity_level?: string;
          time_default?: number | null;
          transport_mode?: string;
          travis_tone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          adventure_id: string | null;
          body: string;
          channel: string;
          created_at: string;
          dedupe_key: string;
          failure_reason: string | null;
          id: string;
          opened_at: string | null;
          profile_id: string;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          adventure_id?: string | null;
          body: string;
          channel: string;
          created_at?: string;
          dedupe_key: string;
          failure_reason?: string | null;
          id?: string;
          opened_at?: string | null;
          profile_id: string;
          scheduled_for: string;
          sent_at?: string | null;
          status?: string;
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          adventure_id?: string | null;
          body?: string;
          channel?: string;
          created_at?: string;
          dedupe_key?: string;
          failure_reason?: string | null;
          id?: string;
          opened_at?: string | null;
          profile_id?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_deliveries_adventure_id_fkey';
            columns: ['adventure_id'];
            isOneToOne: false;
            referencedRelation: 'adventures';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_deliveries_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_devices: {
        Row: {
          app_version: string | null;
          created_at: string;
          disabled_at: string | null;
          expo_push_token: string | null;
          id: string;
          install_id: string;
          last_seen_at: string | null;
          permission_status: string;
          platform: string;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          expo_push_token?: string | null;
          id?: string;
          install_id: string;
          last_seen_at?: string | null;
          permission_status?: string;
          platform: string;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          expo_push_token?: string | null;
          id?: string;
          install_id?: string;
          last_seen_at?: string | null;
          permission_status?: string;
          platform?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_devices_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database;
}
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database;
}
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database;
}
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database;
}
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;
