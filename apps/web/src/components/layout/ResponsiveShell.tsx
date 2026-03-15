/**
 * ResponsiveShell — Shared layout shell with responsive sidebar.
 *
 * Desktop (>768px): fixed sidebar on left
 * Mobile  (≤768px): hamburger button top-left, slide-out drawer overlay
 *
 * Used by all role layouts (Coordinator, Sales, Delivery, Admin).
 */
import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, LogOut, User, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface ResponsiveShellProps {
  navItems: NavItem[]
  accentColor?: string
  roleLabel: string
  profilePath: string
  children: React.ReactNode
}

// Custom hook for responsive
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

export function ResponsiveShell({ navItems, accentColor = '#06b6d4', roleLabel, profilePath, children }: ResponsiveShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()

  // Auto-close drawer on navigation
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // Close on ESC
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const sidebar = (
    <Sidebar
      navItems={navItems}
      accentColor={accentColor}
      roleLabel={roleLabel}
      profilePath={profilePath}
      isMobile={isMobile}
      onClose={() => setDrawerOpen(false)}
    />
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#eef2f5' }}>
      {/* Desktop sidebar */}
      {!isMobile && sidebar}

      {/* Mobile drawer overlay */}
      {isMobile && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 998, backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            width: 260, zIndex: 999,
            animation: 'slideInLeft 0.2s ease',
          }}>
            {sidebar}
          </div>
        </>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: '#f8fafc', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Menu size={18} color="#475569" />
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif',
              }}>
                ADC
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                {roleLabel}
              </span>
            </div>
          </div>
        )}

        {/* Scrollable main */}
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? '16px' : '28px 32px',
        }}>
          {children}
        </main>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      {/* Fallback for browsers without dvh support */}
      <style>{`
        @supports not (height: 100dvh) {
          .adc-shell { height: 100vh !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ navItems, accentColor, roleLabel, profilePath, isMobile, onClose }: {
  navItems: NavItem[]; accentColor: string; roleLabel: string; profilePath: string
  isMobile: boolean; onClose: () => void
}) {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside style={{
      width: isMobile ? 260 : 220, flexShrink: 0,
      background: 'linear-gradient(180deg, #0B1929 0%, #0F2847 100%)',
      display: 'flex', flexDirection: 'column', height: '100dvh',
      boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
    }}>
      {/* Brand + close on mobile */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif',
          }}>
            ADC
          </div>
          <div>
            <div style={{ color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>ADC Delivery</div>
            <div style={{ color: accentColor, fontFamily: 'Outfit, sans-serif', fontSize: 10, marginTop: 1 }}>{roleLabel}</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="rgba(255,255,255,0.5)" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 2,
            fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.15s ease',
            background: isActive ? `${accentColor}22` : 'transparent',
            color: isActive ? accentColor : 'rgba(255,255,255,0.55)',
            borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
          })}>
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 8px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={() => navigate(profilePath)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8, background: 'transparent',
          border: 'none', cursor: 'pointer', marginBottom: 4,
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accentColor}44` }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${accentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={13} color={accentColor} />
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? 'Người dùng'}
            </p>
          </div>
          <ChevronRight size={11} color="rgba(255,255,255,0.25)" />
        </button>
        <button onClick={signOut} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '7px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
          fontFamily: 'Outfit, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)',
        }}>
          <LogOut size={12} /> Đăng xuất
        </button>
      </div>
    </aside>
  )
}
