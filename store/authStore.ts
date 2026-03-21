import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { User } from '@/types/index'

interface AuthState {
  // Supabase auth session (JWT, tokens)
  session: Session | null
  // Our app-level user profile from the users table
  profile: User | null
  setSession: (session: Session | null) => void
  setProfile: (profile: User | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  clearAuth: () => set({ session: null, profile: null }),
}))
