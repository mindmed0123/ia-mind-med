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
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          doctor_id: string
          end_at: string
          id: string
          internal_notes: string | null
          laudo_id: string | null
          notes: string | null
          organization_id: string
          patient_email_snapshot: string | null
          patient_id: string | null
          patient_name_snapshot: string
          patient_phone_snapshot: string | null
          source: Database["public"]["Enums"]["appointment_source"]
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          doctor_id: string
          end_at: string
          id?: string
          internal_notes?: string | null
          laudo_id?: string | null
          notes?: string | null
          organization_id: string
          patient_email_snapshot?: string | null
          patient_id?: string | null
          patient_name_snapshot: string
          patient_phone_snapshot?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          doctor_id?: string
          end_at?: string
          id?: string
          internal_notes?: string | null
          laudo_id?: string | null
          notes?: string | null
          organization_id?: string
          patient_email_snapshot?: string | null
          patient_id?: string | null
          patient_name_snapshot?: string
          patient_phone_snapshot?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
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
      booking_links: {
        Row: {
          allowed_appointment_type_ids: string[] | null
          created_at: string
          created_by: string
          doctor_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          organization_id: string
          token: string
        }
        Insert: {
          allowed_appointment_type_ids?: string[] | null
          created_at?: string
          created_by: string
          doctor_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          token: string
        }
        Update: {
          allowed_appointment_type_ids?: string[] | null
          created_at?: string
          created_by?: string
          doctor_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      doctor_availability: {
        Row: {
          created_at: string
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean
          organization_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean
          organization_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_unavailability: {
        Row: {
          created_at: string
          created_by: string
          doctor_id: string
          end_at: string
          id: string
          organization_id: string
          reason: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string
          recurrence_weekdays: number[] | null
          start_at: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          doctor_id: string
          end_at: string
          id?: string
          organization_id: string
          reason?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string
          recurrence_weekdays?: number[] | null
          start_at: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          doctor_id?: string
          end_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string
          recurrence_weekdays?: number[] | null
          start_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_unavailability_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      evolution_reports: {
        Row: {
          created_at: string
          evolution_summary: string | null
          findings: Json | null
          id: string
          patient_id: string
          pdf_url: string | null
          recommendations: string | null
          report_markdown: string | null
          theoretical_basis: string | null
          timeline_data: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evolution_summary?: string | null
          findings?: Json | null
          id?: string
          patient_id: string
          pdf_url?: string | null
          recommendations?: string | null
          report_markdown?: string | null
          theoretical_basis?: string | null
          timeline_data?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evolution_summary?: string | null
          findings?: Json | null
          id?: string
          patient_id?: string
          pdf_url?: string | null
          recommendations?: string | null
          report_markdown?: string | null
          theoretical_basis?: string | null
          timeline_data?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_access: {
        Row: {
          created_at: string
          enabled: boolean
          expires_at: string | null
          feature_key: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          feature_key: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          feature_key?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
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
          patient_id: string | null
          patient_markdown: string | null
          pdf_generated_at: string | null
          pdf_hash: string | null
          pdf_url: string | null
          pdf_verify_token: string | null
          pdf_version: number | null
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
          patient_id?: string | null
          patient_markdown?: string | null
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          pdf_verify_token?: string | null
          pdf_version?: number | null
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
          patient_id?: string | null
          patient_markdown?: string | null
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          pdf_verify_token?: string | null
          pdf_version?: number | null
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
            foreignKeyName: "laudos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          current_step: number
          first_laudo_id: string | null
          id: string
          step1_completed_at: string | null
          step2_completed_at: string | null
          step3_completed_at: string | null
          step4_completed_at: string | null
          time_saved_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          first_laudo_id?: string | null
          id?: string
          step1_completed_at?: string | null
          step2_completed_at?: string | null
          step3_completed_at?: string | null
          step4_completed_at?: string | null
          time_saved_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          first_laudo_id?: string | null
          id?: string
          step1_completed_at?: string | null
          step2_completed_at?: string | null
          step3_completed_at?: string | null
          step4_completed_at?: string | null
          time_saved_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          display_color: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          display_color?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          display_color?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          display_color: string | null
          display_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_color?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_color?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          seats_paid: number
          slug: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          seats_paid?: number
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          seats_paid?: number
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          ai_analysis: Json | null
          ai_description: string | null
          analyzed_at: string | null
          category: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          notes: string | null
          patient_id: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_description?: string | null
          analyzed_at?: string | null
          category?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          notes?: string | null
          patient_id: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_description?: string | null
          analyzed_at?: string | null
          category?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          patient_id?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          ai_extracted_fields: string[] | null
          alcohol: boolean | null
          allergies: string[] | null
          birth_date: string | null
          chief_complaint: string | null
          clinical_history: string | null
          clinical_notes: string | null
          comorbidities: string[] | null
          created_at: string
          email: string | null
          external_id: string | null
          family_history: string | null
          id: string
          medications: string[] | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          sex: string | null
          smoking: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_extracted_fields?: string[] | null
          alcohol?: boolean | null
          allergies?: string[] | null
          birth_date?: string | null
          chief_complaint?: string | null
          clinical_history?: string | null
          clinical_notes?: string | null
          comorbidities?: string[] | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          family_history?: string | null
          id?: string
          medications?: string[] | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          sex?: string | null
          smoking?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_extracted_fields?: string[] | null
          alcohol?: boolean | null
          allergies?: string[] | null
          birth_date?: string | null
          chief_complaint?: string | null
          clinical_history?: string | null
          clinical_notes?: string | null
          comorbidities?: string[] | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          family_history?: string | null
          id?: string
          medications?: string[] | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          sex?: string | null
          smoking?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          id: string
          items: Json
          notes: string | null
          patient_dob: string | null
          patient_id_external: string | null
          patient_name: string
          patient_sex: string | null
          pdf_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          patient_dob?: string | null
          patient_id_external?: string | null
          patient_name: string
          patient_sex?: string | null
          pdf_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          patient_dob?: string | null
          patient_id_external?: string | null
          patient_name?: string
          patient_sex?: string | null
          pdf_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          clinic_name: string | null
          created_at: string
          crm: string | null
          crm_uf: string | null
          email: string
          email_public: string | null
          full_name: string | null
          id: string
          lgpd_consent_date: string | null
          lgpd_consent_given: boolean | null
          lgpd_consent_ip: string | null
          lgpd_consent_version: string | null
          logo_url: string | null
          phone: string | null
          prescription_footer_text: string | null
          signature_image_url: string | null
          specialty: string | null
          stamp_image_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string
          crm?: string | null
          crm_uf?: string | null
          email: string
          email_public?: string | null
          full_name?: string | null
          id: string
          lgpd_consent_date?: string | null
          lgpd_consent_given?: boolean | null
          lgpd_consent_ip?: string | null
          lgpd_consent_version?: string | null
          logo_url?: string | null
          phone?: string | null
          prescription_footer_text?: string | null
          signature_image_url?: string | null
          specialty?: string | null
          stamp_image_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string
          crm?: string | null
          crm_uf?: string | null
          email?: string
          email_public?: string | null
          full_name?: string | null
          id?: string
          lgpd_consent_date?: string | null
          lgpd_consent_given?: boolean | null
          lgpd_consent_ip?: string | null
          lgpd_consent_version?: string | null
          logo_url?: string | null
          phone?: string | null
          prescription_footer_text?: string | null
          signature_image_url?: string | null
          specialty?: string | null
          stamp_image_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      specialty_templates: {
        Row: {
          created_at: string | null
          display_name: string
          extraction_fields: Json
          id: string
          is_default: boolean | null
          sections: Json
          specialty: string
          system_prompt: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          extraction_fields?: Json
          id?: string
          is_default?: boolean | null
          sections?: Json
          specialty: string
          system_prompt: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          extraction_fields?: Json
          id?: string
          is_default?: boolean | null
          sections?: Json
          specialty?: string
          system_prompt?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          external_payment_id: string | null
          id: string
          payment_provider: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          quota_used: number | null
          remaining_starter_credits: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_payment_id?: string | null
          id?: string
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          quota_used?: number | null
          remaining_starter_credits?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_payment_id?: string | null
          id?: string
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          quota_used?: number | null
          remaining_starter_credits?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      accept_organization_invite: { Args: { _token: string }; Returns: Json }
      check_and_consume_quota:
        | { Args: never; Returns: Json }
        | { Args: { p_user_id: string }; Returns: Json }
      count_active_org_members: { Args: { _org_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_agenda_metrics: {
        Args: {
          p_doctor_id?: string
          p_end: string
          p_organization_id: string
          p_start: string
        }
        Returns: Json
      }
      get_invite_preview: { Args: { _token: string }; Returns: Json }
      get_quota_status:
        | { Args: never; Returns: Json }
        | { Args: { p_user_id: string }; Returns: Json }
      get_user_organizations: { Args: { _user_id: string }; Returns: string[] }
      has_feature_access: {
        Args: { _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_invited_doctor: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit_action: {
        Args: {
          p_action: string
          p_diff?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
      appointment_source: "internal" | "online"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      org_role: "owner" | "doctor" | "staff"
      plan_type: "STARTER" | "PRO" | "CLINIC"
      subscription_status:
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELED"
        | "TRIALING"
        | "PENDING_CHECKOUT"
        | "INACTIVE"
        | "EXPIRED"
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
      app_role: ["admin", "user"],
      appointment_source: ["internal", "online"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      org_role: ["owner", "doctor", "staff"],
      plan_type: ["STARTER", "PRO", "CLINIC"],
      subscription_status: [
        "ACTIVE",
        "PAST_DUE",
        "CANCELED",
        "TRIALING",
        "PENDING_CHECKOUT",
        "INACTIVE",
        "EXPIRED",
      ],
    },
  },
} as const
