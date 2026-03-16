// ============================================
// ADC Delivery System — Shared TypeScript Types
// Used by: apps/web, apps/mobile (via codegen)
// ============================================

// ---- Roles ----
export type UserRole =
  | 'super_admin'
  | 'coordinator'
  | 'sales'
  | 'manager'
  | 'delivery'

// ---- Profiles ----
export interface Profile {
  id:            string
  email:         string | null
  full_name:     string | null
  phone:         string | null
  avatar_url:    string | null
  role:          UserRole | null
  is_approved:   boolean
  // Delivery-specific fields
  vehicle_plate: string | null
  vehicle_type:  string | null
  home_address:  string | null
  created_at:    string
}

// ---- Delivery Routes (Tuyến Giao nhận) ----
export interface DeliveryRoute {
  id:          string
  name:        string
  color:       string
  description: string | null
  created_by:  string | null
  created_at:  string
}

// ---- Locations ----
export interface Location {
  id:         string
  name:       string
  phone:      string | null
  address:    string
  lat:        number | null
  lng:        number | null
  note:       string | null
  route_id:   string | null
  created_by: string | null
  created_at: string
}

// ---- Orders ----
export type OrderType   = 'delivery' | 'pickup' | 'mixed'
export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'staging'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id:                   string
  code:                 string
  pickup_location_id:   string
  delivery_location_id: string
  pickup_location?:     Location
  delivery_location?:   Location
  type:                 OrderType
  status:               OrderStatus
  note:                 string | null
  proof_photo_url:      string | null
  delivery_proof_url:   string | null
  assigned_to:          string | null
  assigned_driver?:     Profile | null
  coordinated_by:       string | null
  trip_id:              string | null
  scheduled_at:         string | null
  delivered_at:         string | null
  rejection_note:       string | null
  created_at:           string
}

// ---- Trips ----
export type TripStatus = 'planned' | 'active' | 'completed'

export interface RouteStop {
  orderId:    string
  locationId: string
  type:       'pickup' | 'delivery'
  lat:        number
  lng:        number
  sequence:   number
  eta?:       string
}

export interface Trip {
  id:               string
  driver_id:        string | null
  driver?:          Profile | null
  status:           TripStatus
  optimized_route:  RouteStop[] | null
  route_cache_key:  string | null
  started_at:       string | null
  completed_at:     string | null
  created_at:       string
  orders?:          Order[]
}

// ---- Driver Locations (Realtime Broadcast) ----
export interface DriverLocationPayload {
  driverId: string
  lat:      number
  lng:      number
  bearing:  number
  ts:       number   // Unix timestamp ms
}

// ---- Order Tracking Log ----
export interface OrderTrackingLog {
  id:        number
  order_id:  string
  driver_id: string | null
  status:    OrderStatus
  lat:       number | null
  lng:       number | null
  note:      string | null
  logged_at: string
}

// ---- Order Events ----
export type OrderEventType =
  | 'created'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 're_routed'
  | 'cancelled'
  | 'rejected'

export interface OrderEvent {
  id:         string
  order_id:   string
  actor_id:   string | null
  event_type: OrderEventType
  metadata:   Record<string, unknown> | null
  created_at: string
}

// ---- Supabase DB type placeholder ----
// Replace with generated types after: `supabase gen types typescript`
export type Database = Record<string, unknown>
