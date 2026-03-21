import '../global.css'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mapUser } from '@/types/index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: 1,
    },
  },
})

// ─── Loading screen ───────────────────────────────────────────────────────────
// Shown while the initial session check is in progress.
// Absolute overlay so the Stack mounts beneath it (zero flicker on nav).

function SplashLoading() {
  return (
    <View style={styles.splash}>
      <Text style={styles.wordmark}>settl</Text>
      <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -1,
  },
})

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const router = useRouter()
  const { setSession, setProfile, clearAuth } = useAuthStore()
  const [isReady, setIsReady] = useState(false)
  // Guard against routing while a navigation is already in flight
  const isNavigating = useRef(false)

  function navigate(path: string) {
    if (isNavigating.current) return
    isNavigating.current = true
    router.replace(path as any)
    // Reset guard after the navigation settles
    setTimeout(() => { isNavigating.current = false }, 500)
  }

  async function resolveAndRoute(session: Session) {
    setSession(session)

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile) {
      // Authenticated but no profile row → new user, needs onboarding
      navigate('/auth/onboarding')
    } else {
      setProfile(mapUser(profile))
      navigate(profile.role === 'owner' ? '/(owner)' : '/(tenant)')
    }
  }

  useEffect(() => {
    let mounted = true

    // ── 1. Initial session check on app launch ──────────────────────────────
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return

      if (!session) {
        clearAuth()
        setIsReady(true)
        navigate('/auth/login')
        return
      }

      await resolveAndRoute(session)
      if (mounted) setIsReady(true)
    })

    // ── 2. Real-time auth state listener ────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT' || !session) {
        clearAuth()
        navigate('/auth/login')
        return
      }

      // TOKEN_REFRESH — update session silently, no re-route needed
      if (event === 'TOKEN_REFRESH') {
        setSession(session)
        return
      }

      // SIGNED_IN — full resolve + route
      if (event === 'SIGNED_IN') {
        await resolveAndRoute(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="(tenant)" />
        <Stack.Screen name="(owner)" />
      </Stack>

      {/* Overlay — covers the Stack until auth is resolved */}
      {!isReady && <SplashLoading />}
    </QueryClientProvider>
  )
}
