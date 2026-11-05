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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          comment: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          reason: string
          requested_by: string | null
          revision_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason: string
          requested_by?: string | null
          revision_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string
          requested_by?: string | null
          revision_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "quote_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_fields: string[]
          created_at: string
          id: string
          record_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          record_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          record_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bom_lines: {
        Row: {
          component_code: string
          conditions: Json
          created_at: string
          description: string
          geometry_ref: string | null
          id: string
          qty_basis: string
          qty_factor: number
          sort: number
          template_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          component_code: string
          conditions?: Json
          created_at?: string
          description: string
          geometry_ref?: string | null
          id?: string
          qty_basis: string
          qty_factor?: number
          sort?: number
          template_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          component_code?: string
          conditions?: Json
          created_at?: string
          description?: string
          geometry_ref?: string | null
          id?: string
          qty_basis?: string
          qty_factor?: number
          sort?: number
          template_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bom_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_templates: {
        Row: {
          active: boolean
          code: string
          conditions: Json
          created_at: string
          geometry_ref: string | null
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          conditions?: Json
          created_at?: string
          geometry_ref?: string | null
          id?: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          conditions?: Json
          created_at?: string
          geometry_ref?: string | null
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string | null
          company_type: string
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          price_book_id: string | null
          street: string | null
          updated_at: string
          vat_number: string | null
          version: number
        }
        Insert: {
          city?: string | null
          company_type?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          price_book_id?: string | null
          street?: string | null
          updated_at?: string
          vat_number?: string | null
          version?: number
        }
        Update: {
          city?: string | null
          company_type?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          price_book_id?: string | null
          street?: string | null
          updated_at?: string
          vat_number?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "companies_price_book_id_fkey"
            columns: ["price_book_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id"]
          },
        ]
      }
      component_costs: {
        Row: {
          component_code: string
          created_at: string
          description: string | null
          id: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          component_code: string
          created_at?: string
          description?: string | null
          id?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          component_code?: string
          created_at?: string
          description?: string | null
          id?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuration_items: {
        Row: {
          configuration_id: string
          created_at: string
          data: Json
          id: string
          manual_overrides: string[]
          net_total: number | null
          price_book_version: number | null
          project_item_id: string
          status: string
          updated_at: string
          updated_by: string | null
          validation: Json
          version: number
        }
        Insert: {
          configuration_id: string
          created_at?: string
          data?: Json
          id?: string
          manual_overrides?: string[]
          net_total?: number | null
          price_book_version?: number | null
          project_item_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          validation?: Json
          version?: number
        }
        Update: {
          configuration_id?: string
          created_at?: string
          data?: Json
          id?: string
          manual_overrides?: string[]
          net_total?: number | null
          price_book_version?: number | null
          project_item_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          validation?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuration_items_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuration_items_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_rules: {
        Row: {
          active: boolean
          code: string
          conditions: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          message: string
          name: string
          params: Json
          rule_type: string
          severity: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          message?: string
          name: string
          params?: Json
          rule_type: string
          severity?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          message?: string
          name?: string
          params?: Json
          rule_type?: string
          severity?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      configurations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_primary: boolean
          name: string
          project_id: string
          source_configuration_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_primary?: boolean
          name: string
          project_id: string
          source_configuration_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          project_id?: string
          source_configuration_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "configurations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_source_configuration_id_fkey"
            columns: ["source_configuration_id"]
            isOneToOne: false
            referencedRelation: "configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          job_title: string | null
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          approval_above_percent: number | null
          created_at: string
          discount_type: string
          id: string
          label: string | null
          min_quantity: number | null
          percent: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          approval_above_percent?: number | null
          created_at?: string
          discount_type: string
          id?: string
          label?: string | null
          min_quantity?: number | null
          percent?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          approval_above_percent?: number | null
          created_at?: string
          discount_type?: string
          id?: string
          label?: string | null
          min_quantity?: number | null
          percent?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          generated_by: string | null
          id: string
          meta: Json
          project_id: string | null
          quote_revision_id: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          generated_by?: string | null
          id?: string
          meta?: Json
          project_id?: string | null
          quote_revision_id?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          generated_by?: string | null
          id?: string
          meta?: Json
          project_id?: string | null
          quote_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quote_revision_id_fkey"
            columns: ["quote_revision_id"]
            isOneToOne: false
            referencedRelation: "quote_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          action: string
          attempts: number
          connector: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          error_code: string | null
          error_message: string | null
          external_ref: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          payload: Json
          response: Json | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          attempts?: number
          connector?: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          error_code?: string | null
          error_message?: string | null
          external_ref?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          payload?: Json
          response?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          attempts?: number
          connector?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          error_code?: string | null
          error_message?: string | null
          external_ref?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          payload?: Json
          response?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      option_values: {
        Row: {
          active: boolean
          attributes: Json
          code: string
          created_at: string
          id: string
          name_en: string | null
          name_fr: string | null
          name_nl: string
          option_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          attributes?: Json
          code: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl: string
          option_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          attributes?: Json
          code?: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string
          option_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          active: boolean
          code: string
          created_at: string
          families: string[] | null
          help_text: string | null
          id: string
          input_type: string
          name_en: string | null
          name_fr: string | null
          name_nl: string
          required: boolean
          sort: number
          step: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          families?: string[] | null
          help_text?: string | null
          id?: string
          input_type?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl: string
          required?: boolean
          sort?: number
          step: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          families?: string[] | null
          help_text?: string | null
          id?: string
          input_type?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string
          required?: boolean
          sort?: number
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_book_entries: {
        Row: {
          amount: number
          component_code: string | null
          created_at: string
          entry_type: string
          height_upto: number | null
          id: string
          label: string | null
          option_code: string | null
          price_book_id: string
          system_code: string | null
          unit: string
          updated_at: string
          value_code: string | null
          width_upto: number | null
        }
        Insert: {
          amount?: number
          component_code?: string | null
          created_at?: string
          entry_type: string
          height_upto?: number | null
          id?: string
          label?: string | null
          option_code?: string | null
          price_book_id: string
          system_code?: string | null
          unit?: string
          updated_at?: string
          value_code?: string | null
          width_upto?: number | null
        }
        Update: {
          amount?: number
          component_code?: string | null
          created_at?: string
          entry_type?: string
          height_upto?: number | null
          id?: string
          label?: string | null
          option_code?: string | null
          price_book_id?: string
          system_code?: string | null
          unit?: string
          updated_at?: string
          value_code?: string | null
          width_upto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_book_entries_price_book_id_fkey"
            columns: ["price_book_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id"]
          },
        ]
      }
      price_books: {
        Row: {
          code: string
          created_at: string
          currency: string
          factor: number
          id: string
          is_default: boolean
          name: string
          parent_price_book_id: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          vat_default: number
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          factor?: number
          id?: string
          is_default?: boolean
          name: string
          parent_price_book_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          vat_default?: number
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          factor?: number
          id?: string
          is_default?: boolean
          name?: string
          parent_price_book_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          vat_default?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_books_parent_price_book_id_fkey"
            columns: ["parent_price_book_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name_en: string | null
          name_fr: string | null
          name_nl: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_config: Json
          description: string | null
          family_code: string
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_config?: Json
          description?: string | null
          family_code: string
          id?: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_config?: Json
          description?: string | null
          family_code?: string
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          project_id: string
          seq: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          project_id: string
          seq: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          project_id?: string
          seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          city: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          desired_delivery_date: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          postal_code: string | null
          project_number: string
          status: string
          street: string | null
          sync_status: string
          updated_at: string
          vat_rate: number
          version: number
        }
        Insert: {
          city?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          desired_delivery_date?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          postal_code?: string | null
          project_number?: string
          status?: string
          street?: string | null
          sync_status?: string
          updated_at?: string
          vat_rate?: number
          version?: number
        }
        Update: {
          city?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          desired_delivery_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          postal_code?: string | null
          project_number?: string
          status?: string
          street?: string | null
          sync_status?: string
          updated_at?: string
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          configuration_id: string | null
          created_at: string
          description: string
          id: string
          is_alternative: boolean
          label: string
          line_total: number
          quantity: number
          revision_id: string
          seq: number
          status: string | null
          unit_price: number
          variant_name: string | null
        }
        Insert: {
          configuration_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_alternative?: boolean
          label: string
          line_total: number
          quantity: number
          revision_id: string
          seq: number
          status?: string | null
          unit_price: number
          variant_name?: string | null
        }
        Update: {
          configuration_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_alternative?: boolean
          label?: string
          line_total?: number
          quantity?: number
          revision_id?: string
          seq?: number
          status?: string | null
          unit_price?: number
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "quote_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_revision_costs: {
        Row: {
          cost_total: number | null
          created_at: string
          margin_amount: number | null
          margin_percent: number | null
          revision_id: string
        }
        Insert: {
          cost_total?: number | null
          created_at?: string
          margin_amount?: number | null
          margin_percent?: number | null
          revision_id: string
        }
        Update: {
          cost_total?: number | null
          created_at?: string
          margin_amount?: number | null
          margin_percent?: number | null
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_revision_costs_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: true
            referencedRelation: "quote_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_revisions: {
        Row: {
          alternative_configuration_ids: string[]
          approval_reasons: string[]
          approved_at: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          discount_amount: number
          discount_percent: number
          id: string
          locked: boolean
          price_book_code: string | null
          price_book_id: string | null
          price_book_version: number | null
          primary_configuration_id: string | null
          production_ready: boolean
          quote_id: string
          requires_approval: boolean
          revision_no: number
          rules_version: number | null
          sent_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["quote_status"]
          submitted_at: string | null
          subtotal_net: number
          template_id: string | null
          total_gross: number
          total_net: number
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          alternative_configuration_ids?: string[]
          approval_reasons?: string[]
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          locked?: boolean
          price_book_code?: string | null
          price_book_id?: string | null
          price_book_version?: number | null
          primary_configuration_id?: string | null
          production_ready?: boolean
          quote_id: string
          requires_approval?: boolean
          revision_no: number
          rules_version?: number | null
          sent_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string | null
          subtotal_net?: number
          template_id?: string | null
          total_gross?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          alternative_configuration_ids?: string[]
          approval_reasons?: string[]
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          locked?: boolean
          price_book_code?: string | null
          price_book_id?: string | null
          price_book_version?: number | null
          primary_configuration_id?: string | null
          production_ready?: boolean
          quote_id?: string
          requires_approval?: boolean
          revision_no?: number
          rules_version?: number | null
          sent_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string | null
          subtotal_net?: number
          template_id?: string | null
          total_gross?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_revisions_price_book_id_fkey"
            columns: ["price_book_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revisions_primary_configuration_id_fkey"
            columns: ["primary_configuration_id"]
            isOneToOne: false
            referencedRelation: "configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revisions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revisions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          code: string
          conditions_text: string
          created_at: string
          id: string
          intro_text: string
          is_default: boolean
          name: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          code: string
          conditions_text?: string
          created_at?: string
          id?: string
          intro_text?: string
          is_default?: boolean
          name: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          code?: string
          conditions_text?: string
          created_at?: string
          id?: string
          intro_text?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          current_revision_no: number
          id: string
          project_id: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_revision_no?: number
          id?: string
          project_id: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_revision_no?: number
          id?: string
          project_id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: Database["public"]["Enums"]["app_role"]
          description: string
          name: string
          sort: number
        }
        Insert: {
          code: Database["public"]["Enums"]["app_role"]
          description: string
          name: string
          sort?: number
        }
        Update: {
          code?: Database["public"]["Enums"]["app_role"]
          description?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      rule_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          rule_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          rule_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          rule_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "configuration_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          job_id: string
          message: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          job_id: string
          message: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "integration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          families: string[]
          id: string
          material: string
          name: string
          production_ready: boolean
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          families?: string[]
          id?: string
          material: string
          name: string
          production_ready?: boolean
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          families?: string[]
          id?: string
          material?: string
          name?: string
          production_ready?: boolean
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      next_project_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "verkoper" | "productbeheerder" | "manager" | "productie"
      quote_status:
        | "concept"
        | "interne_controle"
        | "goedgekeurd"
        | "verzonden"
        | "aanvaard"
        | "afgewezen"
        | "vervallen"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["verkoper", "productbeheerder", "manager", "productie"],
      quote_status: [
        "concept",
        "interne_controle",
        "goedgekeurd",
        "verzonden",
        "aanvaard",
        "afgewezen",
        "vervallen",
      ],
    },
  },
} as const
