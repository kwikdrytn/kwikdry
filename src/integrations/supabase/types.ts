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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      call_log: {
        Row: {
          answered_by: string | null
          booking_job_id: string | null
          booking_service_type: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["call_direction"]
          duration_seconds: number | null
          ended_at: string | null
          from_number: string
          id: string
          linked_job_id: string | null
          local_recording_path: string | null
          location_id: string
          match_confidence:
            | Database["public"]["Enums"]["match_confidence"]
            | null
          matched_customer_id: string | null
          matched_customer_name: string | null
          matched_customer_phone: string | null
          notes: string | null
          organization_id: string
          rc_call_id: string
          recording_downloaded: boolean | null
          recording_duration_seconds: number | null
          recording_url: string | null
          resulted_in_booking: boolean | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          synced_at: string | null
          to_number: string
        }
        Insert: {
          answered_by?: string | null
          booking_job_id?: string | null
          booking_service_type?: string | null
          created_at?: string | null
          direction: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number | null
          ended_at?: string | null
          from_number: string
          id?: string
          linked_job_id?: string | null
          local_recording_path?: string | null
          location_id: string
          match_confidence?:
            | Database["public"]["Enums"]["match_confidence"]
            | null
          matched_customer_id?: string | null
          matched_customer_name?: string | null
          matched_customer_phone?: string | null
          notes?: string | null
          organization_id: string
          rc_call_id: string
          recording_downloaded?: boolean | null
          recording_duration_seconds?: number | null
          recording_url?: string | null
          resulted_in_booking?: boolean | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          synced_at?: string | null
          to_number: string
        }
        Update: {
          answered_by?: string | null
          booking_job_id?: string | null
          booking_service_type?: string | null
          created_at?: string | null
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string
          id?: string
          linked_job_id?: string | null
          local_recording_path?: string | null
          location_id?: string
          match_confidence?:
            | Database["public"]["Enums"]["match_confidence"]
            | null
          matched_customer_id?: string | null
          matched_customer_name?: string | null
          matched_customer_phone?: string | null
          notes?: string | null
          organization_id?: string
          rc_call_id?: string
          recording_downloaded?: boolean | null
          recording_duration_seconds?: number | null
          recording_url?: string | null
          resulted_in_booking?: boolean | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          synced_at?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_log_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "call_log_booking_job_id_fkey"
            columns: ["booking_job_id"]
            isOneToOne: false
            referencedRelation: "hcp_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_linked_job_id_fkey"
            columns: ["linked_job_id"]
            isOneToOne: false
            referencedRelation: "hcp_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_metrics_daily: {
        Row: {
          avg_call_duration_seconds: number | null
          booking_rate: number | null
          bookings_by_service: Json | null
          bookings_by_zone: Json | null
          calls_by_hour: Json | null
          calls_resulted_in_booking: number | null
          created_at: string | null
          id: string
          location_id: string
          metric_date: string
          organization_id: string
          total_completed: number | null
          total_inbound: number | null
          total_missed: number | null
          total_outbound: number | null
          total_talk_time_seconds: number | null
          total_voicemail: number | null
          updated_at: string | null
        }
        Insert: {
          avg_call_duration_seconds?: number | null
          booking_rate?: number | null
          bookings_by_service?: Json | null
          bookings_by_zone?: Json | null
          calls_by_hour?: Json | null
          calls_resulted_in_booking?: number | null
          created_at?: string | null
          id?: string
          location_id: string
          metric_date: string
          organization_id: string
          total_completed?: number | null
          total_inbound?: number | null
          total_missed?: number | null
          total_outbound?: number | null
          total_talk_time_seconds?: number | null
          total_voicemail?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_call_duration_seconds?: number | null
          booking_rate?: number | null
          bookings_by_service?: Json | null
          bookings_by_zone?: Json | null
          calls_by_hour?: Json | null
          calls_resulted_in_booking?: number | null
          created_at?: string | null
          id?: string
          location_id?: string
          metric_date?: string
          organization_id?: string
          total_completed?: number | null
          total_inbound?: number | null
          total_missed?: number | null
          total_outbound?: number | null
          total_talk_time_seconds?: number | null
          total_voicemail?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_metrics_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_metrics_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          item_key: string
          notes: string | null
          submission_id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          item_key: string
          notes?: string | null
          submission_id: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          item_key?: string
          notes?: string | null
          submission_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_submissions: {
        Row: {
          id: string
          location_id: string
          notes: string | null
          period_date: string
          status: Database["public"]["Enums"]["checklist_status"] | null
          submitted_at: string | null
          technician_id: string
          template_id: string
        }
        Insert: {
          id?: string
          location_id: string
          notes?: string | null
          period_date?: string
          status?: Database["public"]["Enums"]["checklist_status"] | null
          submitted_at?: string | null
          technician_id: string
          template_id: string
        }
        Update: {
          id?: string
          location_id?: string
          notes?: string | null
          period_date?: string
          status?: Database["public"]["Enums"]["checklist_status"] | null
          submitted_at?: string | null
          technician_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "checklist_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["checklist_frequency"]
          id: string
          is_active: boolean | null
          items_json: Json
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          frequency: Database["public"]["Enums"]["checklist_frequency"]
          id?: string
          is_active?: boolean | null
          items_json?: Json
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["checklist_frequency"]
          id?: string
          is_active?: boolean | null
          items_json?: Json
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          location_id: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"] | null
          type: string
          updated_at: string | null
          warranty_expiry: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          location_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"] | null
          type: string
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          location_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"] | null
          type?: string
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "equipment_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          cost: number | null
          created_at: string | null
          description: string
          equipment_id: string
          id: string
          next_due: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          type: Database["public"]["Enums"]["maintenance_type"]
          vendor: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          description: string
          equipment_id: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at: string
          performed_by?: string | null
          type: Database["public"]["Enums"]["maintenance_type"]
          vendor?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          description?: string
          equipment_id?: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      equipment_photos: {
        Row: {
          created_at: string
          equipment_id: string
          file_path: string
          id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          file_path: string
          id?: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          file_path?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_photos_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      export_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          expires_at: string | null
          export_type: Database["public"]["Enums"]["export_type"]
          file_size_bytes: number | null
          file_url: string | null
          filters: Json | null
          id: string
          organization_id: string
          requested_by: string
          status: Database["public"]["Enums"]["processing_status"] | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type: Database["public"]["Enums"]["export_type"]
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          organization_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["processing_status"] | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type?: Database["public"]["Enums"]["export_type"]
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          organization_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["processing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "export_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      hcp_customers: {
        Row: {
          address: string | null
          city: string | null
          email: string | null
          hcp_customer_id: string
          id: string
          name: string
          organization_id: string
          phone_numbers: Json | null
          service_zone_id: string | null
          state: string | null
          synced_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          email?: string | null
          hcp_customer_id: string
          id?: string
          name: string
          organization_id: string
          phone_numbers?: Json | null
          service_zone_id?: string | null
          state?: string | null
          synced_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          email?: string | null
          hcp_customer_id?: string
          id?: string
          name?: string
          organization_id?: string
          phone_numbers?: Json | null
          service_zone_id?: string | null
          state?: string | null
          synced_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcp_customers_service_zone_id_fkey"
            columns: ["service_zone_id"]
            isOneToOne: false
            referencedRelation: "hcp_service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      hcp_employees: {
        Row: {
          email: string | null
          hcp_employee_id: string
          id: string
          linked_user_id: string | null
          name: string
          organization_id: string
          phone: string | null
          synced_at: string | null
        }
        Insert: {
          email?: string | null
          hcp_employee_id: string
          id?: string
          linked_user_id?: string | null
          name: string
          organization_id: string
          phone?: string | null
          synced_at?: string | null
        }
        Update: {
          email?: string | null
          hcp_employee_id?: string
          id?: string
          linked_user_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_employees_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcp_employees_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "hcp_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hcp_jobs: {
        Row: {
          address: string | null
          city: string | null
          customer_hcp_id: string | null
          customer_name: string | null
          hcp_job_id: string
          id: string
          lat: number | null
          lng: number | null
          location_id: string | null
          notes: string | null
          organization_id: string
          scheduled_date: string | null
          scheduled_end: string | null
          scheduled_time: string | null
          services: Json | null
          state: string | null
          status: string | null
          synced_at: string | null
          technician_hcp_id: string | null
          technician_name: string | null
          total_amount: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          customer_hcp_id?: string | null
          customer_name?: string | null
          hcp_job_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          notes?: string | null
          organization_id: string
          scheduled_date?: string | null
          scheduled_end?: string | null
          scheduled_time?: string | null
          services?: Json | null
          state?: string | null
          status?: string | null
          synced_at?: string | null
          technician_hcp_id?: string | null
          technician_name?: string | null
          total_amount?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          customer_hcp_id?: string | null
          customer_name?: string | null
          hcp_job_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          scheduled_date?: string | null
          scheduled_end?: string | null
          scheduled_time?: string | null
          services?: Json | null
          state?: string | null
          status?: string | null
          synced_at?: string | null
          technician_hcp_id?: string | null
          technician_name?: string | null
          total_amount?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcp_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hcp_service_zones: {
        Row: {
          color: string | null
          hcp_zone_id: string
          id: string
          name: string
          organization_id: string
          polygon_geojson: Json | null
          synced_at: string | null
        }
        Insert: {
          color?: string | null
          hcp_zone_id: string
          id?: string
          name: string
          organization_id: string
          polygon_geojson?: Json | null
          synced_at?: string | null
        }
        Update: {
          color?: string | null
          hcp_zone_id?: string
          id?: string
          name?: string
          organization_id?: string
          polygon_geojson?: Json | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_service_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hcp_services: {
        Row: {
          description: string | null
          hcp_service_id: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          price: number | null
          synced_at: string | null
        }
        Insert: {
          description?: string | null
          hcp_service_id: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          price?: number | null
          synced_at?: string | null
        }
        Update: {
          description?: string | null
          hcp_service_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          price?: number | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string | null
          deleted_at: string | null
          description: string | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          par_level: number | null
          reorder_threshold: number
          unit: Database["public"]["Enums"]["inventory_unit"]
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          par_level?: number | null
          reorder_threshold?: number
          unit: Database["public"]["Enums"]["inventory_unit"]
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          par_level?: number | null
          reorder_threshold?: number
          unit?: Database["public"]["Enums"]["inventory_unit"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          deleted_at: string | null
          id: string
          item_id: string
          last_counted: string | null
          location_id: string
          quantity: number
          technician_id: string | null
          updated_at: string | null
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          item_id: string
          last_counted?: string | null
          location_id: string
          quantity?: number
          technician_id?: string | null
          updated_at?: string | null
        }
        Update: {
          deleted_at?: string | null
          id?: string
          item_id?: string
          last_counted?: string | null
          location_id?: string
          quantity?: number
          technician_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_location_id: string | null
          from_technician_id: string | null
          id: string
          item_id: string
          location_id: string
          notes: string | null
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          technician_id: string | null
          to_location_id: string | null
          to_technician_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          from_technician_id?: string | null
          id?: string
          item_id: string
          location_id: string
          notes?: string | null
          quantity: number
          quantity_after?: number | null
          quantity_before?: number | null
          technician_id?: string | null
          to_location_id?: string | null
          to_technician_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          from_technician_id?: string | null
          id?: string
          item_id?: string
          location_id?: string
          notes?: string | null
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          technician_id?: string | null
          to_location_id?: string | null
          to_technician_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "inventory_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_from_technician_id_fkey"
            columns: ["from_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_from_technician_id_fkey"
            columns: ["from_technician_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_summary"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_technician_id_fkey"
            columns: ["to_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_technician_id_fkey"
            columns: ["to_technician_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          phone: string | null
          state: string | null
          timezone: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          click_action: string | null
          data: Json | null
          delivered: boolean | null
          error_message: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          click_action?: string | null
          data?: Json | null
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          click_action?: string | null
          data?: Json | null
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          hcp_api_key: string | null
          hcp_company_id: string | null
          id: string
          name: string
          rc_account_id: string | null
          rc_client_id: string | null
          rc_client_secret: string | null
          rc_refresh_token: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hcp_api_key?: string | null
          hcp_company_id?: string | null
          id?: string
          name: string
          rc_account_id?: string | null
          rc_client_id?: string | null
          rc_client_secret?: string | null
          rc_refresh_token?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hcp_api_key?: string | null
          hcp_company_id?: string | null
          id?: string
          name?: string
          rc_account_id?: string | null
          rc_client_id?: string | null
          rc_client_secret?: string | null
          rc_refresh_token?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          custom_role_id: string | null
          deleted_at: string | null
          email: string | null
          fcm_token: string | null
          first_name: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          is_active: boolean | null
          last_name: string | null
          location_id: string | null
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          updated_at: string | null
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          deleted_at?: string | null
          email?: string | null
          fcm_token?: string | null
          first_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          location_id?: string | null
          organization_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string | null
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          deleted_at?: string | null
          email?: string | null
          fcm_token?: string | null
          first_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          location_id?: string | null
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string | null
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          fcm_token: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          fcm_token: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          fcm_token?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_key"]
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_key"]
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_key"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          note: string
          note_type: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          note: string
          note_type?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          note?: string
          note_type?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "technician_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      technician_skills: {
        Row: {
          avg_job_duration_minutes: number | null
          created_at: string | null
          id: string
          notes: string | null
          profile_id: string
          quality_rating: number | null
          service_type: string
          skill_level: string | null
          updated_at: string | null
        }
        Insert: {
          avg_job_duration_minutes?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          quality_rating?: number | null
          service_type: string
          skill_level?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_job_duration_minutes?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          quality_rating?: number | null
          service_type?: string
          skill_level?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      training_categories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean
          last_position_seconds: number
          last_watched_at: string | null
          progress_percent: number
          updated_at: string | null
          user_id: string
          video_id: string
          watch_time_seconds: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          last_position_seconds?: number
          last_watched_at?: string | null
          progress_percent?: number
          updated_at?: string | null
          user_id: string
          video_id: string
          watch_time_seconds?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          last_position_seconds?: number
          last_watched_at?: string | null
          progress_percent?: number
          updated_at?: string | null
          user_id?: string
          video_id?: string
          watch_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "technician_checklist_compliance"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "training_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          category_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean
          is_required: boolean
          organization_id: string
          required_for_roles: string[] | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          youtube_video_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          organization_id: string
          required_for_roles?: string[] | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          youtube_video_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          organization_id?: string
          required_for_roles?: string[] | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["processing_status"] | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["processing_status"] | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["processing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_stock_summary: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"] | null
          item_id: string | null
          name: string | null
          organization_id: string | null
          par_level: number | null
          reorder_threshold: number | null
          stock_status: string | null
          total_stock: number | null
          unit: Database["public"]["Enums"]["inventory_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_checklist_compliance: {
        Row: {
          first_name: string | null
          frequency: Database["public"]["Enums"]["checklist_frequency"] | null
          last_name: string | null
          last_submission: string | null
          location_id: string | null
          organization_id: string | null
          submissions_count: number | null
          technician_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_all_technicians_scheduling_context: {
        Args: { org_id: string }
        Returns: string
      }
      get_technician_scheduling_context: {
        Args: { tech_profile_id: string }
        Returns: string
      }
      get_user_location_id: { Args: never; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_permission: {
        Args: { p_permission: Database["public"]["Enums"]["permission_key"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      restore_record: {
        Args: { p_record_id: string; p_table_name: string }
        Returns: undefined
      }
    }
    Enums: {
      audit_action: "create" | "update" | "delete" | "restore"
      call_direction: "inbound" | "outbound"
      call_status: "completed" | "missed" | "voicemail" | "rejected" | "busy"
      checklist_frequency: "daily" | "weekly"
      checklist_status: "complete" | "partial" | "flagged"
      equipment_status: "active" | "maintenance" | "retired"
      export_type:
        | "inventory_transactions"
        | "call_log"
        | "checklist_history"
        | "equipment_maintenance"
        | "audit_log"
        | "full_backup"
      inventory_category: "cleaning_solution" | "supply" | "consumable"
      inventory_unit:
        | "gallon"
        | "oz"
        | "liter"
        | "ml"
        | "each"
        | "box"
        | "case"
        | "roll"
        | "bag"
        | "16 oz"
      maintenance_type:
        | "repair"
        | "service"
        | "inspection"
        | "replacement"
        | "cleaning"
      match_confidence: "exact" | "partial" | "none"
      permission_key:
        | "dashboard.view"
        | "dashboard.view_metrics"
        | "inventory.view"
        | "inventory.manage"
        | "inventory.adjust_stock"
        | "checklists.submit"
        | "checklists.view_submissions"
        | "checklists.manage_templates"
        | "equipment.view"
        | "equipment.manage"
        | "calls.view"
        | "calls.view_metrics"
        | "calls.manage"
        | "job_map.view"
        | "job_map.use_ai_suggestions"
        | "users.view"
        | "users.manage"
        | "locations.view"
        | "locations.manage"
        | "settings.view"
        | "settings.manage_integrations"
      processing_status: "pending" | "processing" | "completed" | "failed"
      transaction_type:
        | "restock"
        | "usage"
        | "transfer"
        | "adjustment"
        | "count"
      user_role: "admin" | "call_staff" | "technician"
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
      audit_action: ["create", "update", "delete", "restore"],
      call_direction: ["inbound", "outbound"],
      call_status: ["completed", "missed", "voicemail", "rejected", "busy"],
      checklist_frequency: ["daily", "weekly"],
      checklist_status: ["complete", "partial", "flagged"],
      equipment_status: ["active", "maintenance", "retired"],
      export_type: [
        "inventory_transactions",
        "call_log",
        "checklist_history",
        "equipment_maintenance",
        "audit_log",
        "full_backup",
      ],
      inventory_category: ["cleaning_solution", "supply", "consumable"],
      inventory_unit: [
        "gallon",
        "oz",
        "liter",
        "ml",
        "each",
        "box",
        "case",
        "roll",
        "bag",
        "16 oz",
      ],
      maintenance_type: [
        "repair",
        "service",
        "inspection",
        "replacement",
        "cleaning",
      ],
      match_confidence: ["exact", "partial", "none"],
      permission_key: [
        "dashboard.view",
        "dashboard.view_metrics",
        "inventory.view",
        "inventory.manage",
        "inventory.adjust_stock",
        "checklists.submit",
        "checklists.view_submissions",
        "checklists.manage_templates",
        "equipment.view",
        "equipment.manage",
        "calls.view",
        "calls.view_metrics",
        "calls.manage",
        "job_map.view",
        "job_map.use_ai_suggestions",
        "users.view",
        "users.manage",
        "locations.view",
        "locations.manage",
        "settings.view",
        "settings.manage_integrations",
      ],
      processing_status: ["pending", "processing", "completed", "failed"],
      transaction_type: ["restock", "usage", "transfer", "adjustment", "count"],
      user_role: ["admin", "call_staff", "technician"],
    },
  },
} as const
