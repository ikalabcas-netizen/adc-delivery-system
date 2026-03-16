/**
 * useDriverStatus — Supabase Realtime hook.
 * Subscribes to profile changes for delivery drivers.
 * Maintains a local Map<driverId, {shift_status, driver_status}> that updates instantly.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface DriverLiveStatus {
  id:            string
  shift_status:  'off_shift' | 'on_shift' | null
  driver_status: 'free' | 'delivering' | null
}

export function useDriverStatusMap() {
  const [statusMap, setStatusMap] = useState<Record<string, DriverLiveStatus>>({})

  const merge = useCallback((updated: DriverLiveStatus) => {
    setStatusMap(prev => ({ ...prev, [updated.id]: updated }))
  }, [])

  useEffect(() => {
    // Initial load — fetch all delivery driver statuses
    supabase
      .from('profiles')
      .select('id, shift_status, driver_status')
      .eq('role', 'delivery')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, DriverLiveStatus> = {}
          data.forEach(d => { map[d.id] = d as DriverLiveStatus })
          setStatusMap(map)
        }
      })

    // Realtime subscription
    const channel = supabase
      .channel('driver-live-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        payload => {
          const p = payload.new as Record<string, unknown>
          if (p.role === 'delivery' || p.shift_status !== undefined) {
            merge({
              id:            p.id as string,
              shift_status:  p.shift_status as DriverLiveStatus['shift_status'],
              driver_status: p.driver_status as DriverLiveStatus['driver_status'],
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merge])

  return statusMap
}
