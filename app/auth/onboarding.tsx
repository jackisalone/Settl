import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'tenant' | 'owner'

const ROLES: { value: Role; emoji: string; title: string; subtitle: string }[] = [
  {
    value: 'tenant',
    emoji: '🏠',
    title: 'Find a PG',
    subtitle: "I'm a student or professional looking for accommodation",
  },
  {
    value: 'owner',
    emoji: '🏢',
    title: 'List my PG',
    subtitle: "I'm an owner who wants to list properties",
  },
]

function ProgressDots({ step }: { step: 1 | 2 }) {
  return (
    <View className="flex-row items-center justify-center gap-2 mb-10">
      {[1, 2].map((n) => (
        <View
          key={n}
          className="rounded-full"
          style={{
            width: step === n ? 20 : 8,
            height: 8,
            backgroundColor: step === n ? '#2563EB' : '#E5E7EB',
          }}
        />
      ))}
    </View>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current

  function goToStep2() {
    if (name.trim().length < 2) return
    Animated.timing(slideAnim, {
      toValue: -1,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setStep(2)
      slideAnim.setValue(1)
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start()
    })
  }

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-400, 0, 400],
  })

  async function handleGetStarted() {
    if (!role || loading) return
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('No authenticated user')

      const { error } = await supabase.from('users').insert({
        id: user.id,
        // users table uses `phone` as the primary identifier —
        // storing email here until a schema migration adds an email column
        phone: user.email ?? user.id,
        name: name.trim(),
        role,
      })

      if (error) throw error

      router.replace(role === 'owner' ? '/(owner)' : '/(tenant)')
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const nameValid = name.trim().length >= 2

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-6 pt-16 pb-12">
        {/* Header */}
        <Text className="text-3xl font-bold text-blue-600 tracking-tight mb-2">
          settl
        </Text>
        <Text className="text-sm text-gray-400 mb-8">Let's set up your account</Text>

        {/* Progress dots */}
        <ProgressDots step={step} />

        {/* Animated step container */}
        <Animated.View
          className="flex-1"
          style={{ transform: [{ translateX }] }}
        >
          {step === 1 ? (
            <StepName
              name={name}
              onChangeName={setName}
              onContinue={goToStep2}
              nameValid={nameValid}
            />
          ) : (
            <StepRole
              role={role}
              onSelectRole={setRole}
              onGetStarted={handleGetStarted}
              loading={loading}
            />
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── Step 1: Name ────────────────────────────────────────────────────────────

function StepName({
  name,
  onChangeName,
  onContinue,
  nameValid,
}: {
  name: string
  onChangeName: (v: string) => void
  onContinue: () => void
  nameValid: boolean
}) {
  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-gray-900 mb-2">
        What should we call you?
      </Text>
      <Text className="text-sm text-gray-400 mb-8">
        This is how you'll appear on Settl
      </Text>

      <TextInput
        className="h-[52px] border border-gray-200 rounded-xl px-4 text-base text-gray-900 bg-white mb-6"
        placeholder="Your name"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={onChangeName}
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onContinue}
        maxLength={40}
      />

      <View className="flex-1" />

      <Pressable
        onPress={onContinue}
        disabled={!nameValid}
        className="h-[52px] rounded-xl items-center justify-center"
        style={{ backgroundColor: nameValid ? '#2563EB' : '#E5E7EB' }}
      >
        <Text
          className="text-base font-semibold"
          style={{ color: nameValid ? '#fff' : '#9CA3AF' }}
        >
          Continue
        </Text>
      </Pressable>
    </View>
  )
}

// ─── Step 2: Role ────────────────────────────────────────────────────────────

function StepRole({
  role,
  onSelectRole,
  onGetStarted,
  loading,
}: {
  role: Role | null
  onSelectRole: (r: Role) => void
  onGetStarted: () => void
  loading: boolean
}) {
  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-gray-900 mb-2">
        I am looking to…
      </Text>
      <Text className="text-sm text-gray-400 mb-8">
        Choose how you'll use Settl
      </Text>

      <View className="gap-4 mb-6">
        {ROLES.map((item) => {
          const selected = role === item.value
          return (
            <Pressable
              key={item.value}
              onPress={() => onSelectRole(item.value)}
              className="rounded-2xl p-5 border-2"
              style={{
                borderColor: selected ? '#2563EB' : '#E5E7EB',
                backgroundColor: selected ? '#EFF6FF' : '#fff',
              }}
            >
              <Text className="text-3xl mb-2">{item.emoji}</Text>
              <Text
                className="text-lg font-bold mb-1"
                style={{ color: selected ? '#1D4ED8' : '#111827' }}
              >
                {item.title}
              </Text>
              <Text className="text-sm text-gray-500">{item.subtitle}</Text>
            </Pressable>
          )
        })}
      </View>

      <View className="flex-1" />

      {role && (
        <Pressable
          onPress={onGetStarted}
          disabled={loading}
          className="h-[52px] rounded-xl items-center justify-center bg-blue-600"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Get Started
            </Text>
          )}
        </Pressable>
      )}
    </View>
  )
}
