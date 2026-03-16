import { Truck, Calendar } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import type { Trip, TripStatus } from '@adc/shared-types'

const STATUS_MAP: Record<TripStatus, { label: string; bg: string; color: string }> = {
  active:    { label: 'Đang chạy',  bg: '#f3f0ff', color: '#7c3aed' },
  completed: { label: 'Hoàn thành', bg: '#f0fdf4', color: '#059669' },
}

export function TripsPage() {
  const { data: trips = [], isLoading } = useTrips()

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Chuyến đi</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{trips.length} chuyến</p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Truck size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Chưa có chuyến đi nào</p>
          <p style={{ fontSize: 12 }}>Tạo chuyến từ trang Đơn hàng → gán tài xế</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}
    </div>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const status = STATUS_MAP[trip.status]
  const driver = trip.driver

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #ecfeff, #cffafe)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Truck size={18} color="#0891b2" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
            {driver?.full_name ?? 'Chưa gán tài xế'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>
        {driver?.vehicle_plate && (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>🚗 {driver.vehicle_plate}</p>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', color: '#cbd5e1', fontSize: 11 }}>
          <Calendar size={11} />
          {new Date(trip.created_at).toLocaleDateString('vi-VN')}
        </div>
      </div>
    </div>
  )
}
