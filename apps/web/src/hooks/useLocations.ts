import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Location } from '@adc/shared-types'
import { useMemo } from 'react'

const LOCATIONS_KEY = ['locations'] as const

/**
 * Prefetch ALL locations into TanStack cache with staleTime: Infinity.
 * Client-side filtering = instant autocomplete (0ms latency).
 * Cache auto-invalidates on create/update/delete via onSuccess callbacks.
 */
export function useLocations() {
  return useQuery({
    queryKey: LOCATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Location[]
    },
    staleTime: Infinity,       // Never auto-refetch — cache is the source of truth
    gcTime: 1000 * 60 * 60,   // Keep in memory for 1 hour
  })
}

/**
 * Client-side fuzzy search on cached locations.
 * Searches name + address + phone. No DB request.
 */
export function useLocationSearch(query: string) {
  const { data: locations = [] } = useLocations()

  return useMemo(() => {
    if (!query.trim()) return locations.slice(0, 10) // Show recent 10 if empty

    const q = query.toLowerCase().trim()
    return locations.filter(loc =>
      (loc.name ?? '').toLowerCase().includes(q) ||
      (loc.address ?? '').toLowerCase().includes(q) ||
      (loc.phone ?? '').toLowerCase().includes(q)
    )
  }, [locations, query])
}

/**
 * Get locations used most recently by the current coordinator (for "recent" hints).
 * Pure client-side computation on cached data.
 */
export function useRecentLocations(limit = 5) {
  const { data: locations = [] } = useLocations()
  return useMemo(() => locations.slice(0, limit), [locations, limit])
}

/**
 * Create location + invalidate cache so search is instantly updated.
 */
export function useCreateLocation() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (input: Omit<Location, 'id' | 'created_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('locations')
        .insert({ ...input, created_by: profile?.id ?? null })
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: (newLoc) => {
      // Optimistic: prepend to cache immediately (no refetch delay)
      qc.setQueryData<Location[]>(LOCATIONS_KEY, old =>
        old ? [newLoc, ...old] : [newLoc]
      )
    },
  })
}

/**
 * Update location + invalidate cache.
 */
export function useUpdateLocation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Location> & { id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: (updated) => {
      // Replace in cache
      qc.setQueryData<Location[]>(LOCATIONS_KEY, old =>
        old?.map(loc => loc.id === updated.id ? updated : loc) ?? []
      )
    },
  })
}

/**
 * Delete location + remove from cache.
 */
export function useDeleteLocation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      qc.setQueryData<Location[]>(LOCATIONS_KEY, old =>
        old?.filter(loc => loc.id !== deletedId) ?? []
      )
    },
  })
}
