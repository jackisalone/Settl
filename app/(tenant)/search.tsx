import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react-native'
import { BottomSheetModal, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useShortlistStore } from '@/store/shortlistStore'
import { useAuthStore } from '@/store/authStore'
import {
  useSearchStore,
  FILTER_AMENITIES,
  type RoomType,
  type FilterAmenity,
} from '@/store/searchStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'
import PGCard from '@/components/PGCard'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CITIES = ['All', 'Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Pune', 'Hyderabad']

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
]

// ─── Data fetching ────────────────────────────────────────────────────────────

interface SearchFilters {
  query: string
  minRent: string
  maxRent: string
  roomTypes: RoomType[]
  amenities: FilterAmenity[]
  city: string
}

async function fetchSearchResults(filters: SearchFilters, page: number): Promise<PGListing[]> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = supabase
    .from('pg_listings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.query.trim()) {
    q = q.or(
      `locality.ilike.%${filters.query.trim()}%,city.ilike.%${filters.query.trim()}%,title.ilike.%${filters.query.trim()}%`,
    )
  }
  if (filters.city !== 'All') q = q.eq('city', filters.city)
  if (filters.minRent) q = q.gte('rent', Number(filters.minRent))
  if (filters.maxRent) q = q.lte('rent', Number(filters.maxRent))
  if (filters.roomTypes.length > 0) q = q.in('room_type', filters.roomTypes)
  if (filters.amenities.length > 0) q = q.contains('amenities', filters.amenities)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapPGListing)
}

