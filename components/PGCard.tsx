import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import type { PGListing } from '@/types/index'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PGCardProps {
  listing: PGListing
  onPress: () => void
  onShortlist: () => void
  isShortlisted: boolean
  /** Average rating (0–5), passed in by the parent from reviews data */
  rating?: number
  reviewCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_TYPE_LABEL: Record<string, string> = {
  single: 'Single Room',
  double: 'Double Room',
  triple: 'Triple Room',
}

function formatRent(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}/mo`
}

function formatDeposit(amount: number) {
  return `Deposit ₹${amount.toLocaleString('en-IN')}`
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  return (
    <Text style={styles.starText}>
      {Array.from({ length: 5 }, (_, i) => (i < filled ? '★' : '☆')).join('')}
    </Text>
  )
}

// ─── Heart button ─────────────────────────────────────────────────────────────

interface HeartButtonProps {
  isShortlisted: boolean
  onPress: () => void
}

function HeartButton({ isShortlisted, onPress }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current

  function handlePress() {
    // Pop animation
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()
    onPress()
  }

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={styles.heartButton}>
      <Animated.Text
        style={[
          styles.heartIcon,
          { transform: [{ scale }], color: isShortlisted ? '#EF4444' : '#fff' },
        ]}
      >
        {isShortlisted ? '♥' : '♡'}
      </Animated.Text>
    </Pressable>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PhotoSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  return <Animated.View style={[styles.skeleton, { opacity }]} />
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function PGCard({
  listing,
  onPress,
  onShortlist,
  isShortlisted,
  rating = 0,
  reviewCount = 0,
}: PGCardProps) {
  // Optimistic shortlist state
  const [optimisticShortlisted, setOptimisticShortlisted] = useState(isShortlisted)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Sync if parent prop changes (e.g. after API confirms/reverts)
  useEffect(() => {
    setOptimisticShortlisted(isShortlisted)
  }, [isShortlisted])

  function handleShortlist() {
    const next = !optimisticShortlisted
    setOptimisticShortlisted(next) // optimistic
    onShortlist()                  // parent handles API + rollback
  }

  const photoUrl = listing.photos?.[0] ?? null
  const visibleAmenities = listing.amenities.slice(0, 3)
  const extraAmenities = listing.amenities.length - visibleAmenities.length

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* ── Photo ── */}
      <View style={styles.photoContainer}>
        {!imageLoaded && <PhotoSkeleton />}

        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={200}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.photoPlaceholderText}>No photo</Text>
          </View>
        )}

        {/* Room type badge */}
        {listing.roomType && (
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>
              {ROOM_TYPE_LABEL[listing.roomType] ?? listing.roomType}
            </Text>
          </View>
        )}

        {/* Heart button */}
        <HeartButton
          isShortlisted={optimisticShortlisted}
          onPress={handleShortlist}
        />
      </View>

      {/* ── Info ── */}
      <View style={styles.info}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>

        {/* Locality */}
        <View style={styles.locationRow}>
          <Text style={styles.locationPin}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {listing.locality}, {listing.city}
          </Text>
        </View>

        {/* Rent */}
        <View style={styles.rentRow}>
          <Text style={styles.rent}>{formatRent(listing.rent)}</Text>
          {listing.deposit != null && listing.deposit > 0 && (
            <Text style={styles.deposit}>{formatDeposit(listing.deposit)}</Text>
          )}
        </View>

        {/* Amenity pills */}
        {visibleAmenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {visibleAmenities.map((a) => (
              <View key={a} style={styles.amenityPill}>
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
            {extraAmenities > 0 && (
              <View style={styles.amenityPill}>
                <Text style={styles.amenityText}>+{extraAmenities} more</Text>
              </View>
            )}
          </View>
        )}

        {/* Rating row */}
        <View style={styles.ratingRow}>
          {rating > 0 ? (
            <>
              <StarRating rating={rating} />
              <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>
                ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
              </Text>
            </>
          ) : (
            <Text style={styles.reviewCount}>No reviews yet</Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    // Shadow (Android)
    elevation: 2,
    marginBottom: 16,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },

  // Photo
  photoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F3F4F6',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  photoPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
  },

  // Badges
  roomBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#ffffffee',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },

  // Heart
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000044',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 20,
    lineHeight: 22,
    textShadowColor: '#00000033',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Info section
  info: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationPin: {
    fontSize: 11,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },

  // Rent
  rentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 2,
  },
  rent: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },
  deposit: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Amenities
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  amenityPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  amenityText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
  },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  starText: {
    fontSize: 13,
    color: '#F59E0B',
    letterSpacing: 1,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  reviewCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
})
