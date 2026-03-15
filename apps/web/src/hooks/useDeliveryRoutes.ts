import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { DeliveryRoute } from '@adc/shared-types'

const ROUTES_KEY = ['delivery-routes'] as const

/**
 * Fetch all delivery routes — cached like locations (staleTime: Infinity).
 */
export function useDeliveryRoutes() {
  return useQuery({
    queryKey: ROUTES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_routes')
        .select('*')
        .order('name')

      if (error) throw error
      return (data ?? []) as DeliveryRoute[]
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  })
}

export function useCreateDeliveryRoute() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (input: Pick<DeliveryRoute, 'name' | 'color' | 'description'>) => {
      const { data, error } = await supabase
        .from('delivery_routes')
        .insert({ ...input, created_by: profile?.id ?? null })
        .select()
        .single()

      if (error) throw error
      return data as DeliveryRoute
    },
    onSuccess: (newRoute) => {
      qc.setQueryData<DeliveryRoute[]>(ROUTES_KEY, old =>
        old ? [...old, newRoute] : [newRoute]
      )
    },
  })
}

export function useUpdateDeliveryRoute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeliveryRoute> & { id: string }) => {
      const { data, error } = await supabase
        .from('delivery_routes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as DeliveryRoute
    },
    onSuccess: (updated) => {
      qc.setQueryData<DeliveryRoute[]>(ROUTES_KEY, old =>
        old?.map(r => r.id === updated.id ? updated : r) ?? []
      )
    },
  })
}

export function useDeleteDeliveryRoute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_routes')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      qc.setQueryData<DeliveryRoute[]>(ROUTES_KEY, old =>
        old?.filter(r => r.id !== deletedId) ?? []
      )
    },
  })
}
