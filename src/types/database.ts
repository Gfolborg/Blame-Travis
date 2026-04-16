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
      adventures: {
        Row: {
          drop_date: string;
          created_at: string;
          deadline: string;
          estimated_budget: number | null;
          estimated_duration_minutes: number | null;
          id: string;
          itinerary_json: Json | null;
          adventure_type: string | null;
          budget_level: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
          why_travis_picked_this: string | null;
        };
        Insert: {
          drop_date: string;
          created_at?: string;
          deadline: string;
          estimated_budget?: number | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          itinerary_json?: Json | null;
          adventure_type?: string | null;
          budget_level?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          why_travis_picked_this?: string | null;
        };
        Update: {
          drop_date?: string;
          created_at?: string;
          deadline?: string;
          estimated_budget?: number | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          itinerary_json?: Json | null;
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
          spontaneity_level?: string;
          time_default?: number | null;
          transport_mode?: string;
          travis_tone?: string;
          updated_at?: string;
        };
        Relationships: [];
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
