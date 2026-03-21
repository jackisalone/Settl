import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Car,
  Dumbbell,
  Droplets,
  Mail,
  Monitor,
  Navigation,
  Package,
  Phone,
  Shield,
  Sparkles,
  Star,
  Tv,
  Utensils,
  Wifi,
  Wind,
  Zap,
} from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShortlistStore } from '@/store/shortlistStore'
import { useAuthStore } from '@/store/authStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'
import type { Tables } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''

const AMENITY_ICON_MAP: Array<{
  match: RegExp
  Icon: React.ComponentType<{ size: number; color: string }>
  label?: string
}> = [
  { match: /wi.?fi|internet/i, Icon: Wifi },
  { match: /ac|air.con/i, Icon: Wind },
  { match: /park/i, Icon: Car },
  { match: /food|meal|mess|kitchen/i, Icon: Utensils },
  { match: /laundry|wash/i, Icon: Sparkles },
  { match: /secur|cctv|guard/i, Icon: Shield },
  { match: /power|backup|ups/i, Icon: Zap },
  { match: /water|geyser|hot/i, Icon: Droplets },
  { match: /gym|fitness/i, Icon: Dumbbell },
  { match: /tv|cable|entertain/i, Icon: Tv },
  { match: /comput|desktop|pc/i, Icon: Monitor },
]

function getAmenityIcon(amenity: string) {
  const found = AMENITY_ICON_MAP.find((entry) => entry.match.test(amenity))
  return found?.Icon ?? Package
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewWithUser = Tables<'reviews'> & {
  reviewer: { name: string | null; avatar_url: string | null } | null
}

type ListingRow = Tables<'pg_listings'> & {
  owner: {
    id: string
    name: string | null
    avatar_url: string | null
    phone: string | null
    email: string | null
    created_at: string | null
  } | null
  reviews: ReviewWithUser[]
}

interface DetailData {
  listing: PGListing
  owner: ListingRow['owner']
  reviews: ReviewWithUser[]
  avgRating: number
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDetail(id: string): Promise<DetailData> {
  const { data, error } = await supabase
    .from('pg_listings')
    .select(
      `*,
       owner:users!pg_listings_owner_id_fkey(id, name, avatar_url, phone, email, created_at),
       reviews(id, rating, text, created_at,
         reviewer:users!reviews_tenant_id_fkey(name, avatar_url)
       )`,
    )
    .eq('id', id)
    .single()

  if (error) throw error

  const row = data as unknown as ListingRow
  const reviews = row.reviews ?? []
  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length) * 10,
        ) / 10
      : 0

  return { listing: mapPGListing(row), owner: row.owner, reviews, avgRating }
}

// ─── Photo gallery ────────────────────────────────────────────────────────────