async function fetchResultCount(filters: SearchFilters): Promise<number> {
  let q = supabase
    .from('pg_listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (filters.query.trim()) {
    q = q.or(
      `locality.ilike.%${filters.query.trim()}%,city.ilike.%${filters.query.trim()}%,title.ilike.%${filters.query.trim()}%`,
    )
  }
  if (filters.city !== 'All') q = q.eq('city', filters.city)
  if (filters.minRent) q = q.gte('rent', Number(filters.minRent))
  if (filters.maxRent) q = q.lte('rent', Number(filters.maxRent))
  if (filters.roomTypes.length > 0) q = q.in('room_type', filters.roomTypes)
  if (filters.amenities.length > 0) q = q.contains('amenities', filters.amenities)

  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

// ─── Active filter chips ──────────────────────────────────────────────────────

function ActiveFilterChips() {
  const {
    minRent, maxRent, roomTypes, amenities, city,
    setMinRent, setMaxRent, toggleRoomType, toggleAmenity, setCity,
  } = useSearchStore()

  const chips: { label: string; onRemove: () => void }[] = []

  if (minRent || maxRent) {
    const label = minRent && maxRent
      ? `₹${Number(minRent).toLocaleString('en-IN')} – ₹${Number(maxRent).toLocaleString('en-IN')}`
      : minRent
        ? `Min ₹${Number(minRent).toLocaleString('en-IN')}`
        : `Max ₹${Number(maxRent).toLocaleString('en-IN')}`
    chips.push({ label, onRemove: () => { setMinRent(''); setMaxRent('') } })
  }

  roomTypes.forEach((rt) =>
    chips.push({
      label: rt.charAt(0).toUpperCase() + rt.slice(1),
      onRemove: () => toggleRoomType(rt),
    }),
  )

  amenities.forEach((a) =>
    chips.push({ label: a, onRemove: () => toggleAmenity(a) }),
  )

  if (city !== 'All') {
    chips.push({ label: city, onRemove: () => setCity('All') })
  }

  if (chips.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContent}
      style={styles.chipsRow}
    >
      {chips.map((chip) => (
        <View key={chip.label} style={styles.filterChip}>
          <Text style={styles.filterChipText}>{chip.label}</Text>
          <Pressable onPress={chip.onRemove} hitSlop={8}>
            <X size={12} color="#374151" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  )
}

// ─── Filter bottom sheet ──────────────────────────────────────────────────────

interface FilterSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>
}

function FilterSheet({ sheetRef }: FilterSheetProps) {
  const {
    minRent, maxRent, roomTypes, amenities, city,
    setMinRent, setMaxRent, toggleRoomType, toggleAmenity, setCity, resetFilters,
  } = useSearchStore()

  // Draft state — applied only on "Show PGs" press
  const [draftMin, setDraftMin] = useState(minRent)
  const [draftMax, setDraftMax] = useState(maxRent)
  const [draftRooms, setDraftRooms] = useState<RoomType[]>(roomTypes)
  const [draftAmenities, setDraftAmenities] = useState<FilterAmenity[]>(amenities)
  const [draftCity, setDraftCity] = useState(city)

  // Count for draft state
  const draftFilters: SearchFilters = {
    query: useSearchStore.getState().query,
    minRent: draftMin,
    maxRent: draftMax,
    roomTypes: draftRooms,
    amenities: draftAmenities,
    city: draftCity,
  }

  const { data: resultCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ['filter-count', draftFilters],
    queryFn: () => fetchResultCount(draftFilters),
    staleTime: 3000,
  })

  // Sync draft back from store when sheet opens
  const snapPoints = useMemo(() => ['75%', '90%'], [])

  function toggleDraftRoom(rt: RoomType) {
    setDraftRooms((prev) =>
      prev.includes(rt) ? prev.filter((r) => r !== rt) : [...prev, rt],
    )
  }

  function toggleDraftAmenity(a: FilterAmenity) {
    setDraftAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    )
  }

  function handleApply() {
    setMinRent(draftMin)
    setMaxRent(draftMax)
    draftRooms.forEach((rt) => { if (!roomTypes.includes(rt)) toggleRoomType(rt) })
    roomTypes.forEach((rt) => { if (!draftRooms.includes(rt)) toggleRoomType(rt) })
    draftAmenities.forEach((a) => { if (!amenities.includes(a)) toggleAmenity(a) })
    amenities.forEach((a) => { if (!draftAmenities.includes(a)) toggleAmenity(a) })
    setCity(draftCity)
    sheetRef.current?.dismiss()
  }

  function handleReset() {
    setDraftMin('')
    setDraftMax('')
    setDraftRooms([])
    setDraftAmenities([])
    setDraftCity('All')
    resetFilters()
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Filters</Text>

        {/* Budget */}
        <Text style={styles.filterLabel}>Budget (monthly rent)</Text>
        <View style={styles.budgetRow}>
          <TextInput
            style={styles.budgetInput}
            placeholder="Min rent"
            placeholderTextColor="#9CA3AF"
            value={draftMin}
            onChangeText={(t) => setDraftMin(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />
          <Text style={styles.budgetSep}>–</Text>
          <TextInput
            style={styles.budgetInput}
            placeholder="Max rent"
            placeholderTextColor="#9CA3AF"
            value={draftMax}
            onChangeText={(t) => setDraftMax(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />
        </View>

        {/* Room type */}
        <Text style={styles.filterLabel}>Room Type</Text>
        <View style={styles.pillToggleRow}>
          {ROOM_TYPE_OPTIONS.map(({ value, label }) => {
            const active = draftRooms.includes(value)
            return (
              <Pressable
                key={value}
                onPress={() => toggleDraftRoom(value)}
                style={[styles.pillToggle, active && styles.pillToggleActive]}
              >
                <Text style={[styles.pillToggleText, active && styles.pillToggleTextActive]}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Amenities */}
        <Text style={styles.filterLabel}>Amenities</Text>
        <View style={styles.amenityGrid}>
          {FILTER_AMENITIES.map((a) => {
            const active = draftAmenities.includes(a)
            return (
              <Pressable
                key={a}
                onPress={() => toggleDraftAmenity(a)}
                style={[styles.amenityToggle, active && styles.amenityToggleActive]}
              >
                <Text style={[styles.amenityToggleText, active && styles.amenityToggleTextActive]}>
                  {a}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* City */}
        <Text style={styles.filterLabel}>City</Text>
        <View style={styles.pillToggleRow}>
          {CITIES.map((c) => {
            const active = draftCity === c
            return (
              <Pressable
                key={c}
                onPress={() => setDraftCity(c)}
                style={[styles.pillToggle, active && styles.pillToggleActive]}
              >
                <Text style={[styles.pillToggleText, active && styles.pillToggleTextActive]}>
                  {c}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Actions */}
        <View style={styles.sheetActions}>
          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
          <Pressable onPress={handleApply} style={styles.applyBtn}>
            <Text style={styles.applyBtnText}>
              {countLoading
                ? 'Loading…'
                : `Show ${resultCount} PG${resultCount !== 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No PGs match your search</Text>
      <Text style={styles.emptySubtitle}>Try different keywords or adjust filters</Text>
    </View>
  )
}

// ─── Search screen ────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter()
  const { session } = useAuthStore()
  const { shortlistedIds, addToShortlist, removeFromShortlist } = useShortlistStore()
  const sheetRef = useRef<BottomSheetModal>(null)

  const {
    query, minRent, maxRent, roomTypes, amenities, city,
    setQuery, hasActiveFilters,
  } = useSearchStore()

  // Debounced query — 400ms
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const filters: SearchFilters = {
    query: debouncedQuery,
    minRent,
    maxRent,
    roomTypes,
    amenities,
    city,
  }

  const queryEnabled = !!(
    debouncedQuery.trim() ||
    minRent ||
    maxRent ||
    roomTypes.length ||
    amenities.length ||
    city !== 'All'
  )

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['search', filters],
    queryFn: ({ pageParam }) => fetchSearchResults(filters, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    enabled: queryEnabled,
    staleTime: 30_000,
  })

  const results = data?.pages.flat() ?? []

  const openSheet = useCallback(() => {
    Keyboard.dismiss()
    sheetRef.current?.present()
  }, [])

  async function handleShortlist(pgId: string) {
    const userId = session?.user.id
    if (!userId) return
    if (shortlistedIds.has(pgId)) {
      removeFromShortlist(pgId)
      const { error } = await supabase
        .from('shortlists')
        .delete()
        .eq('tenant_id', userId)
        .eq('pg_id', pgId)
      if (error) addToShortlist(pgId)
    } else {
      addToShortlist(pgId)
      const { error } = await supabase
        .from('shortlists')
        .insert({ tenant_id: userId, pg_id: pgId })
      if (error) removeFromShortlist(pgId)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* ── Search bar ── */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <SearchIcon size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by area, locality..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <X size={16} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          <Pressable onPress={openSheet} style={styles.filtersButton}>
            <SlidersHorizontal
              size={18}
              color={hasActiveFilters() ? '#2563EB' : '#374151'}
            />
            {hasActiveFilters() && <View style={styles.filtersDot} />}
          </Pressable>
        </View>

        {/* ── Active filter chips ── */}
        <ActiveFilterChips />

        {/* ── Results ── */}
        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : !queryEnabled ? (
          <View style={styles.promptState}>
            <Text style={styles.promptIcon}>🏠</Text>
            <Text style={styles.promptText}>Search for a locality or apply filters</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              results.length > 0 ? (
                <Text style={styles.resultCount}>
                  {results.length} PG{results.length !== 1 ? 's' : ''} found
                  {hasNextPage ? '+' : ''}
                </Text>
              ) : null
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} />
              ) : null
            }
            ListEmptyComponent={<EmptyState />}
            renderItem={({ item }) => (
              <PGCard
                listing={item}
                isShortlisted={shortlistedIds.has(item.id)}
                onShortlist={() => handleShortlist(item.id)}
                onPress={() => router.push(`/(tenant)/listing/${item.id}`)}
              />
            )}
          />
        )}
      </KeyboardAvoidingView>

      <FilterSheet sheetRef={sheetRef} />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Search bar
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  filtersButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },

  // Active filter chips
  chipsRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chipsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, color: '#1D4ED8', fontWeight: '500' },

  // Results
  listContent: { padding: 16, paddingBottom: 32 },
  resultCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 14,
  },

  // Prompt state
  promptState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  promptIcon: { fontSize: 48 },
  promptText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF' },

  // Bottom sheet
  sheetBackground: { backgroundColor: '#fff', borderRadius: 20 },
  sheetHandle: { backgroundColor: '#E5E7EB', width: 40 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    marginTop: 4,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 20,
  },

  // Budget inputs
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  budgetSep: { fontSize: 18, color: '#9CA3AF', fontWeight: '300' },

  // Pill toggles (room type & city)
  pillToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillToggle: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  pillToggleActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  pillToggleText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  pillToggleTextActive: { color: '#1D4ED8' },

  // Amenity grid
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityToggle: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  amenityToggleActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  amenityToggleText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  amenityToggleTextActive: { color: '#1D4ED8' },

  // Sheet actions
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  resetBtn: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  applyBtn: {
    flex: 2,
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
