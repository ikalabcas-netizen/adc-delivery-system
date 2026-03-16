import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── System stats for today ──────────────────────────────────
export function useSystemStats() {
  return useQuery({
    queryKey: ['performance', 'system-stats'],
    queryFn: async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const from = todayStart.toISOString()

      const [ordersRes, tripsRes, shiftsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('status, delivered_at, created_at, assigned_to')
          .gte('created_at', from),
        supabase
          .from('trips')
          .select('status, started_at, completed_at')
          .gte('created_at', from),
        supabase
          .from('profiles')
          .select('id, shift_status')
          .eq('role', 'delivery'),
      ])

      if (ordersRes.error) throw ordersRes.error
      if (tripsRes.error)  throw tripsRes.error
      if (shiftsRes.error) throw shiftsRes.error

      const orders  = ordersRes.data ?? []
      const trips   = tripsRes.data  ?? []
      const drivers = shiftsRes.data ?? []

      const total     = orders.length
      const delivered = orders.filter(o => o.status === 'delivered').length
      const cancelled = orders.filter(o => o.status === 'cancelled').length
      const successRate = (delivered + cancelled) > 0
        ? Math.round(delivered / (delivered + cancelled) * 100) : 0

      const activeTrips     = trips.filter(t => t.status === 'active').length
      const driversOnShift  = drivers.filter(d => d.shift_status === 'on_shift').length

      // Average trip duration for completed trips today (minutes)
      const completedTrips = trips.filter(t => t.status === 'completed' && t.started_at && t.completed_at)
      const avgTripMinutes = completedTrips.length > 0
        ? Math.round(completedTrips.reduce((sum, t) => {
            return sum + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000
          }, 0) / completedTrips.length)
        : null

      return { total, delivered, cancelled, successRate, activeTrips, driversOnShift, avgTripMinutes }
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  })
}

// ── Per-driver stats for a given period ────────────────────
export type DriverStat = {
  driver_id:    string
  full_name:    string | null
  avatar_url:   string | null
  vehicle_plate: string | null
  shift_status: string | null
  driver_status: string | null
  total:        number
  delivered:    number
  cancelled:    number
  successRate:  number
}

export function useDriverPerformance(period: 'today' | 'week' | 'month' = 'today') {
  return useQuery({
    queryKey: ['performance', 'drivers', period],
    queryFn: async () => {
      const now   = new Date()
      const pad   = (n: number) => String(n).padStart(2, '0')
      const iso   = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

      let from: string
      if (period === 'today') {
        from = `${iso(now)}T00:00:00`
      } else if (period === 'week') {
        const d = new Date(now); d.setDate(now.getDate() - now.getDay())
        from = `${iso(d)}T00:00:00`
      } else {
        from = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01T00:00:00`
      }

      const [ordersRes, profilesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('assigned_to, status')
          .gte('created_at', from)
          .not('assigned_to', 'is', null),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, vehicle_plate, shift_status, driver_status')
          .eq('role', 'delivery'),
      ])

      if (ordersRes.error) throw ordersRes.error
      if (profilesRes.error) throw profilesRes.error

      const orders  = ordersRes.data  ?? []
      const drivers = profilesRes.data ?? []

      // Group
      const map = new Map<string, { total: number; delivered: number; cancelled: number }>()
      for (const o of orders) {
        const key = o.assigned_to as string
        const cur = map.get(key) ?? { total: 0, delivered: 0, cancelled: 0 }
        cur.total++
        if (o.status === 'delivered') cur.delivered++
        if (o.status === 'cancelled') cur.cancelled++
        map.set(key, cur)
      }

      const stats: DriverStat[] = drivers.map(d => {
        const s = map.get(d.id) ?? { total: 0, delivered: 0, cancelled: 0 }
        const successRate = (s.delivered + s.cancelled) > 0
          ? Math.round(s.delivered / (s.delivered + s.cancelled) * 100) : 0
        return { driver_id: d.id, full_name: d.full_name, avatar_url: d.avatar_url, vehicle_plate: d.vehicle_plate, shift_status: d.shift_status, driver_status: d.driver_status, ...s, successRate }
      })

      return stats.sort((a, b) => b.delivered - a.delivered)
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 90,
  })
}

// ── Daily trend (last N days) ───────────────────────────────
export type DayTrend = { date: string; delivered: number; cancelled: number; total: number }

export function useDailyTrend(days = 7) {
  return useQuery({
    queryKey: ['performance', 'trend', days],
    queryFn: async () => {
      const now = new Date()
      const from = new Date(now)
      from.setDate(now.getDate() - days + 1)
      from.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, status')
        .gte('created_at', from.toISOString())
        .in('status', ['delivered', 'cancelled', 'in_transit', 'assigned', 'pending'])

      if (error) throw error

      const pad = (n: number) => String(n).padStart(2, '0')
      const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

      // Build date buckets
      const buckets: Record<string, DayTrend> = {}
      for (let i = 0; i < days; i++) {
        const d = new Date(from); d.setDate(from.getDate() + i)
        const key = toDate(d)
        buckets[key] = { date: key, delivered: 0, cancelled: 0, total: 0 }
      }

      for (const row of data ?? []) {
        const key = toDate(new Date(row.created_at))
        if (!buckets[key]) continue
        buckets[key].total++
        if (row.status === 'delivered') buckets[key].delivered++
        if (row.status === 'cancelled') buckets[key].cancelled++
      }

      return Object.values(buckets)
    },
    staleTime: 1000 * 60 * 5,
  })
}
