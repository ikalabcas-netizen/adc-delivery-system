import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@adc/shared-types'

// ─── Fetch all profiles ───────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Profile[]
    },
  })
}

// ─── Fetch own profile ─────────────────────────────────────────────
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!userId,
  })
}

// ─── Approve user + set role ───────────────────────────────────────
interface ApprovePayload {
  userId:    string
  role:      UserRole
  full_name: string
}
export function useApproveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role, full_name }: ApprovePayload) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role, is_approved: true, full_name })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

// ─── Revoke approval ───────────────────────────────────────────────
export function useRevokeUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: false, role: null })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

// ─── Update own profile ────────────────────────────────────────────
type ProfileUpdatePayload = Partial<Pick<
  Profile,
  'full_name' | 'phone' | 'vehicle_plate' | 'vehicle_type' | 'home_address'
>>
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      if (!userId) throw new Error('No userId')
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}
