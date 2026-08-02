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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_tag: string
          assigned_to_id: string | null
          id: string
          name: string
          purchased_at: string | null
          status: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          warranty_expires_at: string | null
        }
        Insert: {
          asset_tag: string
          assigned_to_id?: string | null
          id?: string
          name: string
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          warranty_expires_at?: string | null
        }
        Update: {
          asset_tag?: string
          assigned_to_id?: string | null
          id?: string
          name?: string
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          employee_no: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          employee_no: string
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          employee_no?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          owner_id: string
          starts_at: string
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          owner_id: string
          starts_at: string
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          owner_id?: string
          starts_at?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dashboard_recent_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["roles"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["roles"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["roles"]
          updated_at?: string
        }
        Relationships: []
      }
      slas: {
        Row: {
          first_response_minutes: number
          id: string
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
        }
        Insert: {
          first_response_minutes: number
          id?: string
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
        }
        Update: {
          first_response_minutes?: number
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          original_filename: string
          size_bytes: number | null
          storage_path: string
          tickets_id: string
          uploaded_by_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          original_filename: string
          size_bytes?: number | null
          storage_path: string
          tickets_id: string
          uploaded_by_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          original_filename?: string
          size_bytes?: number | null
          storage_path?: string
          tickets_id?: string
          uploaded_by_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_tickets_id_fkey"
            columns: ["tickets_id"]
            isOneToOne: false
            referencedRelation: "dashboard_recent_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_tickets_id_fkey"
            columns: ["tickets_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          code: string
          default_priority: Database["public"]["Enums"]["ticket_priority"]
          default_sla_id: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          code: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          default_sla_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          default_sla_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_default_sla_id_fkey"
            columns: ["default_sla_id"]
            isOneToOne: false
            referencedRelation: "slas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dashboard_tickets_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "ticket_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dashboard_recent_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_number_counters: {
        Row: {
          category_id: string
          last_value: number
          year: number
        }
        Insert: {
          category_id: string
          last_value?: number
          year: number
        }
        Update: {
          category_id?: string
          last_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_number_counters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dashboard_tickets_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "ticket_number_counters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_by_employee_id: string | null
          changed_by_profile_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ticket_status"] | null
          id: string
          note: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          changed_by_employee_id?: string | null
          changed_by_profile_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          changed_by_employee_id?: string | null
          changed_by_profile_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_changed_by_employee_id_fkey"
            columns: ["changed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dashboard_recent_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dashboard_recent_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assigned_to_id: string | null
          category_id: string
          closed_at: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          description: string
          due_at: string | null
          first_response_at: string | null
          first_response_due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolved_at: string | null
          source: Database["public"]["Enums"]["ticket_source"]
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to_id?: string | null
          category_id: string
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          description: string
          due_at?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolved_at?: string | null
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to_id?: string | null
          category_id?: string
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          description?: string
          due_at?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id?: string
          resolved_at?: string | null
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dashboard_tickets_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_recent_activity: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_recent_tickets: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_number: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dashboard_tickets_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_ticket_counts: {
        Row: {
          approaching_sla_count: number | null
          breached_sla_count: number | null
          in_progress_count: number | null
          open_count: number | null
        }
        Relationships: []
      }
      dashboard_tickets_by_category: {
        Row: {
          category_id: string | null
          category_name: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
      dashboard_tickets_opened_daily: {
        Row: {
          day: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          ticket_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_ticket: {
        Args: {
          p_agent_id: string
          p_method: string
          p_rule_id?: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      can_act_on_ticket: { Args: { _ticket_id: string }; Returns: boolean }
      can_edit_event: { Args: { _event_id: string }; Returns: boolean }
      can_view_ticket: { Args: { _ticket_id: string }; Returns: boolean }
      close_ticket_via_qr: {
        Args: { _scanned_employee_no: string; _ticket_id: string }
        Returns: undefined
      }
      confirm_ticket_creation_via_qr: {
        Args: { _scanned_employee_no: string; _ticket_id: string }
        Returns: undefined
      }
      current_department: { Args: never; Returns: string }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["roles"]
      }
      expire_stale_pending_tickets: {
        Args: { cutoff?: string }
        Returns: number
      }
      get_caller_department: { Args: never; Returns: string }
      get_caller_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      override_close_ticket: {
        Args: { _reason?: string; _ticket_id: string }
        Returns: undefined
      }
      sync_employee_record: {
        Args: {
          _department: string
          _email?: string
          _employee_no: string
          _full_name: string
        }
        Returns: {
          created_at: string
          department: string | null
          email: string | null
          employee_no: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_scanned_employee: {
        Args: { _scanned_employee_no: string; _ticket_id: string }
        Returns: string
      }
    }
    Enums: {
      asset_status: "active" | "retired" | "in_repair"
      asset_type:
        | "laptop"
        | "desktop"
        | "monitor"
        | "printer"
        | "phone"
        | "other"
      event_type:
        | "maintenance"
        | "outage"
        | "site_visit"
        | "staff_availability"
        | "other"
      roles: "agent" | "admin" | "manager"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_source: "web" | "email" | "phone" | "other"
      ticket_status:
        | "pending_confirmation"
        | "open"
        | "in_progress"
        | "on_hold"
        | "resolved"
        | "closed"
        | "reopened"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_status: ["active", "retired", "in_repair"],
      asset_type: ["laptop", "desktop", "monitor", "printer", "phone", "other"],
      event_type: [
        "maintenance",
        "outage",
        "site_visit",
        "staff_availability",
        "other",
      ],
      roles: ["agent", "admin", "manager"],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_source: ["web", "email", "phone", "other"],
      ticket_status: [
        "pending_confirmation",
        "open",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "reopened",
        "cancelled",
      ],
    },
  },
} as const
