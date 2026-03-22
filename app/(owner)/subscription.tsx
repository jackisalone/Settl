import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BadgeCheck,
  BarChart2,
  Bell,
  Building2,
  Check,
  ChevronUp,
  Headphones,
  LayoutList,
  Star,
  TrendingUp,
  X,
} from 'lucide-react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// ─── Feature comparison data ──────────────────────────────────────────────────

const COMPARISON: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: 'Active listings', free: '1 listing', pro: 'Up to 10 listings' },
  { label: 'Search placement', free: 'Standard', pro: 'Featured (top results)' },
  { label: 'Enquiry tracking', free: true, pro: true },
  { label: 'Analytics dashboard', free: false, pro: true },
  { label: 'Views & shortlist stats', free: false, pro: true },
  { label: 'Verified owner badge', free: false, pro: true },
  { label: 'Priority support', free: false, pro: true },
  { label: 'WhatsApp lead alerts', free: false, pro: true },
]

// ─── Queries ──────────────────────────────────────────────────────────────────

async function fetchUpgradeRequest(ownerId: string) {
  const { data } = await supabase
    .from('upgrade_requests')
    .select('id, email')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session, profile } = useAuthStore()
  const ownerId = session?.user.id!

  const sheetRef = useRef<BottomSheet>(null)
  const [sheetEmail, setSheetEmail] = useState(profile?.email ?? '')
  const [submitted, setSubmitted] = useState(false)

  // Check if owner already on waitlist
  const { data: existingRequest, isLoading: checkingRequest } = useQuery({
    queryKey: ['upgrade-request', ownerId],
    queryFn: () => fetchUpgradeRequest(ownerId),
    staleTime: 5 * 60 * 1000,
  })

  const onWaitlist = !!existingRequest || submitted

  // Mutation: insert upgrade request
  const notifyMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('upgrade_requests').insert({
        owner_id: ownerId,
        email: email.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['upgrade-request', ownerId] })
      sheetRef.current?.close()
    },
    onError: (e: any) => {
      // Unique constraint → already registered
      if (e.message?.includes('unique') || e.code === '23505') {
        setSubmitted(true)
        sheetRef.current?.close()
      } else {
        Alert.alert('Error', e.message ?? 'Something went wrong. Please try again.')
      }
    },
  })

  function handleUpgradePress() {
    if (onWaitlist) return
    sheetRef.current?.expand()
  }

  function handleNotifyMe() {
    if (!sheetEmail.trim() || !sheetEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }
    notifyMutation.mutate(sheetEmail)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Upgrade to Pro</Text>
          <Text style={styles.headerSub}>Get more bookings. Manage more listings.</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Plan cards ── */}
        <View style={styles.planRow}>
          {/* Basic card */}
          <View style={[styles.planCard, styles.planCardFree]}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planNameFree}>Basic</Text>
              {/* "Current Plan" badge */}
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            </View>
            <Text style={styles.planPriceFree}>Free</Text>
            <Text style={styles.planPriceSub}>Forever</Text>
            <View style={styles.planDivider} />
            {[
              '1 active listing',
              'Standard search placement',
              'Basic enquiry tracking',
            ].map((f) => (
              <View key={f} style={styles.planFeatureRow}>
                <Check size={13} color="#6B7280" />
                <Text style={styles.planFeatureTextFree}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Pro card */}
          <View style={[styles.planCard, styles.planCardPro]}>
            {/* Glow border */}
            <View style={styles.proGlow} />

            <View style={styles.popularBadge}>
              <Star size={10} color="#0F172A" fill="#0F172A" />
              <Text style={styles.popularBadgeText}>Most Popular</Text>
            </View>

            <Text style={styles.planNamePro}>Pro</Text>
            <View style={styles.proPriceRow}>
              <Text style={styles.planPricePro}>₹999</Text>
              <Text style={styles.planPriceProSub}>/mo</Text>
            </View>
            <Text style={styles.planPriceProNote}>Billed monthly · Cancel anytime</Text>
            <View style={[styles.planDivider, styles.planDividerPro]} />

            {[
              'Up to 10 active listings',
              'Featured search placement',
              'Full analytics dashboard',
              'Verified owner badge',
              'Priority support',
              'WhatsApp lead alerts',
            ].map((f) => (
              <View key={f} style={styles.planFeatureRow}>
                <Check size={13} color="#F59E0B" />
                <Text style={styles.planFeatureTextPro}>{f}</Text>
              </View>
            ))}

            <Pressable
              onPress={handleUpgradePress}
              style={[styles.upgradeBtn, onWaitlist && styles.upgradeBtnDone]}
            >
              {checkingRequest ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : onWaitlist ? (
                <>
                  <BadgeCheck size={17} color="#0F172A" />
                  <Text style={styles.upgradeBtnText}>You're on the waitlist!</Text>
                </>
              ) : (
                <>
                  <TrendingUp size={17} color="#0F172A" />
                  <Text style={styles.upgradeBtnText}>Upgrade Now</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Feature comparison ── */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Full Comparison</Text>

          {/* Header row */}
          <View style={[styles.compRow, styles.compHeaderRow]}>
            <Text style={[styles.compCell, styles.compFeatureHeader]}>Feature</Text>
            <Text style={[styles.compCellCenter, styles.compPlanHeader]}>Free</Text>
            <Text style={[styles.compCellCenter, styles.compPlanHeaderPro]}>Pro</Text>
          </View>

          {COMPARISON.map(({ label, free, pro }, i) => (
            <View
              key={label}
              style={[styles.compRow, i % 2 === 0 && styles.compRowAlt]}
            >
              <Text style={styles.compCell}>{label}</Text>
              <View style={styles.compCellCenter}>
                <CompValue value={free} isPro={false} />
              </View>
              <View style={styles.compCellCenter}>
                <CompValue value={pro} isPro />
              </View>
            </View>
          ))}
        </View>

        {/* ── Pro highlights ── */}
        <View style={styles.highlightsRow}>
          {[
            { Icon: BarChart2, title: 'Analytics', desc: 'Views, shortlists\n& contact stats' },
            { Icon: BadgeCheck, title: 'Verified Badge', desc: 'Builds trust\nwith tenants' },
            { Icon: Bell, title: 'Lead Alerts', desc: 'Instant WhatsApp\nnotifications' },
          ].map(({ Icon, title, desc }) => (
            <View key={title} style={styles.highlightCard}>
              <Icon size={22} color="#F59E0B" />
              <Text style={styles.highlightTitle}>{title}</Text>
              <Text style={styles.highlightDesc}>{desc}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Bottom sheet: waitlist signup ── */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          {notifyMutation.isSuccess || submitted ? (
            /* Success state */
            <View style={styles.sheetSuccess}>
              <View style={styles.sheetSuccessIcon}>
                <BadgeCheck size={36} color="#F59E0B" />
              </View>
              <Text style={styles.sheetSuccessTitle}>You're on the waitlist!</Text>
              <Text style={styles.sheetSuccessDesc}>
                We'll email you the moment Pro is available. Thanks for your interest!
              </Text>
              <Pressable onPress={() => sheetRef.current?.close()} style={styles.sheetDoneBtn}>
                <Text style={styles.sheetDoneBtnText}>Got it</Text>
              </Pressable>
            </View>
          ) : (
            /* Sign-up state */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.sheetTopRow}>
                <Text style={styles.sheetTitle}>Payment coming soon!</Text>
                <Pressable onPress={() => sheetRef.current?.close()} hitSlop={10}>
                  <X size={20} color="#9CA3AF" />
                </Pressable>
              </View>

              <Text style={styles.sheetDesc}>
                We're setting up secure payments. Leave your email and we'll notify you the moment Pro is available.
              </Text>

              <Text style={styles.sheetInputLabel}>Your Email</Text>
              <TextInput
                style={styles.sheetInput}
                value={sheetEmail}
                onChangeText={setSheetEmail}
                placeholder="you@email.com"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleNotifyMe}
              />

              <Pressable
                onPress={handleNotifyMe}
                style={[styles.notifyBtn, notifyMutation.isPending && styles.notifyBtnDisabled]}
                disabled={notifyMutation.isPending}
              >
                {notifyMutation.isPending ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <>
                    <Bell size={16} color="#0F172A" />
                    <Text style={styles.notifyBtnText}>Notify Me</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.sheetNote}>No spam. Just one email when it launches.</Text>
            </KeyboardAvoidingView>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  )
}

// ─── Comparison cell value ────────────────────────────────────────────────────

function CompValue({ value, isPro }: { value: boolean | string; isPro: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check size={16} color={isPro ? '#F59E0B' : '#10B981'} />
    ) : (
      <X size={15} color="#4B5563" />
    )
  }
  return (
    <Text style={[styles.compValueText, isPro && styles.compValueTextPro]}>{value}</Text>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Plan cards
  planRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  planCardFree: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  planCardPro: {
    backgroundColor: '#1A1208',
    borderWidth: 1.5,
    borderColor: '#D97706',
    position: 'relative',
  },
  proGlow: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    height: 80,
    backgroundColor: '#F59E0B',
    opacity: 0.08,
    borderRadius: 40,
  },

  // Plan header
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  currentBadge: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#60A5FA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Plan names & prices
  planNameFree: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
  },
  planNamePro: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planPriceFree: {
    fontSize: 26,
    fontWeight: '800',
    color: '#E2E8F0',
    marginTop: 8,
  },
  planPriceSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  proPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  planPricePro: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
  },
  planPriceProSub: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    opacity: 0.8,
  },
  planPriceProNote: {
    fontSize: 10,
    color: '#78716C',
    marginBottom: 12,
    marginTop: 2,
  },

  planDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 12,
  },
  planDividerPro: {
    backgroundColor: '#292112',
  },

  // Plan features
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginBottom: 8,
  },
  planFeatureTextFree: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 16,
  },
  planFeatureTextPro: {
    fontSize: 11,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 16,
  },

  // Upgrade button
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
  },
  upgradeBtnDone: {
    backgroundColor: '#1D4028',
    borderWidth: 1,
    borderColor: '#166534',
  },
  upgradeBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },

  // Feature comparison table
  comparisonCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    overflow: 'hidden',
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  compHeaderRow: {
    backgroundColor: '#0F172A',
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  compRowAlt: {
    backgroundColor: '#162032',
  },
  compCell: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
  },
  compCellCenter: {
    width: 70,
    alignItems: 'center',
  },
  compFeatureHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compPlanHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    width: 70,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compPlanHeaderPro: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    width: 70,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compValueText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  compValueTextPro: {
    color: '#F59E0B',
    fontWeight: '600',
  },

  // Pro highlights
  highlightsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    textAlign: 'center',
  },
  highlightDesc: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Bottom sheet
  sheetBg: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    backgroundColor: '#475569',
    width: 36,
  },
  sheetContent: {
    padding: 24,
    paddingTop: 8,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  sheetDesc: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 20,
  },
  sheetInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  sheetInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#F1F5F9',
    marginBottom: 14,
  },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 12,
  },
  notifyBtnDisabled: {
    backgroundColor: '#78350F',
  },
  notifyBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetNote: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },

  // Sheet success
  sheetSuccess: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  sheetSuccessIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1208',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D97706',
    marginBottom: 4,
  },
  sheetSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  sheetSuccessDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  sheetDoneBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 13,
    marginTop: 8,
  },
  sheetDoneBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
})
