import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'email' | 'otp'

export default function LoginScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const otpRef = useRef<TextInput>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const otpValid = otp.trim().length === 6

  async function handleSendOtp() {
    if (!emailValid || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setStep('otp')
      // Auto-focus OTP field after state update
      setTimeout(() => otpRef.current?.focus(), 100)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (!otpValid || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      })
      if (error) throw error

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No user after verification')

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        router.replace('/auth/onboarding')
      } else {
        router.replace(profile.role === 'owner' ? '/(owner)' : '/(tenant)')
      }
    } catch (err: any) {
      Alert.alert('Invalid code', err?.message ?? 'Please check the code and try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-6 pt-24 pb-12">
        {/* Wordmark */}
        <Text className="text-5xl font-bold text-blue-600 tracking-tight mb-6">
          settl
        </Text>

        {/* Headline */}
        <Text className="text-3xl font-bold text-gray-900 leading-tight mb-3">
          Find your perfect PG
        </Text>

        {/* Cities */}
        <Text className="text-sm text-gray-400">
          Mumbai · Bangalore · Delhi · Chennai
        </Text>

        <View className="flex-1" />

        {step === 'email' ? (
          <>
            <Text className="text-base font-medium text-gray-700 mb-2">
              Enter your email to continue
            </Text>
            <TextInput
              className="h-[52px] border border-gray-200 rounded-xl px-4 text-base text-gray-900 mb-4 bg-white"
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />
            <Pressable
              onPress={handleSendOtp}
              disabled={!emailValid || loading}
              className="h-[52px] rounded-xl items-center justify-center mb-4"
              style={{ backgroundColor: emailValid ? '#2563EB' : '#E5E7EB' }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className="text-base font-semibold"
                  style={{ color: emailValid ? '#fff' : '#9CA3AF' }}
                >
                  Send Code
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-base font-medium text-gray-700 mb-1">
              Enter the 6-digit code sent to
            </Text>
            <Text className="text-base font-semibold text-blue-600 mb-4">
              {email}
            </Text>
            <TextInput
              ref={otpRef}
              className="h-[52px] border border-gray-200 rounded-xl px-4 text-2xl text-gray-900 tracking-widest mb-2 bg-white text-center"
              placeholder="••••••"
              placeholderTextColor="#9CA3AF"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleVerifyOtp}
            />
            <Pressable
              onPress={() => { setStep('email'); setOtp('') }}
              className="mb-4"
            >
              <Text className="text-sm text-gray-400 text-center">
                Wrong email?{' '}
                <Text className="text-blue-500 font-medium">Change it</Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={handleVerifyOtp}
              disabled={!otpValid || loading}
              className="h-[52px] rounded-xl items-center justify-center mb-4"
              style={{ backgroundColor: otpValid ? '#2563EB' : '#E5E7EB' }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className="text-base font-semibold"
                  style={{ color: otpValid ? '#fff' : '#9CA3AF' }}
                >
                  Verify & Continue
                </Text>
              )}
            </Pressable>
          </>
        )}

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
    </KeyboardAvoidingView>
  )
}
