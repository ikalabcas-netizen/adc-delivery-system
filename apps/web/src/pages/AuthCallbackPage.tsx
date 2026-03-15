import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * Handles the OAuth callback from Supabase / Google.
 * Supabase JS SDK automatically exchanges the code/hash for a session
 * when this component mounts — we just need to wait then navigate.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase detects the ?code= or #access_token= in the URL automatically.
    // onAuthStateChange in authStore will fire with SIGNED_IN event.
    // We only need to redirect once the session is established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        navigate('/', { replace: true })
      }
      // If token exchange fails, go back to login
      if (event === 'SIGNED_OUT') {
        subscription.unsubscribe()
        navigate('/', { replace: true })
      }
    })

    // Fallback: if auth state doesn't fire within 3s, redirect anyway
    const timer = setTimeout(() => {
      subscription.unsubscribe()
      navigate('/', { replace: true })
    }, 3000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eef2f5',
        gap: '16px',
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid #a5f3fc',
          borderTopColor: '#06b6d4',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#64748b' }}>
        Đang đăng nhập...
      </p>
    </div>
  )
}
