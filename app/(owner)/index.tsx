import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import {
  Building2,
  Eye,
  Heart,
  Pencil,
  Plus,
  Power,
  TrendingUp,
  X,
} from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalShortlists: number
  activeListings: number
  totalListings: number
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchOwnerListings(ownerId: string): Promise<PGListing[]> {
  const { data, error } = await supabase
    .from('pg_listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapPGListing)
}

async function fetchDashboardStats(ownerId: string): Promise<DashboardStats> {
  const [listingsRes, shortlistsRes] = await Promise.all([
    supabase
      .from('pg_listings')
      .select('id, is_active')
      .eq('owner_id', ownerId),
    supabase
      .from('shortlists')
      .select('id', { count: 'exact', head: true })
      .in(
        'pg_id',
        // sub-select owner's listing IDs
        supabase
          .from('pg_listings')
          .select('id')
          .eq('owner_id', ownerId) as any,
      ),
  ])

  const listings = listingsRes.data ?? []
  const activeListings = listings.filter((l) => l.is_active).length
  const totalListings = listings.length
  const totalShortlists = shortlistsRes.count ?? 0

  return { totalShortlists, activeListings, totalListings }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  accent: string
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Subscription banner ──────────────────────────────────────────────────────

function SubscriptionBanner({
  onUpgrade,
  onDismiss,
}: {
  onUpgrade: () => void
  onDismiss: () => void
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerLeft}>
        <TrendingUp size={16} color="#92400E" />
        <Text style={styles.bannerText}>
          Free plan — only 1 active listing allowed
        </Text>
      </View>
      <View style={styles.bannerActions}>
        <Pressable onPress={onUpgrade} style={styles.upgradeBtn}>
          <Text style={styles.upgradeBtnText}>Upgrade</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <X size={16} color="#92400E" />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Compact listing card ─────────────────────────────────────────────────────

interface ListingCardProps {
  listing: PGListing
  onEdit: () => void
  onToggleActive: () => void
}

function ListingCard({ listing, onEdit, onToggleActive }: ListingCardProps) {
  const swipeRef = useRef<Swipeable>(null)

  function renderRightActions() {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close()
          onToggleActive()
        }}
        style={[
          styles.swipeAction,
          {
            backgroundColor: listing.isActive ? '#F59E0B' : '#10B981',
          },
        ]}
      >
        <Power size={18} color="#fff" />
        <Text style={styles.swipeActionText}>
          {listing.isActive ? 'Deactivate' : 'Activate'}
        </Text>
      </Pressable>
    )
  }

  function renderLeftActions() {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close()
          onEdit()
        }}
        style={[styles.swipeAction, { backgroundColor: '#2563EB' }]}
      >
        <Pencil size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Edit</Text>
      </Pressable>
    )
  }

  const photoUrl = listing.photos?.[0] ?? null

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      <View style={styles.listingCard}>
        {/* Thumbnail */}
        <View style={styles.thumbnail}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Building2 size={28} color="#9CA3AF" />
          )}
        </View>

        {/* Info */}
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <Text style={styles.listingLocality} numberOfLines={1}>
            📍 {listing.locality}, {listing.city}
          </Text>
          <Text style={styles.listingRent}>
            ₹{listing.rent.toLocaleString('en-IN')}/mo
          </Text>
        </View>

        {/* Right side */}
        <View style={styles.listingRight}>
          <View
            style={[
              styles.statusBadge,
              listing.isActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                listing.isActive ? styles.statusTextActive : styles.statusTextInactive,
              ]}
            >
              {listing.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <Pressable onPress={onEdit} hitSlop={10} style={styles.editIconBtn}>
            <Pencil size={15} color="#6B7280" />
          </Pressable>
        </View>
      </View>
    </Swipeable>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <Building2 size={44} color="#93C5FD" />
      </View>
      <Text style={styles.emptyTitle}>No listings yet</Text>
      <Text style={styles.emptySubtitle}>
        You haven't listed any PGs yet.{'\n'}Add your first listing to get started.
      </Text>
      <Pressable onPress={onAdd} style={styles.addFirstBtn}>
        <Plus size={18} color="#fff" />
        <Text style={styles.addFirstBtnText}>Add your first listing</Text>
      </Pressable>
    </View>
  )
}

