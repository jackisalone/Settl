import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Swipeable } from 'react-native-gesture-handler'
import { Trash2 } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useShortlistStore } from '@/store/shortlistStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'
import PGCard from '@/components/PGCard'
import type { Tables } from '@/types/database'

// ─── Types & fetch ────────────────────────────────────────────────────────────

type ShortlistRow = {
  id: string
  pg_id: string | null
  created_at: string | null
  pg_listings: Tables<'pg_listings'> | null
}

interface ShortlistItem {
  shortlistId: string
  listing: PGListing
}

async function fetchShortlistedListings(userId: string): Promise<ShortlistItem[]> {
  const { data, error } = await supabase
    .from('shortlists')
    .select('id, pg_id, created_at, pg_listings(*)')
    .eq('tenant_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as ShortlistRow[])
    .filter((row) => row.pg_listings != null)
    .map((row) => ({
      shortlistId: row.id,
      listing: mapPGListing(row.pg_listings!),
    }))
}

// ─── Swipe delete action ──────────────────────────────────────────────────────

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.deleteAction}>
      <Trash2 size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Remove</Text>
    </Pressable>
  )
}

// ─── Swipeable card row ───────────────────────────────────────────────────────

interface SwipeableCardProps {
  item: ShortlistItem
  isShortlisted: boolean
  onShortlist: () => void
  onRemove: () => void
}

function SwipeableCard({ item, isShortlisted, onShortlist, onRemove }: SwipeableCardProps) {
  const swipeRef = useRef<Swipeable>(null)
  const router = useRouter()

  function handleRemove() {
    swipeRef.current?.close()
    onRemove()
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={72}
      overshootRight={false}
      renderRightActions={() => <DeleteAction onPress={handleRemove} />}
    >
      <View style={styles.cardWrapper}>
        <PGCard
          listing={item.listing}
          isShortlisted={isShortlisted}
          onShortlist={onShortlist}
          onPress={() => router.push(`/(tenant)/listing/${item.listing.id}`)}
        />
      </View>
    </Swipeable>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const router = useRouter()

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyHouseIcon}>🏠</Text>
      </View>
      <Text style={styles.emptyTitle}>No PGs shortlisted yet</Text>
      <Text style={styles.emptySubtitle}>
        Start exploring and tap ♡ to save PGs you like
      </Text>
      <Pressable
        onPress={() => router.replace('/(tenant)')}
        style={styles.exploreBtn}
      >
        <Text style={styles.exploreBtnText}>Explore PGs</Text>
      </Pressable>
    </View>
  )
}

// ─── Shortlist screen ─────────────────────────────────────────────────────────

export default function ShortlistScreen() {
  const { session } = useAuthStore()
  const { shortlistedIds, addToShortlist, removeFromShortlist } = useShortlistStore()
  const queryClient = useQueryClient()
  const userId = session?.user.id

  // Optimistic removal — IDs that have been swiped away locally
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shortlist', userId],
    queryFn: () => fetchShortlistedListings(userId!),
    enabled: !!userId,
  })

  // Filter out optimistically removed items
  const displayedItems = (data ?? []).filter(
    (item) => !pendingRemoveIds.has(item.listing.id),
  )

  async function handleRemove(pgId: string) {
    if (!userId) return

    // Optimistic: hide immediately
    setPendingRemoveIds((prev) => new Set([...prev, pgId]))
    removeFromShortlist(pgId)

    const { error: deleteError } = await supabase
      .from('shortlists')
      .delete()
      .eq('tenant_id', userId)
      .eq('pg_id', pgId)

    if (deleteError) {
      // Revert on failure
      setPendingRemoveIds((prev) => {
        const next = new Set(prev)
        next.delete(pgId)
        return next
      })
      addToShortlist(pgId)
    } else {
      // Clean up query cache
      queryClient.invalidateQueries({ queryKey: ['shortlist', userId] })
    }
  }

  // The heart button on the card also toggles shortlist —
  // if un-hearted from this screen, treat it as remove
  async function handleShortlist(pgId: string) {
    if (shortlistedIds.has(pgId)) {
      await handleRemove(pgId)
    } else {
      // Re-add (user tapped heart again after un-saving)
      addToShortlist(pgId)
      const { error: insertError } = await supabase
        .from('shortlists')
        .insert({ tenant_id: userId, pg_id: pgId })
      if (insertError) removeFromShortlist(pgId)
      else queryClient.invalidateQueries({ queryKey: ['shortlist', userId] })
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shortlisted PGs</Text>
        {displayedItems.length > 0 && (
          <Text style={styles.headerCount}>
            {displayedItems.length} saved
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator
          color="#2563EB"
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Failed to load shortlist</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : displayedItems.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => item.listing.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <SwipeableCard
              item={item}
              isShortlisted={shortlistedIds.has(item.listing.id)}
              onShortlist={() => handleShortlist(item.listing.id)}
              onRemove={() => handleRemove(item.listing.id)}
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
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Card wrapper — gives white bg so swipe reveal shows cleanly
  cardWrapper: {
    backgroundColor: '#F9FAFB',
  },

  // Swipe delete action
  deleteAction: {
    width: 88,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    marginBottom: 16,
    marginLeft: 8,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    paddingBottom: 60,
  },
  emptyIllustration: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyHouseIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreBtn: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exploreBtnText: {
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
