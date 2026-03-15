import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Trip } from '@adc/shared-types'

const TRIPS_KEY = ['trips'] as const

/**
 * Fetch trips with joined driver profile.
 */
export function useTrips() {
  return useQuery({
    queryKey: TRIPS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          driver:profiles!trips_driver_id_fkey(id, full_name, avatar_url, phone, vehicle_plate)
        `)
        .order('created_at', { ascending: false })

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
      // 1. Create trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({ driver_id: input.driver_id })
        .select()
        .single()

      if (tripError) throw tripError

      // 2. Assign orders to this trip
      if (input.order_ids.length > 0) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            trip_id: trip.id,
            assigned_to: input.driver_id,
            status: 'assigned',
          })
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
