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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          diff: Json | null
          entity: string
          entity_id: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          diff?: Json | null
          entity: string
          entity_id: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          diff?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      laudos: {
        Row: {
          ai_model: string | null
          ai_usage: Json | null
          audio_processing_status: string | null
          cid10_codes: Json | null
          clinical_context: Json | null
          complementary_exams: Json | null
          conducts: Json | null
          created_at: string
          diagnosis_diff: string | null
          diagnosis_main: string | null
          editor_last_saved: string | null
          finalized_at: string | null
          generation_mode: string | null
          hypotheses: Json | null
          id: string
          import_source: string | null
          last_update_type: string | null
          legal_disclaimer: string | null
          patient_data: Json | null
          patient_markdown: string | null
          pdf_hash: string | null
          pdf_url: string | null
          pdf_verify_token: string | null
          red_flags: Json | null
          report_markdown: string | null
          sections: Json | null
          source_audio_url: string | null
          specialty: string | null
          status: string | null
          summary: Json | null
          title: string
          transcript: Json | null
          transcript_segments: Json | null
          transcript_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_usage?: Json | null
          audio_processing_status?: string | null
          cid10_codes?: Json | null
          clinical_context?: Json | null
          complementary_exams?: Json | null
          conducts?: Json | null
          created_at?: string
          diagnosis_diff?: string | null
          diagnosis_main?: string | null
          editor_last_saved?: string | null
          finalized_at?: string | null
          generation_mode?: string | null
          hypotheses?: Json | null
          id?: string
          import_source?: string | null
          last_update_type?: string | null
          legal_disclaimer?: string | null
          patient_data?: Json | null
          patient_markdown?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          pdf_verify_token?: string | null
          red_flags?: Json | null
          report_markdown?: string | null
          sections?: Json | null
          source_audio_url?: string | null
          specialty?: string | null
          status?: string | null
          summary?: Json | null
          title: string
          transcript?: Json | null
          transcript_segments?: Json | null
          transcript_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          ai_usage?: Json | null
          audio_processing_status?: string | null
          cid10_codes?: Json | null
          clinical_context?: Json | null
          complementary_exams?: Json | null
          conducts?: Json | null
          created_at?: string
          diagnosis_diff?: string | null
          diagnosis_main?: string | null
          editor_last_saved?: string | null
          finalized_at?: string | null
          generation_mode?: string | null
          hypotheses?: Json | null
          id?: string
          import_source?: string | null
          last_update_type?: string | null
          legal_disclaimer?: string | null
          patient_data?: Json | null
          patient_markdown?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          pdf_verify_token?: string | null
          red_flags?: Json | null
          report_markdown?: string | null
          sections?: Json | null
          source_audio_url?: string | null
          specialty?: string | null
          status?: string | null
          summary?: Json | null
          title?: string
          transcript?: Json | null
          transcript_segments?: Json | null
          transcript_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          crm: string | null
          email: string
          full_name: string | null
          id: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm?: string | null
          email: string
          full_name?: string | null
          id: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm?: string | null
          email?: string
          full_name?: string | null
          id?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["plan_type"]
          remaining_starter_credits: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          remaining_starter_credits?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          remaining_starter_credits?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      log_audit_action: {
        Args: {
          p_action: string
          p_diff?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: string
      }
    }
    Enums: {
      plan_type: "STARTER" | "PRO" | "CLINIC"
      subscription_status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING"
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
      plan_type: ["STARTER", "PRO", "CLINIC"],
      subscription_status: ["ACTIVE", "PAST_DUE", "CANCELED", "TRIALING"],
    },
  },
} as const
