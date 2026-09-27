// Tipos do banco. Escritos à mão a partir de supabase/migrations.
// Para regenerar a partir do projeto na nuvem:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export type FulfillmentType = 'delivery' | 'pickup'
export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'
export type PaymentMethod = 'pix_on_delivery' | 'cash' | 'card_on_delivery'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'not_applicable'

type StoreSettingsRow = {
  id: boolean
  name: string
  tagline: string | null
  logo_path: string | null
  whatsapp: string
  pickup_address: string | null
  instagram_handle: string | null
  is_open_switch: boolean
  min_order_cents: number
  custom_intro: string | null
  custom_min_quantity: number | null
  custom_min_lead_days: number | null
  updated_at: string
}

type OpeningHoursRow = {
  weekday: number
  is_closed: boolean
  opens: string | null
  closes: string | null
}

type WhatsappTemplateRow = { status: OrderStatus; body: string; updated_at: string }

type CategoryRow = {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
} & Timestamps

type ProductRow = {
  id: string
  category_id: string
  name: string
  description: string | null
  price_cents: number
  image_path: string | null
  sort_order: number
  is_active: boolean
  is_available: boolean
} & Timestamps

type DeliveryZoneRow = {
  id: string
  neighborhood: string
  fee_cents: number
  sort_order: number
  is_active: boolean
} & Timestamps

type OrderRow = {
  id: string
  number: number
  customer_name: string
  customer_phone: string
  fulfillment: FulfillmentType
  delivery_zone_id: string | null
  zone_name_snapshot: string | null
  cep: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  address_reference: string | null
  subtotal_cents: number
  delivery_fee_cents: number
  total_cents: number
  payment_method: PaymentMethod
  change_for_cents: number | null
  payment_status: PaymentStatus
  payment_provider: string | null
  payment_reference: string | null
  notes: string | null
  status: OrderStatus
  wants_whatsapp_updates: boolean
  ip_hash: string | null
} & Timestamps

type OrderItemRow = {
  id: string
  order_id: string
  product_id: string | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  note: string | null
  sort_order: number
}

type OrderStatusHistoryRow = {
  id: number
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  changed_by: string | null
  changed_at: string
}

type CustomFlavorRow = {
  id: string
  name: string
  description: string | null
  image_path: string | null
  highlights: string[]
  sort_order: number
  is_active: boolean
} & Timestamps

type CustomGalleryRow = {
  id: string
  image_path: string
  caption: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

type AdminUserRow = { user_id: string; created_at: string }

/** Monta Row/Insert/Update: `Req` são as colunas obrigatórias no insert. */
type Table<Row, Req extends keyof Row, Rel = []> = {
  Row: Row
  Insert: Pick<Row, Req> & Partial<Omit<Row, Req>>
  Update: Partial<Row>
  Relationships: Rel
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      store_settings: Table<StoreSettingsRow, 'name' | 'whatsapp'>
      opening_hours: Table<OpeningHoursRow, 'weekday'>
      whatsapp_templates: Table<WhatsappTemplateRow, 'status' | 'body'>
      categories: Table<CategoryRow, 'name' | 'slug'>
      products: Table<
        ProductRow,
        'category_id' | 'name' | 'price_cents',
        [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      >
      delivery_zones: Table<DeliveryZoneRow, 'neighborhood' | 'fee_cents'>
      orders: Table<
        OrderRow,
        | 'customer_name'
        | 'customer_phone'
        | 'fulfillment'
        | 'subtotal_cents'
        | 'total_cents'
        | 'payment_method'
      >
      order_items: Table<
        OrderItemRow,
        'order_id' | 'name_snapshot' | 'unit_price_cents' | 'quantity' | 'line_total_cents',
        [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      >
      order_status_history: Table<
        OrderStatusHistoryRow,
        'order_id' | 'to_status',
        [
          {
            foreignKeyName: 'order_status_history_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      >
      custom_flavors: Table<CustomFlavorRow, 'name'>
      custom_gallery: Table<CustomGalleryRow, 'image_path'>
      admin_users: Table<AdminUserRow, 'user_id'>
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_store_open_now: { Args: never; Returns: boolean }
      create_order: { Args: { payload: Json }; Returns: Json }
    }
    Enums: {
      fulfillment_type: FulfillmentType
      order_status: OrderStatus
      payment_method: PaymentMethod
      payment_status: PaymentStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']
