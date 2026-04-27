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
      associates: {
        Row: {
          created_at: string
          current_archetype: string
          default_end_time: string
          default_start_time: string
          id: string
          name: string
          pin_code: string | null
          profile_id: string | null
          role: string
          role_rank: number
          scheduled_days: string
          store_id: string
        }
        Insert: {
          created_at?: string
          current_archetype?: string
          default_end_time?: string
          default_start_time?: string
          id?: string
          name: string
          pin_code?: string | null
          profile_id?: string | null
          role: string
          role_rank?: number
          scheduled_days?: string
          store_id: string
        }
        Update: {
          created_at?: string
          current_archetype?: string
          default_end_time?: string
          default_start_time?: string
          id?: string
          name?: string
          pin_code?: string | null
          profile_id?: string | null
          role?: string
          role_rank?: number
          scheduled_days?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "associates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_issues: {
        Row: {
          id: string
          created_at: string
          store_id: string
          reported_at_store_id: string
          reported_by_associate_id: string | null
          category: string
          description: string
          photo_url: string | null
          status: string
          resolved_by_associate_id: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          store_id: string
          reported_at_store_id: string
          reported_by_associate_id?: string | null
          category: string
          description: string
          photo_url?: string | null
          status?: string
          resolved_by_associate_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          store_id?: string
          reported_at_store_id?: string
          reported_by_associate_id?: string | null
          category?: string
          description?: string
          photo_url?: string | null
          status?: string
          resolved_by_associate_id?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
      assistance_requests: {
        Row: {
          id: string
          store_id: string
          task_id: string
          requested_by_associate_id: string
          request_level: number
          supervisor_code: string | null
          is_resolved: boolean
          resolved_by_associate_id: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          task_id: string
          requested_by_associate_id: string
          request_level: number
          supervisor_code?: string | null
          is_resolved?: boolean
          resolved_by_associate_id?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          task_id?: string
          requested_by_associate_id?: string
          request_level?: number
          supervisor_code?: string | null
          is_resolved?: boolean
          resolved_by_associate_id?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      active_shifts: {
        Row: {
          associate_id: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          station: string
          store_id: string
        }
        Insert: {
          associate_id: string
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          station: string
          store_id: string
        }
        Update: {
          associate_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          station?: string
          store_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          associate_id: string
          category: string
          created_at: string
          description: string
          id: string
          is_statement_generated: boolean
          store_id: string
          timestamp_ms: number
        }
        Insert: {
          associate_id: string
          category: string
          created_at?: string
          description: string
          id?: string
          is_statement_generated?: boolean
          store_id: string
          timestamp_ms: number
        }
        Update: {
          associate_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_statement_generated?: boolean
          store_id?: string
          timestamp_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "incidents_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          amount_have: number | null
          amount_needed: number | null
          build_to: string
          category: string
          code_life_days: number | null
          created_at: string
          id: string
          is_pulled: boolean
          item_name: string
          report_alias: string | null
          store_id: string
        }
        Insert: {
          amount_have?: number | null
          amount_needed?: number | null
          build_to: string
          category: string
          code_life_days?: number | null
          created_at?: string
          id?: string
          is_pulled?: boolean
          item_name: string
          report_alias?: string | null
          store_id: string
        }
        Update: {
          amount_have?: number | null
          amount_needed?: number | null
          build_to?: string
          category?: string
          code_life_days?: number | null
          created_at?: string
          id?: string
          is_pulled?: boolean
          item_name?: string
          report_alias?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string | null
          grace_period_ends_at: string | null
          id: string
          org_id: string
          status: string
          welcome_phrase: string
        }
        Insert: {
          created_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          org_id: string
          status?: string
          welcome_phrase: string
        }
        Update: {
          created_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          org_id?: string
          status?: string
          welcome_phrase?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_stations: {
        Row: {
          id: string
          created_at: string
          org_id: string
          name: string
          emoji: string
          description: string | null
          is_supervisor_only: boolean
          is_float: boolean
          display_order: number
        }
        Insert: {
          id?: string
          created_at?: string
          org_id: string
          name: string
          emoji?: string
          description?: string | null
          is_supervisor_only?: boolean
          is_float?: boolean
          display_order?: number
        }
        Update: {
          id?: string
          created_at?: string
          org_id?: string
          name?: string
          emoji?: string
          description?: string | null
          is_supervisor_only?: boolean
          is_float?: boolean
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_stations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          brand_name: string | null
          brand_color: string | null
          logo_url: string | null
          terminology: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          brand_name?: string | null
          brand_color?: string | null
          logo_url?: string | null
          terminology?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          brand_name?: string | null
          brand_color?: string | null
          logo_url?: string | null
          terminology?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_uid: string | null
          burn_cards: number | null
          created_at: string
          current_store_id: string | null
          display_name: string
          eeid: string
          id: string
          lifetime_burn_cards: number | null
          org_id: string | null
          role: string
          role_rank: number | null
        }
        Insert: {
          auth_uid?: string | null
          burn_cards?: number | null
          created_at?: string
          current_store_id?: string | null
          display_name?: string
          eeid: string
          id: string
          lifetime_burn_cards?: number | null
          org_id?: string | null
          role?: string
          role_rank?: number | null
        }
        Update: {
          auth_uid?: string | null
          burn_cards?: number | null
          created_at?: string
          current_store_id?: string | null
          display_name?: string
          eeid?: string
          id?: string
          lifetime_burn_cards?: number | null
          org_id?: string | null
          role?: string
          role_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_store_id_fkey"
            columns: ["current_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          associate_id: string
          created_at: string
          end_time: string
          id: string
          shift_date: string
          start_time: string
          store_id: string
        }
        Insert: {
          associate_id: string
          created_at?: string
          end_time: string
          id?: string
          shift_date?: string
          start_time: string
          store_id: string
        }
        Update: {
          associate_id?: string
          created_at?: string
          end_time?: string
          id?: string
          shift_date?: string
          start_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_states: {
        Row: {
          created_at: string
          end_time_ms: number
          id: string
          is_open: boolean
          is_truck_night: boolean
          shift_name: string
          start_time_ms: number
          store_id: string
        }
        Insert: {
          created_at?: string
          end_time_ms?: number
          id?: string
          is_open?: boolean
          is_truck_night?: boolean
          shift_name: string
          start_time_ms: number
          store_id: string
        }
        Update: {
          created_at?: string
          end_time_ms?: number
          id?: string
          is_open?: boolean
          is_truck_night?: boolean
          shift_name?: string
          start_time_ms?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_states_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          activated_at: string | null
          billing_status: string
          created_at: string
          id: string
          license_id: string | null
          org_id: string
          store_number: string
          timezone: string
        }
        Insert: {
          activated_at?: string | null
          billing_status?: string
          created_at?: string
          id?: string
          license_id?: string | null
          org_id: string
          store_number: string
          timezone?: string
        }
        Update: {
          activated_at?: string | null
          billing_status?: string
          created_at?: string
          id?: string
          license_id?: string | null
          org_id?: string
          store_number?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      table_items: {
        Row: {
          created_at: string
          id: string
          is_initialed: boolean
          item_name: string
          station: string
          store_id: string
          waste_amount: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_initialed?: boolean
          item_name: string
          station: string
          store_id: string
          waste_amount?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_initialed?: boolean
          item_name?: string
          station?: string
          store_id?: string
          waste_amount?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pull_events: {
        Row: {
          id: string
          created_at: string
          store_id: string
          item_id: string
          item_name: string
          category: string
          quantity_pulled: number
          pulled_date: string
          expires_date: string
          is_verified: boolean
          waste_quantity: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          store_id: string
          item_id: string
          item_name: string
          category: string
          quantity_pulled: number
          pulled_date: string
          expires_date: string
          is_verified?: boolean
          waste_quantity?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          store_id?: string
          item_id?: string
          item_name?: string
          category?: string
          quantity_pulled?: number
          pulled_date?: string
          expires_date?: string
          is_verified?: boolean
          waste_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pull_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archetype: string
          assigned_to: string | null
          assigned_to_associate_id: string | null
          base_points: number
          completed_by: string | null
          created_at: string
          expected_minutes: number | null
          id: string
          is_completed: boolean
          is_orphaned: boolean
          is_pull_task: boolean
          is_sticky: boolean
          is_truck_task: boolean
          pending_verification: boolean
          priority: string
          pull_category: string | null
          queue_position: number | null
          report_alias: string | null
          sop_content: string | null
          started_at: string | null
          store_id: string
          task_description: string | null
          task_name: string
        }
        Insert: {
          archetype: string
          assigned_to?: string | null
          assigned_to_associate_id?: string | null
          base_points?: number
          completed_by?: string | null
          created_at?: string
          expected_minutes?: number | null
          id?: string
          is_completed?: boolean
          is_orphaned?: boolean
          is_pull_task?: boolean
          is_sticky?: boolean
          is_truck_task?: boolean
          pending_verification?: boolean
          priority?: string
          pull_category?: string | null
          queue_position?: number | null
          report_alias?: string | null
          sop_content?: string | null
          started_at?: string | null
          store_id: string
          task_description?: string | null
          task_name: string
        }
        Update: {
          archetype?: string
          assigned_to?: string | null
          assigned_to_associate_id?: string | null
          base_points?: number
          completed_by?: string | null
          created_at?: string
          expected_minutes?: number | null
          id?: string
          is_completed?: boolean
          is_orphaned?: boolean
          is_pull_task?: boolean
          is_sticky?: boolean
          is_truck_task?: boolean
          pending_verification?: boolean
          priority?: string
          pull_category?: string | null
          queue_position?: number | null
          report_alias?: string | null
          sop_content?: string | null
          started_at?: string | null
          store_id?: string
          task_description?: string | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      task_verifications: {
        Row: {
          id: string
          store_id: string
          task_id: string
          associate_id: string
          expected_minutes: number
          actual_minutes: number
          delta_pct: number
          trigger_type: string
          status: string
          associate_photo_url: string | null
          supervisor_id: string | null
          supervisor_verdict: string | null
          supervisor_photo_url: string | null
          rejection_reason: string | null
          associate_response: string | null
          challenge_submitted: boolean
          challenge_resolved: boolean
          store_manager_id: string | null
          store_manager_verdict: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          task_id: string
          associate_id: string
          expected_minutes: number
          actual_minutes: number
          delta_pct: number
          trigger_type: string
          status?: string
          associate_photo_url?: string | null
          supervisor_id?: string | null
          supervisor_verdict?: string | null
          supervisor_photo_url?: string | null
          rejection_reason?: string | null
          associate_response?: string | null
          challenge_submitted?: boolean
          challenge_resolved?: boolean
          store_manager_id?: string | null
          store_manager_verdict?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          task_id?: string
          associate_id?: string
          expected_minutes?: number
          actual_minutes?: number
          delta_pct?: number
          trigger_type?: string
          status?: string
          associate_photo_url?: string | null
          supervisor_id?: string | null
          supervisor_verdict?: string | null
          supervisor_photo_url?: string | null
          rejection_reason?: string | null
          associate_response?: string | null
          challenge_submitted?: boolean
          challenge_resolved?: boolean
          store_manager_id?: string | null
          store_manager_verdict?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      task_time_suggestions: {
        Row: {
          id: string
          store_id: string
          task_id: string
          task_name: string
          current_expected_minutes: number
          suggested_minutes: number
          avg_actual_minutes: number
          sample_count: number
          is_reviewed: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          task_id: string
          task_name?: string
          current_expected_minutes: number
          suggested_minutes: number
          avg_actual_minutes: number
          sample_count?: number
          is_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          task_id?: string
          task_name?: string
          current_expected_minutes?: number
          suggested_minutes?: number
          avg_actual_minutes?: number
          sample_count?: number
          is_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      slow_completion_reasons: {
        Row: {
          id: string
          store_id: string
          task_id: string
          associate_id: string
          reason_category: string
          reason_notes: string | null
          actual_minutes: number
          expected_minutes: number
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          task_id: string
          associate_id: string
          reason_category: string
          reason_notes?: string | null
          actual_minutes: number
          expected_minutes: number
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          task_id?: string
          associate_id?: string
          reason_category?: string
          reason_notes?: string | null
          actual_minutes?: number
          expected_minutes?: number
          created_at?: string
        }
        Relationships: []
      }
      shift_results: {
        Row: {
          id: string
          associate_id: string
          burn_cards_earned: number
          store_id: string
          shift_bucket: string
          shift_date: string
          tasks_completed: number
          tasks_orphaned: number
          tasks_total: number
          completion_pct: number | null
          benchmark: string
          is_kill_leader: boolean
          created_at: string
        }
        Insert: {
          id?: string
          associate_id: string
          burn_cards_earned?: number
          store_id: string
          shift_bucket: string
          shift_date: string
          tasks_completed: number
          tasks_orphaned?: number
          tasks_total: number
          completion_pct?: number | null
          benchmark?: string
          is_kill_leader?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          associate_id?: string
          burn_cards_earned?: number
          store_id?: string
          shift_bucket?: string
          shift_date?: string
          tasks_completed?: number
          tasks_orphaned?: number
          tasks_total?: number
          completion_pct?: number | null
          benchmark?: string
          is_kill_leader?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_burn_cards: { Args: { associate_id: string }; Returns: void }
      user_org_id: { Args: never; Returns: string }
      user_store_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
