import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useRouter } from 'expo-router'

const PLANS = [
  {
    id: 'basic',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    accent: '#6B7280',
    features: ['1 active listing', 'Basic analytics', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹499',
    period: 'per month',
    accent: '#2563EB',
    popular: true,
    features: [
      'Unlimited active listings',
      'Advanced analytics',
      'Priority in search results',
      'WhatsApp lead notifications',
      'Priority support',
    ],
  },
]

export default function SubscriptionScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Upgrade Plan</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>Grow your listings with Pro</Text>
        <Text style={styles.subheadline}>
          Get more visibility and manage unlimited PGs.
        </Text>

        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[styles.planCard, plan.popular && styles.planCardPopular]}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most Popular</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, { color: plan.accent }]}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}> / {plan.period}</Text>
                </View>
              </View>
            </View>

            <View style={styles.featureList}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check size={14} color={plan.accent} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {plan.popular && (
              <Pressable style={[styles.planBtn, { backgroundColor: plan.accent }]}>
                <Text style={styles.planBtnText}>Upgrade to Pro</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Payments processed securely. Cancel anytime.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 8,
  },
  subheadline: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  planCardPopular: {
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 100,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  planPeriod: {
    fontSize: 13,
    color: '#6B7280',
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  planBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  planBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
})