// ─── Owner dashboard ──────────────────────────────────────────────────────────

export default function OwnerDashboardScreen() {
  const router = useRouter()
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const ownerId = session?.user.id

  const [bannerDismissed, setBannerDismissed] = useState(false)

  // ── Listings query ─────────────────────────────────────────────────────────
  const {
    data: listings = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-listings', ownerId],
    queryFn: () => fetchOwnerListings(ownerId!),
    enabled: !!ownerId,
  })

  // ── Stats query ────────────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['owner-stats', ownerId],
    queryFn: () => fetchDashboardStats(ownerId!),
    enabled: !!ownerId,
  })

  const activeCount = stats?.activeListings ?? listings.filter((l) => l.isActive).length
  const showBanner = !bannerDismissed && activeCount >= 1

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function handleToggleActive(listing: PGListing) {
    const newValue = !listing.isActive

    // Optimistic update in cache
    queryClient.setQueryData<PGListing[]>(
      ['owner-listings', ownerId],
      (prev) =>
        prev?.map((l) =>
          l.id === listing.id ? { ...l, isActive: newValue } : l,
        ) ?? [],
    )

    const { error: updateError } = await supabase
      .from('pg_listings')
      .update({ is_active: newValue })
      .eq('id', listing.id)

    if (updateError) {
      // Revert
      queryClient.setQueryData<PGListing[]>(
        ['owner-listings', ownerId],
        (prev) =>
          prev?.map((l) =>
            l.id === listing.id ? { ...l, isActive: listing.isActive } : l,
          ) ?? [],
      )
    } else {
      queryClient.invalidateQueries({ queryKey: ['owner-stats', ownerId] })
    }
  }

  // ── Navigate to edit ───────────────────────────────────────────────────────
  function handleEdit(listingId: string) {
    router.push(`/(owner)/listing/form?listingId=${listingId}`)
  }

  function handleAddListing() {
    router.push('/(owner)/listing/form')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Listings</Text>
        <Pressable onPress={handleAddListing} style={styles.addBtn}>
          <Plus size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Listing</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#2563EB" size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Failed to load listings</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            listings.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          ListHeaderComponent={
            <>
              {/* Subscription banner */}
              {showBanner && (
                <SubscriptionBanner
                  onUpgrade={() => router.push('/(owner)/subscription')}
                  onDismiss={() => setBannerDismissed(true)}
                />
              )}

              {/* Stats row */}
              <View style={styles.statsRow}>
                <StatCard
                  icon={<Eye size={20} color="#2563EB" />}
                  value="—"
                  label="Views"
                  accent="#2563EB"
                />
                <StatCard
                  icon={<Heart size={20} color="#EF4444" />}
                  value={stats?.totalShortlists ?? '—'}
                  label="Shortlists"
                  accent="#EF4444"
                />
                <StatCard
                  icon={<Building2 size={20} color="#10B981" />}
                  value={`${activeCount}/${stats?.totalListings ?? listings.length}`}
                  label="Active"
                  accent="#10B981"
                />
              </View>

              {/* List heading */}
              {listings.length > 0 && (
                <Text style={styles.listHeading}>
                  {listings.length} listing{listings.length !== 1 ? 's' : ''}
                </Text>
              )}
            </>
          }
          ListEmptyComponent={<EmptyState onAdd={handleAddListing} />}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onEdit={() => handleEdit(item.id)}
              onToggleActive={() => handleToggleActive(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
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
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bannerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 5,
    borderTopWidth: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },

  listHeading: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 10,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 8,
  },

  // Listing card
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listingInfo: {
    flex: 1,
    gap: 3,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  listingLocality: {
    fontSize: 12,
    color: '#6B7280',
  },
  listingRent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 2,
  },
  listingRight: {
    alignItems: 'flex-end',
    gap: 10,
    flexShrink: 0,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#065F46',
  },
  statusTextInactive: {
    color: '#6B7280',
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Swipe actions
  swipeAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    marginVertical: 0,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 12,
  },
  emptyIllustration: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  addFirstBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Error state
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#374151',
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
})
