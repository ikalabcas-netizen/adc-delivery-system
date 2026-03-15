import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Order, OrderStatus, OrderType } from '@adc/shared-types'

const ORDERS_KEY = ['orders'] as const

interface OrderFilters {
  status?: OrderStatus
}

/**
 * Fetch orders with joined pickup/delivery locations.
 */
export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: [...ORDERS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          pickup_location:locations!orders_pickup_location_id_fkey(*),
          delivery_location:locations!orders_delivery_location_id_fkey(*),
          assigned_driver:profiles!orders_assigned_to_fkey(id, full_name, avatar_url, phone, vehicle_plate)
        `)
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Order[]
    },
    staleTime: 1000 * 30, // 30s — orders change more frequently
  })
}

interface CreateOrderInput {
  pickup_location_id: string
  delivery_location_id: string
  type?: OrderType
  note?: string
  scheduled_at?: string
}

/**
 * Create order — auto-sets coordinated_by to current user.
 */
export function useCreateOrder() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          ...input,
          type: input.type ?? 'delivery',
          coordinated_by: profile?.id ?? null,
        })
        .select(`
          *,
          pickup_location:locations!orders_pickup_location_id_fkey(*),
          delivery_location:locations!orders_delivery_location_id_fkey(*)
        `)
        .single()

      if (error) throw error
      return data as Order
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
}

/**
 * Update order status (e.g. pending → assigned, assigned → in_transit).
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, status, assigned_to }: {
      orderId: string
      status: OrderStatus
      assigned_to?: string | null
    }) => {
      const updates: Record<string, unknown> = { status }
      if (assigned_to !== undefined) updates.assigned_to = assigned_to
      if (status === 'delivered') updates.delivered_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single()

      if (error) throw error
      return data as Order
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
}

/**
 * Cancel an order.
 */
export function useCancelOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
}

/**
 * Delete an order (only pending orders should be deletable).
 */
export function useDeleteOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
}

/**
 * Fetch approved delivery drivers for assignment dropdown.
 */
export function useDeliveryDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, vehicle_plate, vehicle_type')
        .eq('is_approved', true)
        .in('role', ['delivery', 'coordinator', 'super_admin'])
        .order('full_name')

      if (error) throw error
      return data as Array<{
        id: string
        full_name: string | null
        avatar_url: string | null
        phone: string | null
        vehicle_plate: string | null
        vehicle_type: string | null
      }>
    },
    staleTime: 1000 * 60 * 5, // 5min — drivers don't change often
  })
}

