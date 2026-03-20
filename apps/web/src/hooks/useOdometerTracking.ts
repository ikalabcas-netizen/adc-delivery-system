import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface OdometerRecord {
  driver_id:       string
  driver_name:     string | null
  avatar_url:      string | null
  vehicle_plate:   string | null
  date:            string
  km_in:           number | null
  km_out:          number | null
  actual_km:       number | null  // km_out - km_in
  optimized_km:    number         // sum of trips optimized_distance_km
  difference:      number | null  // actual - optimized
  difference_pct:  number | null  // (actual - optimized) / optimized * 100
}

export interface OdometerSummary {
  totalActualKm:    number
  totalOptimizedKm: number
  totalDifference:  number
  differencePct:    number
}

export interface OdometerFilters {
  period:    'today' | 'week' | 'month' | 'custom'
  dateFrom?: string
  dateTo?:   string
  driverId?: string | null
}

function getDateRange(period: OdometerFilters['period'], dateFrom?: string, dateTo?: string) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  if (period === 'custom') {
    return {
      from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
      to:   dateTo   ? `${dateTo}T23:59:59`   : undefined,
    }
  }
  if (period === 'today') {
    const s = iso(now)
    return { from: `${s}T00:00:00`, to: `${s}T23:59:59` }
  }
  if (period === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay())
    return { from: `${iso(d)}T00:00:00`, to: `${iso(now)}T23:59:59` }
  }
  // month
  return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01T00:00:00`, to: `${iso(now)}T23:59:59` }
}

export function useOdometerTracking(filters: OdometerFilters) {
  return useQuery({
    queryKey: ['odometer', filters],
    queryFn: async (): Promise<{ records: OdometerRecord[]; summary: OdometerSummary }> => {
      const { from, to } = getDateRange(filters.period, filters.dateFrom, filters.dateTo)

      // Fetch driver shifts with driver info
      let shiftsQ = supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at, km_in, km_out, driver:profiles!driver_shifts_driver_id_fkey(full_name, avatar_url, vehicle_plate)')
        .order('started_at', { ascending: false })

      if (from) shiftsQ = shiftsQ.gte('started_at', from)
      if (to)   shiftsQ = shiftsQ.lte('started_at', to)
      if (filters.driverId) shiftsQ = shiftsQ.eq('driver_id', filters.driverId)

      // Fetch trips with optimized distance
      let tripsQ = supabase
        .from('trips')
        .select('driver_id, created_at, optimized_distance_km')
        .not('optimized_distance_km', 'is', null)

      if (from) tripsQ = tripsQ.gte('created_at', from)
      if (to)   tripsQ = tripsQ.lte('created_at', to)
      if (filters.driverId) tripsQ = tripsQ.eq('driver_id', filters.driverId)

      const [shiftsRes, tripsRes] = await Promise.all([shiftsQ, tripsQ])
      if (shiftsRes.error) throw shiftsRes.error
      if (tripsRes.error)  throw tripsRes.error

      const shifts = shiftsRes.data ?? []
      const trips  = tripsRes.data  ?? []

      // Aggregate optimized km by (driver_id, date)
      const pad = (n: number) => String(n).padStart(2, '0')
      const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

      const tripKmMap = new Map<string, number>()
      for (const t of trips) {
        if (!t.driver_id || !t.optimized_distance_km) continue
        const dateKey = toDate(new Date(t.created_at))
        const mapKey = `${t.driver_id}_${dateKey}`
        tripKmMap.set(mapKey, (tripKmMap.get(mapKey) ?? 0) + Number(t.optimized_distance_km))
      }

      // Build records from shifts
      const records: OdometerRecord[] = shifts.map((s: any) => {
        const dateKey = toDate(new Date(s.started_at))
        const mapKey  = `${s.driver_id}_${dateKey}`
        const kmIn    = s.km_in != null ? Number(s.km_in) : null
        const kmOut   = s.km_out != null ? Number(s.km_out) : null
        const actualKm = (kmIn != null && kmOut != null) ? Math.round((kmOut - kmIn) * 100) / 100 : null
        const optimizedKm = Math.round((tripKmMap.get(mapKey) ?? 0) * 100) / 100
        const difference = actualKm != null ? Math.round((actualKm - optimizedKm) * 100) / 100 : null
        const differencePct = (actualKm != null && optimizedKm > 0)
          ? Math.round((actualKm - optimizedKm) / optimizedKm * 100)
          : null

        const driverData = s.driver as any
        return {
          driver_id:      s.driver_id,
          driver_name:    driverData?.full_name ?? null,
          avatar_url:     driverData?.avatar_url ?? null,
          vehicle_plate:  driverData?.vehicle_plate ?? null,
          date:           dateKey,
          km_in:          kmIn,
          km_out:         kmOut,
          actual_km:      actualKm,
          optimized_km:   optimizedKm,
          difference,
          difference_pct: differencePct,
        }
      })

      // Summary totals
      const totalActualKm    = records.reduce((s, r) => s + (r.actual_km ?? 0), 0)
      const totalOptimizedKm = records.reduce((s, r) => s + r.optimized_km, 0)
      const totalDifference  = Math.round((totalActualKm - totalOptimizedKm) * 100) / 100
      const differencePct    = totalOptimizedKm > 0
        ? Math.round((totalActualKm - totalOptimizedKm) / totalOptimizedKm * 100)
        : 0

      return {
        records,
        summary: {
          totalActualKm:    Math.round(totalActualKm * 100) / 100,
          totalOptimizedKm: Math.round(totalOptimizedKm * 100) / 100,
          totalDifference,
          differencePct,
        },
      }
    },
    staleTime: 1000 * 60,
  })
}

// Fetch list of delivery drivers for filter dropdown
export function useDriversList() {
  return useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, vehicle_plate')
        .eq('role', 'delivery')
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}