function PhotoGallery({
  photos,
  onBack,
}: {
  photos: string[]
  onBack: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const total = photos.length || 1

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
      setCurrentIndex(index)
    },
    [],
  )

  return (
    <View style={styles.galleryContainer}>
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={styles.galleryImage}
              contentFit="cover"
              transition={150}
            />
          )}
        />
      ) : (
        <View style={[styles.galleryImage, styles.galleryPlaceholder]}>
          <Text style={styles.galleryPlaceholderText}>No photos available</Text>
        </View>
      )}

      {/* Back button */}
      <Pressable onPress={onBack} style={styles.backButton} hitSlop={10}>
        <ArrowLeft size={22} color="#fff" />
      </Pressable>

      {/* Counter */}
      {photos.length > 1 && (
        <View style={styles.photoCounter}>
          <Text style={styles.photoCounterText}>
            {currentIndex + 1}/{total}
          </Text>
        </View>
      )}

      {/* Dots */}
      {photos.length > 1 && (
        <View style={styles.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Quick info pills ─────────────────────────────────────────────────────────

function QuickInfoPills({ listing }: { listing: PGListing }) {
  const ROOM_LABEL: Record<string, string> = {
    single: 'Single Room',
    double: 'Double Room',
    triple: 'Triple Room',
  }

  const pills: string[] = []
  if (listing.roomType) pills.push(ROOM_LABEL[listing.roomType] ?? listing.roomType)
  if (listing.availableFrom) {
    const d = new Date(listing.availableFrom)
    pills.push(
      `Available ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    )
  }

  return (
    <View style={styles.pillsRow}>
      {pills.map((p) => (
        <View key={p} style={styles.infoPill}>
          <Text style={styles.infoPillText}>{p}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Amenities grid ───────────────────────────────────────────────────────────

function AmenitiesGrid({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null

  return (
    <View style={styles.amenitiesGrid}>
      {amenities.map((amenity) => {
        const Icon = getAmenityIcon(amenity)
        return (
          <View key={amenity} style={styles.amenityCell}>
            <Icon size={20} color="#2563EB" />
            <Text style={styles.amenityCellText}>{amenity}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Description with read more/less ─────────────────────────────────────────

function DescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)

  return (
    <View>
      {/* Hidden full-text to measure actual line count */}
      <Text
        style={styles.hiddenMeasureText}
        onTextLayout={(e) => {
          if (!canExpand) setCanExpand(e.nativeEvent.lines.length > 3)
        }}
      >
        {text}
      </Text>

      <Text style={styles.descriptionText} numberOfLines={expanded ? undefined : 3}>
        {text}
      </Text>

      {canExpand && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.readMoreBtn}>
          <Text style={styles.readMoreText}>
            {expanded ? 'Read less ▲' : 'Read more ▼'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── Location section ─────────────────────────────────────────────────────────

function LocationSection({
  listing,
}: {
  listing: PGListing
}) {
  const { lat, lng, address, locality, city } = listing
  const hasCoords = lat != null && lng != null

  function openMaps() {
    if (!hasCoords) return
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
  }

  const mapUrl = hasCoords && GOOGLE_MAPS_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x300&markers=color:red%7C${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
    : null

  return (
    <View>
      <Text style={styles.locationAddress}>
        {address ? `${address}, ` : ''}{locality}, {city}
      </Text>

      {hasCoords && (
        <Pressable onPress={openMaps} style={styles.mapContainer}>
          {mapUrl ? (
            <Image
              source={{ uri: mapUrl }}
              style={styles.staticMap}
              contentFit="cover"
            />
          ) : (
            // Fallback when no API key: tappable placeholder
            <View style={[styles.staticMap, styles.mapPlaceholder]}>
              <Navigation size={28} color="#2563EB" />
              <Text style={styles.mapPlaceholderText}>
                Tap to open in Google Maps
              </Text>
            </View>
          )}
          <View style={styles.mapOverlay}>
            <Navigation size={14} color="#fff" />
            <Text style={styles.mapOverlayText}>Open in Maps</Text>
          </View>
        </Pressable>
      )}
    </View>
  )
}

// ─── Owner card ───────────────────────────────────────────────────────────────

function OwnerCard({
  owner,
}: {
  owner: NonNullable<ListingRow['owner']>
}) {
  const memberYear = owner.created_at
    ? new Date(owner.created_at).getFullYear()
    : null
  const initial = owner.name?.[0]?.toUpperCase() ?? '?'

  function handleContact() {
    if (owner.phone) {
      Linking.openURL(`tel:${owner.phone}`)
    } else if (owner.email) {
      Linking.openURL(`mailto:${owner.email}`)
    }
  }

  function handleMessage() {
    if (owner.phone) {
      // Ensure +91 country code for Indian numbers
      const phone = owner.phone.startsWith('+') ? owner.phone : `+91${owner.phone}`
      Linking.openURL(`whatsapp://send?phone=${phone}`)
    } else if (owner.email) {
      Linking.openURL(`mailto:${owner.email}`)
    }
  }

  return (
    <View style={styles.ownerCard}>
      <View style={styles.ownerInfo}>
        <View style={styles.ownerAvatar}>
          {owner.avatar_url ? (
            <Image
              source={{ uri: owner.avatar_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.ownerInitial}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerName}>{owner.name ?? 'Owner'}</Text>
          {memberYear && (
            <Text style={styles.ownerMeta}>Member since {memberYear}</Text>
          )}
        </View>
      </View>

      <View style={styles.ownerActions}>
        {(owner.phone || owner.email) && (
          <Pressable onPress={handleContact} style={styles.ownerContactBtn}>
            {owner.phone ? (
              <Phone size={16} color="#2563EB" />
            ) : (
              <Mail size={16} color="#2563EB" />
            )}
            <Text style={styles.ownerContactBtnText}>
              {owner.phone ? 'Call' : 'Email'}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={handleMessage} style={styles.messageOwnerBtn}>
          <Text style={styles.messageOwnerBtnText}>Message Owner</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

function ReviewItem({ review }: { review: ReviewWithUser }) {
  const initial = review.reviewer?.name?.[0]?.toUpperCase() ?? '?'
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          {review.reviewer?.avatar_url ? (
            <Image
              source={{ uri: review.reviewer.avatar_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.reviewAvatarText}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewerName}>
            {review.reviewer?.name ?? 'Anonymous'}
          </Text>
          <View style={styles.reviewStarRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                color="#F59E0B"
                fill={i < (review.rating ?? 0) ? '#F59E0B' : 'transparent'}
              />
            ))}
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
      </View>
      {review.text ? (
        <Text style={styles.reviewText}>{review.text}</Text>
      ) : null}
    </View>
  )
}

function ReviewsSection({
  reviews,
  avgRating,
}: {
  reviews: ReviewWithUser[]
  avgRating: number
}) {
  return (
    <View>
      {/* Summary */}
      <View style={styles.ratingsSummary}>
        <Text style={styles.ratingsBig}>
          {avgRating > 0 ? avgRating.toFixed(1) : '—'}
        </Text>
        <View style={styles.ratingsRight}>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                color="#F59E0B"
                fill={i < Math.round(avgRating) ? '#F59E0B' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.reviewCountText}>
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>

      {reviews.length === 0 && (
        <Text style={styles.noReviews}>No reviews yet</Text>
      )}

      {reviews.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}
    </View>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonLine({
  width = '100%',
  height = 14,
  style,
}: {
  width?: string | number
  height?: number
  style?: object
}) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Animated.View
      style={[
        styles.skeletonLine,
        { width: width as any, height, opacity },
        style,
      ]}
    />
  )
}

function SkeletonDetail() {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Animated.View style={[styles.skeletonGallery, { opacity }]} />
      <View style={{ padding: 16, gap: 12 }}>
        <SkeletonLine width="70%" height={22} />
        <SkeletonLine width="45%" />
        <SkeletonLine width="35%" height={28} style={{ marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <SkeletonLine width={90} height={28} />
          <SkeletonLine width={110} height={28} />
        </View>
        <View style={styles.divider} />
        <SkeletonLine width="50%" height={16} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={i} width={80} height={56} />
          ))}
        </View>
        <View style={styles.divider} />
        <SkeletonLine width="100%" />
        <SkeletonLine width="90%" />
        <SkeletonLine width="60%" />
      </View>
    </View>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={styles.divider} />
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

// ─── Sticky bottom bar ────────────────────────────────────────────────────────

function StickyBottomBar({
  listing,
  owner,
}: {
  listing: PGListing
  owner: ListingRow['owner']
}) {
  const { shortlistedIds, addToShortlist, removeFromShortlist } = useShortlistStore()
  const { session } = useAuthStore()
  const shortlisted = shortlistedIds.has(listing.id)

  async function handleShortlist() {
    const userId = session?.user.id
    if (!userId) return
    if (shortlisted) {
      removeFromShortlist(listing.id)
      const { error } = await supabase
        .from('shortlists')
        .delete()
        .eq('tenant_id', userId)
        .eq('pg_id', listing.id)
      if (error) addToShortlist(listing.id)
    } else {
      addToShortlist(listing.id)
      const { error } = await supabase
        .from('shortlists')
        .insert({ tenant_id: userId, pg_id: listing.id })
      if (error) removeFromShortlist(listing.id)
    }
  }

  function handleContact() {
    if (!owner) return
    if (owner.phone) {
      // Ensure +91 country code for Indian numbers
      const phone = owner.phone.startsWith('+') ? owner.phone : `+91${owner.phone}`
      Linking.openURL(`whatsapp://send?phone=${phone}`)
        .catch(() => Linking.openURL(`tel:${owner.phone!}`))
    } else if (owner.email) {
      Linking.openURL(`mailto:${owner.email}`)
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
      <View style={styles.bottomBarInner}>
        <Text style={styles.bottomRent}>
          ₹{listing.rent.toLocaleString('en-IN')}
          <Text style={styles.bottomRentMo}> /mo</Text>
        </Text>
        <View style={styles.bottomActions}>
          <Pressable
            onPress={handleShortlist}
            style={[
              styles.shortlistBtn,
              shortlisted && styles.shortlistBtnActive,
            ]}
          >
            <Text
              style={[
                styles.shortlistBtnText,
                shortlisted && styles.shortlistBtnTextActive,
              ]}
            >
              {shortlisted ? '♥ Saved' : '♡ Save'}
            </Text>
          </Pressable>

          <Pressable onPress={handleContact} style={styles.contactBtn}>
            <Text style={styles.contactBtnText}>Contact Owner</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  })

  if (isLoading) return <SkeletonDetail />

  if (error || !data) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load listing</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const { listing, owner, reviews, avgRating } = data

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Gallery */}
        <PhotoGallery
          photos={listing.photos}
          onBack={() => router.back()}
        />

        <View style={styles.content}>
          {/* Title + location */}
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.locationText}>
            📍 {listing.locality}, {listing.city}
          </Text>

          {/* Rent / deposit */}
          <View style={styles.rentBlock}>
            <Text style={styles.rent}>
              ₹{listing.rent.toLocaleString('en-IN')}
              <Text style={styles.rentSuffix}> /month</Text>
            </Text>
            {listing.deposit != null && listing.deposit > 0 && (
              <Text style={styles.deposit}>
                ₹{listing.deposit.toLocaleString('en-IN')} deposit
              </Text>
            )}
          </View>

          {/* Quick info pills */}
          <QuickInfoPills listing={listing} />

          <Divider />

          {/* Amenities */}
          <SectionHeader title="Amenities" />
          <AmenitiesGrid amenities={listing.amenities} />

          {listing.description ? (
            <>
              <Divider />
              <SectionHeader title="About this PG" />
              <DescriptionSection text={listing.description} />
            </>
          ) : null}

          <Divider />

          {/* Location */}
          <SectionHeader title="Location" />
          <LocationSection listing={listing} />

          {owner ? (
            <>
              <Divider />
              <SectionHeader title="Owner" />
              <OwnerCard owner={owner} />
            </>
          ) : null}

          <Divider />

          {/* Reviews */}
          <SectionHeader title={`Reviews (${reviews.length})`} />
          <ReviewsSection reviews={reviews} avgRating={avgRating} />
        </View>
      </ScrollView>

      {/* Sticky bottom */}
      <StickyBottomBar listing={listing} owner={owner} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Gallery
  galleryContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
  },
  galleryPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  galleryPlaceholderText: { color: '#9CA3AF', fontSize: 14 },

  backButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00000055',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCounter: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#00000066',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCounterText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff77',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 16,
  },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 16 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  locationText: { fontSize: 14, color: '#6B7280', marginBottom: 12 },

  rentBlock: { marginBottom: 14 },
  rent: { fontSize: 26, fontWeight: '700', color: '#2563EB' },
  rentSuffix: { fontSize: 16, fontWeight: '400', color: '#6B7280' },
  deposit: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  // Info pills
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  infoPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  infoPillText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 18,
  },

  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },

  // Amenities
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityCell: {
    width: '30%',
    minWidth: 90,
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  amenityCellText: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Description
  hiddenMeasureText: {
    position: 'absolute',
    opacity: 0,
    fontSize: 14,
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  readMoreBtn: { marginTop: 6 },
  readMoreText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },

  // Map
  locationAddress: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  staticMap: {
    width: '100%',
    height: 160,
    backgroundColor: '#E5E7EB',
  },
  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPlaceholderText: { fontSize: 13, color: '#6B7280' },
  mapOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Owner card
  ownerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  ownerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ownerInitial: { fontSize: 18, fontWeight: '700', color: '#2563EB' },
  ownerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  ownerMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ownerActions: { flexDirection: 'row', gap: 10 },
  ownerContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ownerContactBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  messageOwnerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 9,
  },
  messageOwnerBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },

  // Reviews
  ratingsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  ratingsBig: { fontSize: 42, fontWeight: '700', color: '#111827' },
  ratingsRight: { gap: 4 },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewCountText: { fontSize: 13, color: '#6B7280' },

  noReviews: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  reviewItem: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewStarRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  reviewDate: { fontSize: 11, color: '#9CA3AF', marginLeft: 4 },
  reviewText: { fontSize: 14, lineHeight: 20, color: '#374151', paddingLeft: 46 },

  // Skeleton
  skeletonGallery: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
  },
  skeletonLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bottomRent: { fontSize: 20, fontWeight: '700', color: '#111827' },
  bottomRentMo: { fontSize: 13, fontWeight: '400', color: '#6B7280' },
  bottomActions: { flexDirection: 'row', gap: 10, flex: 1, justifyContent: 'flex-end' },

  shortlistBtn: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  shortlistBtnActive: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  shortlistBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  shortlistBtnTextActive: { color: '#EF4444' },

  contactBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#fff',
  },
  errorText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
