import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, CheckCircle, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function DeliveryTripsPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'completed'>('active')

  const fetchTrips = async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trips')
      .select('*, orders(id, status)')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (!error && data) {
      setTrips(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTrips()
  }, [profile?.id])

  const activeTrips = trips.filter(t => t.status === 'active')
  const completedTrips = trips.filter(t => t.status === 'completed')

  const displayedTrips = tab === 'active' ? activeTrips : completedTrips

  if (loading) {
    return <div style={{ padding: 20, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Đang tải...</div>
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 600 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Chuyến đi</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Quản lý các chuyến đi được phân công</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          onClick={() => setTab('active')}
          style={{
            padding: '8px 16px', borderRadius: 20,
            border: tab === 'active' ? 'none' : '1px solid #e2e8f0',
            background: tab === 'active' ? '#059669' : '#fff',
            color: tab === 'active' ? '#fff' : '#475569',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <Truck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
          Đang giao ({activeTrips.length})
        </button>
        <button
          onClick={() => setTab('completed')}
          style={{
            padding: '8px 16px', borderRadius: 20,
            border: tab === 'completed' ? 'none' : '1px solid #e2e8f0',
            background: tab === 'completed' ? '#059669' : '#fff',
            color: tab === 'completed' ? '#fff' : '#475569',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
          Hoàn thành ({completedTrips.length})
        </button>
      </div>

      {/* List */}
      {displayedTrips.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 16px',
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
          color: '#94a3b8', fontSize: 14
        }}>
          {tab === 'active' ? 'Không có chuyến nào đang giao.' : 'Chưa có chuyến đi hoàn thành.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayedTrips.map(trip => {
            const orders = trip.orders || []
            const total = orders.length
            const doneCount = orders.filter((o: any) => o.status !== 'in_transit' && o.status !== 'assigned' && o.status !== 'pending').length
            const isCompleted = trip.status === 'completed'
            const accent = isCompleted ? '#059669' : '#059669'

            return (
              <div 
                key={trip.id} 
                onClick={() => navigate(`/delivery/trips/${trip.id}`)}
                style={{
                  background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
                  padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 12px ${accent}22`}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {isCompleted ? <CheckCircle color={accent} size={22} /> : <Truck color={accent} size={22} />}
                </div>
                
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                    Chuyến {trip.started_at ? new Date(trip.started_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: accent, fontWeight: 500 }}>
                    <Package size={13} /> {doneCount}/{total} đơn
                    {isCompleted && trip.completed_at && (
                      <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
                        ⏱ {new Date(trip.completed_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{
                  padding: '4px 10px', borderRadius: 20, background: `${accent}1a`,
                  color: accent, fontSize: 11, fontWeight: 700
                }}>
                  {isCompleted ? 'Hoàn thành' : 'Đang giao'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
