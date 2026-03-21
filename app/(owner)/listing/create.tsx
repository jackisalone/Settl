import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  ListingForm,
  ListingFormValues,
  emptyFormValues,
} from '@/components/ListingForm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export default function CreateListingScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session } = useAuthStore()
  const ownerId = session?.user.id!

  const [values, setValues] = useState<ListingFormValues>(emptyFormValues())
  const [submitting, setSubmitting] = useState(false)

  function handleChange(patch: Partial<ListingFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }))
  }

  async function handleSubmit() {
    const err = validate(values)
    if (err) {
      Alert.alert('Required Field', err)
      return
    }

    setSubmitting(true)
    try {
      // 1. Insert listing with empty photos array
      const { data: inserted, error: insertError } = await supabase
        .from('pg_listings')
        .insert({
          owner_id: ownerId,
          title: values.title.trim(),
          description: values.description.trim() || null,
          rent: Number(values.rent),
          deposit: values.deposit ? Number(values.deposit) : null,
          city: values.city.trim(),
          locality: values.locality.trim(),
          address: values.address.trim() || null,
          room_type: values.roomType,
          amenities: values.amenities,
          photos: [],
          is_active: true,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      const listingId = inserted.id

      // 2. Upload new photos if any
      if (values.newPhotoUris.length > 0) {
        const photoUrls = await Promise.all(
          values.newPhotoUris.map((uri, i) => uploadPhoto(ownerId, listingId, uri, i)),
        )
        await supabase
          .from('pg_listings')
          .update({ photos: photoUrls })
          .eq('id', listingId)
      }

      // 3. Invalidate and go back
      queryClient.invalidateQueries({ queryKey: ['owner-listings', ownerId] })
      queryClient.invalidateQueries({ queryKey: ['owner-stats', ownerId] })
      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create listing. Please try again.')
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
        <Text style={styles.headerTitle}>Add Listing</Text>
        {/* Spacer to balance the back button */}
        <View style={{ width: 24 }} />
      </View>

      <ListingForm
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel="Publish Listing"
        submitting={submitting}
      />
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
})
