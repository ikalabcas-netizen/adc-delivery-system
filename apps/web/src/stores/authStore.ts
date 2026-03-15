import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@adc/shared-types'

interface AuthState {
  session:         Session | null
  profile:         Profile | null
  isLoading:       boolean
  setSession:      (session: Session | null) => void
  setProfile:      (profile: Profile | null) => void
  signInWithGoogle: () => Promise<void>
  signOut:         () => Promise<void>
  fetchProfile:    (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session:   null,
  profile:   null,
  isLoading: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Request profile scopes
        scopes: 'profile email',
      },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  fetchProfile: async (userId: string) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      // Profile already exists
      set({ profile: existingProfile as Profile, isLoading: false })
      return
    }

    // First-time login: get user metadata from auth and create profile row
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const newProfile = {
        id:          user.id,
        email:       user.email ?? '',
        full_name:   user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
        avatar_url:  user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        role:        null,        // Pending approval
        is_approved: false,
      }

      const { data: created } = await supabase
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' })
        .select()
        .single()

      set({ profile: (created ?? newProfile) as Profile | null, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },
}))

/** Initialize auth listener — call once at app startup */
export function initAuth() {
  // Restore existing session
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
    if (session?.user) {
      useAuthStore.getState().fetchProfile(session.user.id)
    } else {
      useAuthStore.setState({ isLoading: false })
    }
  })

  // Listen to auth changes (login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session?.user) {
      useAuthStore.getState().fetchProfile(session.user.id)
    } else {
      useAuthStore.setState({ profile: null, isLoading: false })
    }
  })
}
