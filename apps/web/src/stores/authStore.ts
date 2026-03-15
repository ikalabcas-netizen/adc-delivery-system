import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@adc/shared-types'

interface AuthState {
  session:          Session | null
  profile:          Profile | null
  isLoading:        boolean
  setSession:       (session: Session | null) => void
  setProfile:       (profile: Profile | null) => void
  signInWithGoogle: () => Promise<void>
  signOut:          () => Promise<void>
  fetchProfile:     (userId: string) => Promise<void>
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
        scopes: 'profile email',
      },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  fetchProfile: async (userId: string) => {
    try {
      // Always get auth user data first (guaranteed, no RLS issues)
      const { data: { user } } = await supabase.auth.getUser()
      const authEmail    = user?.email ?? null
      const authName     = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null
      const authAvatar   = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null

      // Try reading own profile (RLS: id = auth.uid() always passes)
      const { data: existing, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()   // returns null instead of error when not found

      if (error) {
        console.error('[fetchProfile] select error:', error.message)
      }

      if (existing) {
        // Patch email in DB if it was null (migration added the column)
        if (!existing.email && authEmail) {
          await supabase.from('profiles').update({ email: authEmail }).eq('id', userId)
          set({ profile: { ...existing, email: authEmail } as Profile, isLoading: false })
        } else {
          set({ profile: existing as Profile, isLoading: false })
        }
        return
      }

      // First-time login: upsert profile row
      const newProfile = {
        id:          userId,
        email:       authEmail,
        full_name:   authName,
        avatar_url:  authAvatar,
        role:        null,
        is_approved: false,
      }

      const { data: created, error: upsertError } = await supabase
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' })
        .select()
        .maybeSingle()

      if (upsertError) {
        console.error('[fetchProfile] upsert error:', upsertError.message)
      }

      set({ profile: (created ?? newProfile) as Profile | null, isLoading: false })

    } catch (err) {
      console.error('[fetchProfile] unexpected error:', err)
      set({ isLoading: false })
    }
  },
}))

/** Initialize auth listener — call once at app startup */
export function initAuth() {
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session)
    if (session?.user) {
      // isLoading already true from initial state — keep it true until profile loaded
      useAuthStore.getState().fetchProfile(session.user.id)
    } else {
      useAuthStore.setState({ isLoading: false })
    }
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session?.user) {
      // CRITICAL: set isLoading:true BEFORE async fetchProfile
      // Without this, if isLoading was already false (e.g. after OAuth redirect),
      // the app renders with profile:null and shows PendingApprovalPage prematurely.
      useAuthStore.setState({ isLoading: true })
      useAuthStore.getState().fetchProfile(session.user.id)
    } else {
      useAuthStore.setState({ profile: null, isLoading: false })
    }
  })
}
