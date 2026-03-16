import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Trip, TripStatus } from '@adc/shared-types'

const TRIPS_KEY = ['trips'] as const

export interface TripFilters {
  status?: TripStatus | 'all'
  dateFrom?: string
  dateTo?: string
}

/**
 * Fetch trips with joined driver + orders (and their locations).
 */
export function useTrips(filters?: TripFilters) {
  return useQuery({
    queryKey: [...TRIPS_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from('trips')
        .select(`
          *,
          driver:profiles!trips_driver_id_fkey(id, full_name, avatar_url, phone, vehicle_plate),
          orders(id, code, status, proof_photo_url,
            delivery_location:locations!orders_delivery_location_id_fkey(id, name, address)
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all')
        q = q.eq('status', filters.status)
      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom)
      if (filters?.dateTo)   q = q.lte('created_at', filters.dateTo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Trip[]
    },
    staleTime: 1000 * 30,
  })
}

/**
 * Create a trip and assign a driver.
 */
export function useCreateTrip() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { driver_id: string; order_ids: string[] }) => {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({ driver_id: input.driver_id })
        .select()
        .single()

      if (tripError) throw tripError

      if (input.order_ids.length > 0) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ trip_id: trip.id, assigned_to: input.driver_id, status: 'assigned' })
          .in('id', input.order_ids)
        if (orderError) throw orderError
      }

      return trip as Trip
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRIPS_KEY })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
