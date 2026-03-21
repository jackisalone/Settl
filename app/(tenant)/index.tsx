import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Bell } from 'lucide-react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useShortlistStore } from '@/store/shortlistStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'
import PGCard from '@/components/PGCard'
import type { Tables } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const CITIES = ['All', 'Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Pune', 'Hyderabad']

// ─── Data fetching ────────────────────────────────────────────────────────────

type ListingRow = Tables<'pg_listings'> & { reviews: { rating: number | null }[] }

interface ListingWithStats {
  listing: PGListing
  rating: number
  reviewCount: number
}

async function fetchListingsPage(
  pageParam: number,
  city: string,
): Promise<ListingWithStats[]> {
  const from = pageParam * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('pg_listings')
    .select('*, reviews(rating)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (city !== 'All') {
    query = query.eq('city', city)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as ListingRow[]).map((row) => {
    const reviews = row.reviews ?? []
    const reviewCount = reviews.length
    const rating =
      reviewCount > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewCount) * 10,
          ) / 10
        : 0
    return { listing: mapPGListing(row), rating, reviewCount }
  })
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonPhoto} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '45%', marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '35%', marginTop: 8, height: 22 }]} />
      </View>
    </Animated.View>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  name: string | null
  avatarUrl: string | null | undefined
}

function Header({ name, avatarUrl }: HeaderProps) {
  const initial = name?.[0]?.toUpperCase() ?? '?'

  return (
    <View style={styles.header}>
      <Text style={styles.wordmark}>settl</Text>
      <View style={styles.headerRight}>
        <Pressable hitSlop={10} style={styles.bellButton}>
          <Bell size={22} color="#374151" />
        </Pressable>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
        </View>
      </View>
    </View>
  )
}

// ─── City filter bar ──────────────────────────────────────────────────────────

interface CityFilterProps {
  selected: string
  onSelect: (city: string) => void
}

function CityFilter({ selected, onSelect }: CityFilterProps) {
  return (
    <View style={styles.cityFilterWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cityFilterContent}
      >
        {CITIES.map((city) => {
          const active = city === selected
          return (
            <Pressable
              key={city}
              onPress={() => onSelect(city)}
              style={[styles.cityPill, active && styles.cityPillActive]}
            >
              <Text style={[styles.cityPillText, active && styles.cityPillTextActive]}>
                {city}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ city }: { city: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyTitle}>
        No PGs found{city !== 'All' ? ` in ${city}` : ''}
      </Text>
      <Text style={styles.emptySubtitle}>Check back soon — more listings coming!</Text>
    </View>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function TenantHomeScreen() {
  const router = useRouter()
  const { profile, session } = useAuthStore()
  const { shortlistedIds, setShortlistedIds, addToShortlist, removeFromShortlist } =
    useShortlistStore()

  // Default city to user's profile city, fallback to 'All'
  const defaultCity =
    profile?.city && CITIES.includes(profile.city) ? profile.city : 'All'
  const [activeCity, setActiveCity] = useState(defaultCity)

  // ── Fetch shortlists on mount ───────────────────────────────────────────────
  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    supabase
      .from('shortlists')
      .select('pg_id')
      .eq('tenant_id', userId)
      .then(({ data }) => {
        if (data) {
          setShortlistedIds(
            data.map((s) => s.pg_id).filter(Boolean) as string[],
          )
        }
      })
  }, [session?.user.id])

  // ── Listings query ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['listings', activeCity],
    queryFn: ({ pageParam }) => fetchListingsPage(pageParam as number, activeCity),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  })

  const listings = data?.pages.flat() ?? []

  // ── Shortlist toggle ───────────────────────────────────────────────────────
  async function handleShortlist(pgId: string) {
    const userId = session?.user.id
    if (!userId) return

    const already = shortlistedIds.has(pgId)

    if (already) {
      removeFromShortlist(pgId) // optimistic
      const { error } = await supabase
        .from('shortlists')
        .delete()
        .eq('tenant_id', userId)
        .eq('pg_id', pgId)
      if (error) addToShortlist(pgId) // revert
    } else {
      addToShortlist(pgId) // optimistic
      const { error } = await supabase
        .from('shortlists')
        .insert({ tenant_id: userId, pg_id: pgId })
      if (error) removeFromShortlist(pgId) // revert
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header name={profile?.name ?? null} avatarUrl={profile?.avatarUrl} />

      <CityFilter
        selected={activeCity}
        onSelect={(city) => setActiveCity(city)}
      />

      {isLoading ? (
        // Initial skeleton
        <ScrollView contentContainerStyle={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.listing.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState city={activeCity} />}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color="#2563EB" style={{ paddingVertical: 20 }} />
            ) : null
          }
          renderItem={({ item }) => (
            <PGCard
              listing={item.listing}
              rating={item.rating}
              reviewCount={item.reviewCount}
              isShortlisted={shortlistedIds.has(item.listing.id)}
              onShortlist={() => handleShortlist(item.listing.id)}
              onPress={() => router.push(`/(tenant)/listing/${item.listing.id}`)}
            />
          )}
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },

  // City filter
  cityFilterWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  cityPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  cityPillActive: {
    backgroundColor: '#2563EB',
  },
  cityPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  cityPillTextActive: {
    color: '#fff',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    marginBottom: 16,
  },
  skeletonPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
  },
  skeletonBody: {
    padding: 14,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 7,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
})
