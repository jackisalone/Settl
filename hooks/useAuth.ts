import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

/**
 * Returns the current auth state and a signOut helper.
 * The session and profile are sourced from the Zustand store,
 * which is kept in sync by the root _layout.tsx auth listener.
 */
export function useAuth() {
  const router = useRouter()
  const { session, profile } = useAuthStore()

  async function signOut() {
    await supabase.auth.signOut()
    // clearAuth + redirect are handled by the onAuthStateChange listener
    // in _layout.tsx, but we navigate proactively to avoid any delay.
    router.replace('/auth/login')
  }

  return {
    user: profile,
    session,
    isLoggedIn: session !== null,
    signOut,
  }
}
