import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Camera, X } from 'lucide-react-native'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROOM_TYPES = [
  { value: 'single' as const, label: 'Single', capacity: '1 person' },
  { value: 'double' as const, label: 'Double', capacity: '2 people' },
  { value: 'triple' as const, label: 'Triple', capacity: '3 people' },
]

export const AMENITY_OPTIONS = [
  'WiFi',
  'AC',
  'Geyser',
  'Laundry',
  'Kitchen',
  'Parking',
  'Power Backup',
  'Security',
  'CCTV',
  'Food',
  'Gym',
  'TV',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListingFormValues {
  title: string
  description: string
  rent: string
  deposit: string
  city: string
  locality: string
  address: string
  roomType: 'single' | 'double' | 'triple' | null
  amenities: string[]
  /** Existing photo URLs already stored in Supabase */
  existingPhotos: string[]
  /** Newly picked local file URIs */
  newPhotoUris: string[]
}

export function emptyFormValues(): ListingFormValues {
  return {
    title: '',
    description: '',
    rent: '',
    deposit: '',
    city: '',
    locality: '',
    address: '',
    roomType: null,
    amenities: [],
    existingPhotos: [],
    newPhotoUris: [],
  }
}

interface ListingFormProps {
  values: ListingFormValues
  onChange: (patch: Partial<ListingFormValues>) => void
  onSubmit: () => void
  submitLabel?: string
  submitting?: boolean
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function ListingForm({
  values,
  onChange,
  onSubmit,
  submitLabel = 'Publish',
  submitting = false,
}: ListingFormProps) {
  const totalPhotos = values.existingPhotos.length + values.newPhotoUris.length

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      const picked = result.assets.map((a) => a.uri)
      const combined = [...values.newPhotoUris, ...picked].slice(0, 10 - values.existingPhotos.length)
      onChange({ newPhotoUris: combined })
    }
  }

  function removeExistingPhoto(url: string) {
    onChange({ existingPhotos: values.existingPhotos.filter((u) => u !== url) })
  }

  function removeNewPhoto(uri: string) {
    onChange({ newPhotoUris: values.newPhotoUris.filter((u) => u !== uri) })
  }

  function toggleAmenity(a: string) {
    const next = values.amenities.includes(a)
      ? values.amenities.filter((x) => x !== a)
      : [...values.amenities, a]
    onChange({ amenities: next })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Photos ── */}
        <SectionHeader title="Photos" subtitle="Add up to 10 photos" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoPicker}
        >
          {/* Existing photos */}
          {values.existingPhotos.map((url) => (
            <View key={url} style={styles.photoItem}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable onPress={() => removeExistingPhoto(url)} style={styles.photoRemoveBtn}>
                <X size={12} color="#fff" />
              </Pressable>
            </View>
          ))}

          {/* New local photos */}
          {values.newPhotoUris.map((uri) => (
            <View key={uri} style={styles.photoItem}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable onPress={() => removeNewPhoto(uri)} style={styles.photoRemoveBtn}>
                <X size={12} color="#fff" />
              </Pressable>
              {/* "New" indicator */}
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            </View>
          ))}

          {totalPhotos < 10 && (
            <Pressable onPress={pickPhotos} style={styles.photoAddBtn}>
              <Camera size={24} color="#6B7280" />
              <Text style={styles.photoAddText}>Add Photos</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* ── Basic info ── */}
        <SectionHeader title="Basic Information" />
        <View style={styles.fieldGroup}>
          <Field label="Listing Title *">
            <TextInput
              style={styles.input}
              value={values.title}
              onChangeText={(t) => onChange({ title: t })}
              placeholder="e.g. Comfortable Single Room in Koramangala"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
            />
          </Field>
          <Field label="Description">
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={values.description}
              onChangeText={(t) => onChange({ description: t })}
              placeholder="Describe your PG — facilities, house rules, nearby places..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Field>
        </View>

        {/* ── Location ── */}
        <SectionHeader title="Location" />
        <View style={styles.fieldGroup}>
          <Field label="City *">
            <TextInput
              style={styles.input}
              value={values.city}
              onChangeText={(t) => onChange({ city: t })}
              placeholder="e.g. Bangalore"
              placeholderTextColor="#9CA3AF"
            />
          </Field>
          <Field label="Locality *">
            <TextInput
              style={styles.input}
              value={values.locality}
              onChangeText={(t) => onChange({ locality: t })}
              placeholder="e.g. Koramangala"
              placeholderTextColor="#9CA3AF"
            />
          </Field>
          <Field label="Full Address">
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={values.address}
              onChangeText={(t) => onChange({ address: t })}
              placeholder="Street address (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </Field>
        </View>

        {/* ── Pricing ── */}
        <SectionHeader title="Pricing" />
        <View style={styles.fieldGroup}>
          <View style={styles.priceRow}>
            <Field label="Monthly Rent (₹) *" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={values.rent}
                onChangeText={(t) => onChange({ rent: t })}
                placeholder="8000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="Security Deposit (₹)" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={values.deposit}
                onChangeText={(t) => onChange({ deposit: t })}
                placeholder="16000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </Field>
          </View>
        </View>

        {/* ── Room type ── */}
        <SectionHeader title="Room Type *" />
        <View style={styles.roomTypeRow}>
          {ROOM_TYPES.map(({ value, label, capacity }) => (
            <Pressable
              key={value}
              onPress={() => onChange({ roomType: value })}
              style={[styles.roomTypeCard, values.roomType === value && styles.roomTypeCardActive]}
            >
              <Text
                style={[
                  styles.roomTypeLabel,
                  values.roomType === value && styles.roomTypeLabelActive,
                ]}
              >
                {label}
              </Text>
              <Text
                style={[
                  styles.roomTypeCapacity,
                  values.roomType === value && styles.roomTypeCapacityActive,
                ]}
              >
                {capacity}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Amenities ── */}
        <SectionHeader title="Amenities" subtitle="Select all that apply" />
        <View style={styles.amenitiesGrid}>
          {AMENITY_OPTIONS.map((a) => (
            <Pressable
              key={a}
              onPress={() => toggleAmenity(a)}
              style={[
                styles.amenityChip,
                values.amenities.includes(a) && styles.amenityChipActive,
              ]}
            >
              <Text
                style={[
                  styles.amenityChipText,
                  values.amenities.includes(a) && styles.amenityChipTextActive,
                ]}
              >
                {a}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Submit button */}
        <Pressable onPress={onSubmit} style={styles.submitBtn} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{submitLabel}</Text>
          )}
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: object
}) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Section headers
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Field
  fieldGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 11,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  // Photos
  photoPicker: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  photoAddBtn: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
  },
  photoAddText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Room type
  roomTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roomTypeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    gap: 4,
  },
  roomTypeCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roomTypeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  roomTypeLabelActive: {
    color: '#2563EB',
  },
  roomTypeCapacity: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  roomTypeCapacityActive: {
    color: '#93C5FD',
  },

  // Amenities
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  amenityChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  amenityChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  amenityChipTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },

  // Submit
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
