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
      assessments: {
        Row: {
          assessed_at: string | null
          assessed_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          recommended_scope: string | null
          site_conditions: string | null
          site_id: string
          status: Database["public"]["Enums"]["assessment_status"]
          updated_at: string
        }
        Insert: {
          assessed_at?: string | null
          assessed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          recommended_scope?: string | null
          site_conditions?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
        }
        Update: {
          assessed_at?: string | null
          assessed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          recommended_scope?: string | null
          site_conditions?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "assessments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          entity_id: string | null
          entity_table: string
          id: string
          new_value: Json
          occurred_at: string
          organization_id: string | null
          previous_value: Json
          project_id: string | null
          reason: string | null
          request_id: string | null
          source: Database["public"]["Enums"]["audit_source"]
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          entity_id?: string | null
          entity_table: string
          id?: string
          new_value?: Json
          occurred_at?: string
          organization_id?: string | null
          previous_value?: Json
          project_id?: string | null
          reason?: string | null
          request_id?: string | null
          source: Database["public"]["Enums"]["audit_source"]
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          entity_id?: string | null
          entity_table?: string
          id?: string
          new_value?: Json
          occurred_at?: string
          organization_id?: string | null
          previous_value?: Json
          project_id?: string | null
          reason?: string | null
          request_id?: string | null
          source?: Database["public"]["Enums"]["audit_source"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_forecasts: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          needed_amount: number
          needed_by_date: string
          organization_id: string
          project_id: string
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          needed_amount: number
          needed_by_date: string
          organization_id: string
          project_id: string
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          needed_amount?: number
          needed_by_date?: string
          organization_id?: string
          project_id?: string
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cash_forecasts_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_gate_overrides: {
        Row: {
          action: Database["public"]["Enums"]["cash_gate_action"]
          created_at: string
          id: string
          organization_id: string
          overridden_by: string
          project_id: string
          reason: string
        }
        Insert: {
          action: Database["public"]["Enums"]["cash_gate_action"]
          created_at?: string
          id?: string
          organization_id: string
          overridden_by: string
          project_id: string
          reason: string
        }
        Update: {
          action?: Database["public"]["Enums"]["cash_gate_action"]
          created_at?: string
          id?: string
          organization_id?: string
          overridden_by?: string
          project_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_gate_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_gate_overrides_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_gate_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_gate_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      change_orders: {
        Row: {
          client_approved_at: string | null
          client_approved_by: string | null
          client_approved_reason: string | null
          completed_at: string | null
          completed_by: string | null
          cost_impact_amount: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          funded_at: string | null
          funded_by: string | null
          id: string
          organization_id: string
          project_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_impact_days: number | null
          status: Database["public"]["Enums"]["change_order_status"]
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          client_approved_at?: string | null
          client_approved_by?: string | null
          client_approved_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost_impact_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          funded_at?: string | null
          funded_by?: string | null
          id?: string
          organization_id: string
          project_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_impact_days?: number | null
          status?: Database["public"]["Enums"]["change_order_status"]
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          client_approved_at?: string | null
          client_approved_by?: string | null
          client_approved_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost_impact_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          funded_at?: string | null
          funded_by?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_impact_days?: number | null
          status?: Database["public"]["Enums"]["change_order_status"]
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_client_approved_by_fkey"
            columns: ["client_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_funded_by_fkey"
            columns: ["funded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "change_orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      client_decisions: {
        Row: {
          change_order_id: string | null
          created_at: string
          decided_at: string | null
          decision:
            | Database["public"]["Enums"]["client_decision_outcome"]
            | null
          deleted_at: string | null
          id: string
          organization_id: string
          presented_at: string
          project_id: string
          updated_at: string
        }
        Insert: {
          change_order_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?:
            | Database["public"]["Enums"]["client_decision_outcome"]
            | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          presented_at?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          change_order_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?:
            | Database["public"]["Enums"]["client_decision_outcome"]
            | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          presented_at?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_decisions_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_amount: number
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          project_id: string
          signed_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at: string
        }
        Insert: {
          contract_amount: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          project_id: string
          signed_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at?: string
        }
        Update: {
          contract_amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          signed_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      cost_library: {
        Row: {
          category: string | null
          created_at: string
          default_unit_cost: number
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_unit_cost: number
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_unit_cost?: number
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          log_date: string
          manpower_count: number | null
          notes: string | null
          organization_id: string
          project_id: string
          reported_by: string
          updated_at: string
          weather: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          log_date: string
          manpower_count?: number | null
          notes?: string | null
          organization_id: string
          project_id: string
          reported_by: string
          updated_at?: string
          weather?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          log_date?: string
          manpower_count?: number | null
          notes?: string | null
          organization_id?: string
          project_id?: string
          reported_by?: string
          updated_at?: string
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_logs_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string
          deleted_at: string | null
          delivered_at: string
          id: string
          notes: string | null
          organization_id: string
          purchase_order_id: string
          received_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          purchase_order_id: string
          received_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_order_id?: string
          received_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          cost_library_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          estimate_id: string
          id: string
          organization_id: string
          quantity: number
          unit: string
          unit_cost: number
          unit_price: number
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          cost_library_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          estimate_id: string
          id?: string
          organization_id: string
          quantity: number
          unit: string
          unit_cost: number
          unit_price: number
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          cost_library_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          estimate_id?: string
          id?: string
          organization_id?: string
          quantity?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_cost_library_id_fkey"
            columns: ["cost_library_id"]
            isOneToOne: false
            referencedRelation: "cost_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "estimate_items_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          assessment_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          is_baseline: boolean
          notes: string | null
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["estimate_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          is_baseline?: boolean
          notes?: string | null
          organization_id: string
          project_id: string
          status?: Database["public"]["Enums"]["estimate_status"]
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_baseline?: boolean
          notes?: string | null
          organization_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["estimate_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      funding_receipts: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          deleted_at: string | null
          expected_date: string
          id: string
          invoice_id: string | null
          milestone_id: string | null
          organization_id: string
          project_id: string
          proof_path: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_date: string
          id?: string
          invoice_id?: string | null
          milestone_id?: string | null
          organization_id: string
          project_id: string
          proof_path?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_date?: string
          id?: string
          invoice_id?: string | null
          milestone_id?: string | null
          organization_id?: string
          project_id?: string
          proof_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_receipts_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      hold_point_templates: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
          work_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          work_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hold_point_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          deleted_at: string | null
          hold_point_template_id: string
          id: string
          inspected_at: string | null
          inspected_by: string | null
          notes: string | null
          organization_id: string
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          project_id: string
          status: Database["public"]["Enums"]["inspection_status"]
          updated_at: string
          work_package_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          hold_point_template_id: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          notes?: string | null
          organization_id: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
          work_package_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          hold_point_template_id?: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          notes?: string | null
          organization_id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
          work_package_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_hold_point_template_id_fkey"
            columns: ["hold_point_template_id"]
            isOneToOne: false
            referencedRelation: "hold_point_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inspections_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "inspections_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          change_order_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          due_date: string
          id: string
          issued_at: string | null
          milestone_id: string
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          change_order_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          due_date: string
          id?: string
          issued_at?: string | null
          milestone_id: string
          organization_id: string
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          change_order_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          issued_at?: string | null
          milestone_id?: string
          organization_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          organization_id: string
          project_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
          work_package_id: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          organization_id: string
          project_id: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
          work_package_id?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
          work_package_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "issues_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          budget_known: boolean
          client_id: string | null
          contact_name: string
          created_at: string
          deleted_at: string | null
          desired_start_date: string | null
          email: string | null
          estimated_value: number | null
          id: string
          lost_reason: string | null
          organization_id: string
          phone: string | null
          project_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          budget_known?: boolean
          client_id?: string | null
          contact_name: string
          created_at?: string
          deleted_at?: string | null
          desired_start_date?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lost_reason?: string | null
          organization_id: string
          phone?: string | null
          project_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          budget_known?: boolean
          client_id?: string | null
          contact_name?: string
          created_at?: string
          deleted_at?: string | null
          desired_start_date?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lost_reason?: string | null
          organization_id?: string
          phone?: string | null
          project_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item_description: string
          needed_by_date: string | null
          notes: string | null
          organization_id: string
          project_id: string
          quantity: number
          requested_by: string
          status: Database["public"]["Enums"]["material_request_status"]
          unit: string
          updated_at: string
          work_package_id: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_description: string
          needed_by_date?: string | null
          notes?: string | null
          organization_id: string
          project_id: string
          quantity: number
          requested_by: string
          status?: Database["public"]["Enums"]["material_request_status"]
          unit: string
          updated_at?: string
          work_package_id?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_description?: string
          needed_by_date?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string
          quantity?: number
          requested_by?: string
          status?: Database["public"]["Enums"]["material_request_status"]
          unit?: string
          updated_at?: string
          work_package_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "material_requests_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nonconformities: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          inspection_id: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          inspection_id: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          inspection_id?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nonconformities_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          entity_id: string | null
          entity_table: string | null
          id: string
          organization_id: string
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          organization_id: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          organization_id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          margin_floor_bp: number
          name: string
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          margin_floor_bp?: number
          name: string
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          margin_floor_bp?: number
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          invoice_id: string
          organization_id: string
          paid_at: string
          proof_path: string | null
          recorded_by: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id: string
          organization_id: string
          paid_at?: string
          proof_path?: string | null
          recorded_by: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          organization_id?: string
          paid_at?: string
          proof_path?: string | null
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          daily_log_id: string | null
          deleted_at: string | null
          file_size_bytes: number
          id: string
          organization_id: string
          project_id: string
          storage_path: string
          thumbnail_path: string
          updated_at: string
          uploaded_by: string
          work_package_id: string | null
          zone_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          daily_log_id?: string | null
          deleted_at?: string | null
          file_size_bytes: number
          id?: string
          organization_id: string
          project_id: string
          storage_path: string
          thumbnail_path: string
          updated_at?: string
          uploaded_by: string
          work_package_id?: string | null
          zone_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          daily_log_id?: string | null
          deleted_at?: string | null
          file_size_bytes?: number
          id?: string
          organization_id?: string
          project_id?: string
          storage_path?: string
          thumbnail_path?: string
          updated_at?: string
          uploaded_by?: string
          work_package_id?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "photos_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_entries: {
        Row: {
          created_at: string
          created_by: string
          daily_log_id: string
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          progress_percent: number
          project_id: string
          updated_at: string
          work_package_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          daily_log_id: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          progress_percent: number
          project_id: string
          updated_at?: string
          work_package_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_log_id?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          progress_percent?: number
          project_id?: string
          updated_at?: string
          work_package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "progress_entries_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          project_role: Database["public"]["Enums"]["project_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          project_role: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          project_role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risk_reserves: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          project_id: string
          risk_reserve_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          project_id: string
          risk_reserve_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          risk_reserve_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risk_reserves_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risk_reserves_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risk_reserves_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          site_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          target_end_date: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          site_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_end_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          site_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_end_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          deleted_at: string | null
          estimate_id: string
          id: string
          organization_id: string
          project_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          deleted_at?: string | null
          estimate_id: string
          id?: string
          organization_id: string
          project_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          deleted_at?: string | null
          estimate_id?: string
          id?: string
          organization_id?: string
          project_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          issued_by: string
          notes: string | null
          organization_id: string
          project_id: string
          updated_at: string
          vendor_id: string
          vendor_quote_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          issued_by: string
          notes?: string | null
          organization_id: string
          project_id: string
          updated_at?: string
          vendor_id: string
          vendor_quote_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          issued_by?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          updated_at?: string
          vendor_id?: string
          vendor_quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_quote_id_fkey"
            columns: ["vendor_quote_id"]
            isOneToOne: false
            referencedRelation: "vendor_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description_id: string | null
          id: string
          key: string
          name_id: string
          scope: Database["public"]["Enums"]["role_scope"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_id?: string | null
          id?: string
          key: string
          name_id: string
          scope: Database["public"]["Enums"]["role_scope"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_id?: string | null
          id?: string
          key?: string
          name_id?: string
          scope?: Database["public"]["Enums"]["role_scope"]
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          org_role: Database["public"]["Enums"]["org_role"] | null
          organization_id: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          last_seen_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"] | null
          organization_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"] | null
          organization_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_quotes: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          material_request_id: string | null
          notes: string | null
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["vendor_quote_status"]
          updated_at: string
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          material_request_id?: string | null
          notes?: string | null
          organization_id: string
          project_id: string
          status?: Database["public"]["Enums"]["vendor_quote_status"]
          updated_at?: string
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          material_request_id?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["vendor_quote_status"]
          updated_at?: string
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quotes_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_packages: {
        Row: {
          change_order_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          milestone_id: string | null
          name: string
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["work_package_status"]
          updated_at: string
          work_type: string | null
          zone_id: string | null
        }
        Insert: {
          change_order_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          milestone_id?: string | null
          name: string
          organization_id: string
          project_id: string
          status?: Database["public"]["Enums"]["work_package_status"]
          updated_at?: string
          work_type?: string | null
          zone_id?: string | null
        }
        Update: {
          change_order_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          milestone_id?: string | null
          name?: string
          organization_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["work_package_status"]
          updated_at?: string
          work_type?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_packages_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_packages_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "work_packages_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "work_packages_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
    }
    Views: {
      vw_client_progress_photo: {
        Row: {
          caption: string | null
          created_at: string | null
          photo_id: string | null
          project_id: string | null
          storage_path: string | null
          thumbnail_path: string | null
          uploaded_by_name: string | null
          zone_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "photos_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "vw_client_zone_progress"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "photos_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_client_project_overview: {
        Row: {
          actual_end_date: string | null
          contract_amount: number | null
          contract_title: string | null
          organization_id: string | null
          project_id: string | null
          project_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          target_end_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_client_timeline_event: {
        Row: {
          event_at: string | null
          event_type: string | null
          project_id: string | null
          source_id: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      vw_client_zone_progress: {
        Row: {
          progress_percent: number | null
          project_id: string | null
          zone_id: string | null
          zone_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_client_project_overview"
            referencedColumns: ["project_id"]
          },
        ]
      }
    }
    Functions: {
      fn_cash_gate_status: {
        Args: { p_project_id: string }
        Returns: Database["public"]["Enums"]["cash_gate_status"]
      }
      fn_current_org_id: { Args: never; Returns: string }
      fn_current_org_role: {
        Args: never
        Returns: Database["public"]["Enums"]["org_role"]
      }
      fn_has_project_role: {
        Args: { p_project_id: string; p_roles: string[] }
        Returns: boolean
      }
      fn_install_standard_triggers: {
        Args: { p_table: string }
        Returns: undefined
      }
      fn_override_and_issue_purchase_order: {
        Args: {
          p_amount: number
          p_description: string
          p_organization_id: string
          p_project_id: string
          p_reason: string
          p_vendor_id: string
          p_vendor_quote_id?: string
        }
        Returns: {
          amount: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          issued_by: string
          notes: string | null
          organization_id: string
          project_id: string
          updated_at: string
          vendor_id: string
          vendor_quote_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_override_and_open_work_package: {
        Args: { p_reason: string; p_work_package_id: string }
        Returns: {
          change_order_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          milestone_id: string | null
          name: string
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["work_package_status"]
          updated_at: string
          work_type: string | null
          zone_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_packages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_record_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_entity_id: string
          p_entity_table: string
          p_new?: Json
          p_previous?: Json
          p_project_id?: string
          p_reason?: string
          p_request_id?: string
        }
        Returns: string
      }
      fn_set_baseline_estimate: {
        Args: { p_estimate_id: string }
        Returns: {
          assessment_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          is_baseline: boolean
          notes: string | null
          organization_id: string
          project_id: string
          status: Database["public"]["Enums"]["estimate_status"]
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "estimates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      assessment_status: "scheduled" | "completed"
      audit_action:
        | "insert"
        | "update"
        | "status_change"
        | "delete"
        | "approve"
        | "reject"
        | "override"
        | "login"
      audit_source: "app" | "trigger" | "system"
      cash_gate_action:
        | "issue_po"
        | "open_work_package"
        | "mobilize_sub"
        | "start_variation"
        | "order_material"
      cash_gate_status: "green" | "yellow" | "red" | "overdue"
      change_order_status:
        | "draft"
        | "under_review"
        | "awaiting_client_approval"
        | "approved_unpaid"
        | "approved_funded"
        | "rejected"
        | "completed"
      client_decision_outcome: "approved" | "rejected"
      contract_status: "draft" | "active" | "completed" | "terminated"
      estimate_status: "draft" | "sent" | "accepted" | "rejected" | "superseded"
      inspection_status: "pending" | "passed" | "failed"
      invoice_status: "draft" | "issued" | "paid" | "cancelled"
      issue_severity: "low" | "medium" | "high"
      issue_status: "open" | "resolved"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "assessment_scheduled"
        | "proposal_sent"
        | "won"
        | "lost"
      material_request_status: "requested" | "fulfilled" | "cancelled"
      milestone_status: "pending" | "completed"
      notification_channel: "in_app" | "email"
      notification_status: "pending" | "sent" | "read" | "failed"
      org_role:
        | "owner"
        | "technical_director"
        | "finance"
        | "qs"
        | "procurement"
      organization_status: "active" | "suspended"
      project_role:
        | "site_coordinator"
        | "mandor"
        | "client_approver"
        | "client_viewer"
        | "supplier"
        | "subcontractor"
      project_status:
        | "planning"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      proposal_status: "draft" | "sent" | "accepted" | "rejected"
      role_scope: "organization" | "project"
      user_status: "invited" | "active" | "suspended"
      vendor_quote_status: "received" | "accepted" | "rejected"
      work_package_status: "not_started" | "in_progress" | "completed"
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
      assessment_status: ["scheduled", "completed"],
      audit_action: [
        "insert",
        "update",
        "status_change",
        "delete",
        "approve",
        "reject",
        "override",
        "login",
      ],
      audit_source: ["app", "trigger", "system"],
      cash_gate_action: [
        "issue_po",
        "open_work_package",
        "mobilize_sub",
        "start_variation",
        "order_material",
      ],
      cash_gate_status: ["green", "yellow", "red", "overdue"],
      change_order_status: [
        "draft",
        "under_review",
        "awaiting_client_approval",
        "approved_unpaid",
        "approved_funded",
        "rejected",
        "completed",
      ],
      client_decision_outcome: ["approved", "rejected"],
      contract_status: ["draft", "active", "completed", "terminated"],
      estimate_status: ["draft", "sent", "accepted", "rejected", "superseded"],
      inspection_status: ["pending", "passed", "failed"],
      invoice_status: ["draft", "issued", "paid", "cancelled"],
      issue_severity: ["low", "medium", "high"],
      issue_status: ["open", "resolved"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "assessment_scheduled",
        "proposal_sent",
        "won",
        "lost",
      ],
      material_request_status: ["requested", "fulfilled", "cancelled"],
      milestone_status: ["pending", "completed"],
      notification_channel: ["in_app", "email"],
      notification_status: ["pending", "sent", "read", "failed"],
      org_role: ["owner", "technical_director", "finance", "qs", "procurement"],
      organization_status: ["active", "suspended"],
      project_role: [
        "site_coordinator",
        "mandor",
        "client_approver",
        "client_viewer",
        "supplier",
        "subcontractor",
      ],
      project_status: [
        "planning",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      proposal_status: ["draft", "sent", "accepted", "rejected"],
      role_scope: ["organization", "project"],
      user_status: ["invited", "active", "suspended"],
      vendor_quote_status: ["received", "accepted", "rejected"],
      work_package_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
