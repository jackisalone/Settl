import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mapPGListing } from '@/types/index'
import type { PGListing } from '@/types/index'
import {
  ListingForm,
  ListingFormValues,
} from '@/components/ListingForm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchListing(id: string): Promise<PGListing> {
  const { data, error } = await supabase
    .from('pg_listings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return mapPGListing(data)
}

async function uploadPhoto(
  ownerId: string,
  listingId: string,
  uri: string,
  index: number,
): Promise<string> {
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase()
  const mimeExt = ext === 'jpg' ? 'jpeg' : ext
  const path = `${ownerId}/${listingId}/${index}_${Date.now()}.${mimeExt}`

  const response = await fetch(uri)
  const blob = await response.blob()

  const { error } = await supabase.storage.from('pg-photos').upload(path, blob, {
    contentType: `image/${mimeExt}`,
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from('pg-photos').getPublicUrl(path)
  return data.publicUrl
}

function listingToFormValues(listing: PGListing): ListingFormValues {
  return {
    title: listing.title,
    description: listing.description ?? '',
    rent: String(listing.rent),
    deposit: listing.deposit ? String(listing.deposit) : '',
    city: listing.city,
    locality: listing.locality,
    address: listing.address ?? '',
    roomType: listing.roomType,
    amenities: listing.amenities ?? [],
    existingPhotos: listing.photos ?? [],
    newPhotoUris: [],
  }
}

function validate(values: ListingFormValues): string | null {
  if (!values.title.trim()) return 'Listing title is required'
  if (!values.rent.trim() || isNaN(Number(values.rent)) || Number(values.rent) <= 0)
    return 'Enter a valid monthly rent'
  if (!values.city.trim()) return 'City is required'
  if (!values.locality.trim()) return 'Locality is required'
  if (!values.roomType) return 'Select a room type'
  return null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session } = useAuthStore()
  const ownerId = session?.user.id!

  const [values, setValues] = useState<ListingFormValues | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load the listing
  const { isLoading, error } = useQuery({
    queryKey: ['listing-edit', id],
    queryFn: () => fetchListing(id!),
    enabled: !!id,
    staleTime: 0,
    // Seed form values when data arrives
    select: (listing) => {
      if (!values) {
        setValues(listingToFormValues(listing))
      }
      return listing
    },
  })

  function handleChange(patch: Partial<ListingFormValues>) {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function handleSubmit() {
    if (!values || !id) return

    const err = validate(values)
    if (err) {
      Alert.alert('Required Field', err)
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload new photos if any
      let newPhotoUrls: string[] = []
      if (values.newPhotoUris.length > 0) {
        const offset = values.existingPhotos.length
        newPhotoUrls = await Promise.all(
          values.newPhotoUris.map((uri, i) => uploadPhoto(ownerId, id, uri, offset + i)),
        )
      }

      const finalPhotos = [...values.existingPhotos, ...newPhotoUrls]

      // 2. Update listing
      const { error: updateError } = await supabase
        .from('pg_listings')
        .update({
          title: values.title.trim(),
          description: values.description.trim() || null,
          rent: Number(values.rent),
          deposit: values.deposit ? Number(values.deposit) : null,
          city: values.city.trim(),
          locality: values.locality.trim(),
          address: values.address.trim() || null,
          room_type: values.roomType,
          amenities: values.amenities,
          photos: finalPhotos,
        })
        .eq('id', id)

      if (updateError) throw updateError

      // 3. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['owner-listings', ownerId] })
      queryClient.invalidateQueries({ queryKey: ['listing-edit', id] })
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['owner-stats', ownerId] })

      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update listing. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading || !values ? (
        <ActivityIndicator color="#2563EB" size="large" style={{ marginTop: 80 }} />
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Failed to load listing</Text>
          <Pressable onPress={() => router.back()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      ) : (
        <ListingForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          submitting={submitting}
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
