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
          is_pinned: boolean | null
          messages: Json
          notes: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          messages?: Json
          notes?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          messages?: Json
          notes?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_entitlements: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          status: string
          stripe_payment_intent_id: string | null
          unlocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          unlocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          unlocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_entitlements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_scores: {
        Row: {
          created_at: string
          deal_id: string
          flags_json: Json | null
          id: string
          score: number
          score_breakdown: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          flags_json?: Json | null
          id?: string
          score: number
          score_breakdown?: Json | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          flags_json?: Json | null
          id?: string
          score?: number
          score_breakdown?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_scores_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          progress: number
          registration: string | null
          score_result: Json | null
          status: string
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
          progress?: number
          registration?: string | null
          score_result?: Json | null
          status?: string
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
          progress?: number
          registration?: string | null
          score_result?: Json | null
          status?: string
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
          sms_reminders: boolean
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
          sms_reminders?: boolean
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
          sms_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_users: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unknown_term_escalations: {
        Row: {
          context: string | null
          conversation_id: string | null
          created_at: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          term: string
          updated_at: string
          user_id: string | null
          user_message: string
        }
        Insert: {
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          term: string
          updated_at?: string
          user_id?: string | null
          user_message: string
        }
        Update: {
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          term?: string
          updated_at?: string
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "unknown_term_escalations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
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
    },
  },
} as const
