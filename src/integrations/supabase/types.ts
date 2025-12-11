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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          notes: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          notes?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          notes?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_integrations: {
        Row: {
          coach_id: string
          created_at: string
          google_access_token: string | null
          google_connected: boolean | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          google_access_token?: string | null
          google_connected?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          google_access_token?: string | null
          google_connected?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_integrations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_available: boolean
          tier: Database["public"]["Enums"]["coaching_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_available?: boolean
          tier?: Database["public"]["Enums"]["coaching_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_available?: boolean
          tier?: Database["public"]["Enums"]["coaching_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coaching_requests: {
        Row: {
          claimed_at: string | null
          coach_id: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          deal_id: string | null
          email: string
          id: string
          notes: string | null
          phone_number: string
          scheduled_date: string
          scheduled_time: string
          session_type: Database["public"]["Enums"]["session_type"]
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          deal_id?: string | null
          email: string
          id?: string
          notes?: string | null
          phone_number: string
          scheduled_date: string
          scheduled_time: string
          session_type: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          deal_id?: string | null
          email?: string
          id?: string
          notes?: string | null
          phone_number?: string
          scheduled_date?: string
          scheduled_time?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          actual_duration_minutes: number | null
          coach_id: string
          created_at: string
          customer_id: string
          ended_at: string | null
          extension_approved: boolean | null
          extension_minutes: number | null
          extension_price_cents: number | null
          extension_requested: boolean | null
          id: string
          masked_phone_number: string | null
          meet_link: string | null
          request_id: string
          scheduled_duration_minutes: number
          session_type: Database["public"]["Enums"]["session_type"]
          started_at: string | null
          status: string
          twilio_room_sid: string | null
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          coach_id: string
          created_at?: string
          customer_id: string
          ended_at?: string | null
          extension_approved?: boolean | null
          extension_minutes?: number | null
          extension_price_cents?: number | null
          extension_requested?: boolean | null
          id?: string
          masked_phone_number?: string | null
          meet_link?: string | null
          request_id: string
          scheduled_duration_minutes?: number
          session_type: Database["public"]["Enums"]["session_type"]
          started_at?: string | null
          status?: string
          twilio_room_sid?: string | null
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          coach_id?: string
          created_at?: string
          customer_id?: string
          ended_at?: string | null
          extension_approved?: boolean | null
          extension_minutes?: number | null
          extension_price_cents?: number | null
          extension_requested?: boolean | null
          id?: string
          masked_phone_number?: string | null
          meet_link?: string | null
          request_id?: string
          scheduled_duration_minutes?: number
          session_type?: Database["public"]["Enums"]["session_type"]
          started_at?: string | null
          status?: string
          twilio_room_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "coaching_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "coaching_requests_coach_view"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          add_ons: string | null
          apr: string | null
          asking_price: string | null
          buyer_zip: string | null
          created_at: string
          credit_score: string | null
          dealer_fee: string | null
          dealer_zip: string | null
          doc_fee: string | null
          down_payment: string | null
          fuel_cost: string | null
          id: string
          insurance: string | null
          maintenance: string | null
          make: string | null
          mileage: string | null
          model: string | null
          monthly_income: string | null
          name: string
          negotiated_price: string | null
          registration: string | null
          score_result: Json | null
          taxes: string | null
          term: string | null
          trade_in: string | null
          trim: string | null
          updated_at: string
          user_id: string
          vin: string | null
          year: string | null
        }
        Insert: {
          add_ons?: string | null
          apr?: string | null
          asking_price?: string | null
          buyer_zip?: string | null
          created_at?: string
          credit_score?: string | null
          dealer_fee?: string | null
          dealer_zip?: string | null
          doc_fee?: string | null
          down_payment?: string | null
          fuel_cost?: string | null
          id?: string
          insurance?: string | null
          maintenance?: string | null
          make?: string | null
          mileage?: string | null
          model?: string | null
          monthly_income?: string | null
          name?: string
          negotiated_price?: string | null
          registration?: string | null
          score_result?: Json | null
          taxes?: string | null
          term?: string | null
          trade_in?: string | null
          trim?: string | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year?: string | null
        }
        Update: {
          add_ons?: string | null
          apr?: string | null
          asking_price?: string | null
          buyer_zip?: string | null
          created_at?: string
          credit_score?: string | null
          dealer_fee?: string | null
          dealer_zip?: string | null
          doc_fee?: string | null
          down_payment?: string | null
          fuel_cost?: string | null
          id?: string
          insurance?: string | null
          maintenance?: string | null
          make?: string | null
          mileage?: string | null
          model?: string | null
          monthly_income?: string | null
          name?: string
          negotiated_price?: string | null
          registration?: string | null
          score_result?: Json | null
          taxes?: string | null
          term?: string | null
          trade_in?: string | null
          trim?: string | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          coaching_offers: boolean
          created_at: string
          deal_reminders: boolean
          id: string
          product_news: boolean
          score_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          coaching_offers?: boolean
          created_at?: string
          deal_reminders?: boolean
          id?: string
          product_news?: boolean
          score_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          coaching_offers?: boolean
          created_at?: string
          deal_reminders?: boolean
          id?: string
          product_news?: boolean
          score_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      coaching_requests_coach_view: {
        Row: {
          claimed_at: string | null
          coach_id: string | null
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          deal_id: string | null
          email: string | null
          id: string | null
          notes: string | null
          phone_number: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          status: Database["public"]["Enums"]["request_status"] | null
          updated_at: string | null
        }
        Insert: {
          claimed_at?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          deal_id?: string | null
          email?: never
          id?: string | null
          notes?: never
          phone_number?: never
          scheduled_date?: string | null
          scheduled_time?: string | null
          session_type?: Database["public"]["Enums"]["session_type"] | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
        }
        Update: {
          claimed_at?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          deal_id?: string | null
          email?: never
          id?: string | null
          notes?: never
          phone_number?: never
          scheduled_date?: string | null
          scheduled_time?: string | null
          session_type?: Database["public"]["Enums"]["session_type"] | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "coach" | "admin"
      coaching_tier: "text" | "phone" | "concierge"
      request_status:
        | "pending"
        | "claimed"
        | "in_progress"
        | "completed"
        | "cancelled"
      session_type: "text" | "phone" | "video"
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
      app_role: ["customer", "coach", "admin"],
      coaching_tier: ["text", "phone", "concierge"],
      request_status: [
        "pending",
        "claimed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      session_type: ["text", "phone", "video"],
    },
  },
} as const
