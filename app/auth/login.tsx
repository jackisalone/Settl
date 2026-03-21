import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_ICON = (
  // Inline SVG-like approach via coloured letter blocks is not native-friendly.
  // We render a coloured "G" using styled Text as a stand-in.
  // Replace with an <Image> asset once you add the Google G logo to assets/.
  <View className="w-6 h-6 items-center justify-center">
    <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
  </View>
)

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    if (loading) return
    setLoading(true)

    try {
      const redirectTo = makeRedirectUri({ scheme: 'settl', path: 'auth/callback' })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })

      if (error || !data?.url) throw error ?? new Error('No OAuth URL returned')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type !== 'success') {
        // User cancelled — not an error
        setLoading(false)
        return
      }

      // Extract session from the redirect URL
      const url = result.url
      const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '')
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) throw sessionError
      }

      // Check if user profile exists in our users table
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('No user after OAuth')

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        // New user — go to onboarding
        router.replace('/auth/onboarding')
      } else {
        // Returning user — route by role
        if (profile.role === 'owner') {
          router.replace('/(owner)')
        } else {
          router.replace('/(tenant)')
        }
      }
    } catch (err) {
      console.error('OAuth error:', err)
      Alert.alert('Sign in failed', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-24 pb-12">
      {/* Wordmark */}
      <Text className="text-5xl font-bold text-blue-600 tracking-tight mb-6">
        settl
      </Text>

      {/* Headline */}
      <Text className="text-3xl font-bold text-gray-900 leading-tight mb-3">
        Find your perfect PG
      </Text>

      {/* City sub-text */}
      <Text className="text-sm text-gray-400 mb-auto">
        Mumbai · Bangalore · Delhi · Chennai
      </Text>

      {/* Spacer */}
      <View className="flex-1" />

      {/* Google sign-in button */}
      <Pressable
        onPress={handleGoogleSignIn}
        disabled={loading}
        className="flex-row items-center justify-center bg-white border border-gray-200 rounded-xl h-[52px] w-full mb-4 active:bg-gray-50"
        style={{ elevation: 1 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#6B7280" />
        ) : (
          <>
            {GOOGLE_ICON}
            <Text className="ml-3 text-base font-medium text-gray-800">
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>

      {/* Legal */}
      <Text className="text-xs text-gray-400 text-center leading-5">
        By continuing you agree to our{' '}
        <Text
          className="underline"
          onPress={() => Linking.openURL('https://settl.in/terms')}
        >
          Terms
        </Text>{' '}
        &{' '}
        <Text
          className="underline"
          onPress={() => Linking.openURL('https://settl.in/privacy')}
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  )
}
