import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useReducer, useState } from 'react'
import {
  ArrowLeft,
  Bath,
  BookOpen,
  Car,
  CheckCircle2,
  ChevronDown,
  Droplets,
  Dumbbell,
  Flame,
  ImagePlus,
  Shield,
  Shirt,
  UtensilsCrossed,
  Wifi,
  Wind,
  X,
  Zap,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mapPGListing } from '@/types/index'

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIES = ['Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Pune', 'Hyderabad', 'Other']

const ROOM_TYPES = [
  { value: 'single' as const, label: 'Single', sub: '1 person' },
  { value: 'double' as const, label: 'Double', sub: '2 people' },
  { value: 'triple' as const, label: 'Triple', sub: '3 people' },
]

const AMENITIES: { key: string; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'WiFi', label: 'WiFi', Icon: Wifi },
  { key: 'Food Included', label: 'Food\nIncluded', Icon: UtensilsCrossed },
  { key: 'AC', label: 'AC', Icon: Wind },
  { key: 'Attached Bathroom', label: 'Attached\nBath', Icon: Bath },
  { key: 'Laundry', label: 'Laundry', Icon: Shirt },
  { key: 'Parking', label: 'Parking', Icon: Car },
  { key: 'Security Guard', label: 'Security\nGuard', Icon: Shield },
  { key: 'Gym', label: 'Gym', Icon: Dumbbell },
  { key: '24/7 Water', label: '24/7\nWater', Icon: Droplets },
  { key: 'Electricity Included', label: 'Electricity\nIncl.', Icon: Zap },
  { key: 'Gas Connection', label: 'Gas\nConn.', Icon: Flame },
  { key: 'Study Room', label: 'Study\nRoom', Icon: BookOpen },
]

const OCCUPANT_OPTIONS = [1, 2, 3, 4]

const TOTAL_STEPS = 4

// ─── State & Reducer ──────────────────────────────────────────────────────────

type RoomType = 'single' | 'double' | 'triple'

interface FormState {
  // Step 1
  title: string
  description: string
  city: string
  locality: string
  address: string
  // Step 2
  roomType: RoomType | null
  rent: string
  deposit: string
  availableFrom: Date | null
  maxOccupants: number
  // Step 3
  amenities: string[]
  // Step 4
  existingPhotoUrls: string[]
  newPhotoUris: string[]
  // Meta
  step: number
}

type FormAction =
  | { type: 'PATCH'; payload: Partial<FormState> }
  | { type: 'SET_STEP'; step: number }
  | { type: 'TOGGLE_AMENITY'; amenity: string }
  | { type: 'ADD_PHOTOS'; uris: string[] }
  | { type: 'REMOVE_EXISTING'; url: string }
  | { type: 'REMOVE_NEW'; uri: string }
  | { type: 'SEED'; payload: Partial<FormState> }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'PATCH':
      return { ...state, ...action.payload }
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'TOGGLE_AMENITY': {
      const has = state.amenities.includes(action.amenity)
      return {
        ...state,
        amenities: has
          ? state.amenities.filter((a) => a !== action.amenity)
          : [...state.amenities, action.amenity],
      }
    }
    case 'ADD_PHOTOS': {
      const remaining = 8 - state.existingPhotoUrls.length
      const combined = [...state.newPhotoUris, ...action.uris].slice(0, remaining)
      return { ...state, newPhotoUris: combined }
    }
    case 'REMOVE_EXISTING':
      return { ...state, existingPhotoUrls: state.existingPhotoUrls.filter((u) => u !== action.url) }
    case 'REMOVE_NEW':
      return { ...state, newPhotoUris: state.newPhotoUris.filter((u) => u !== action.uri) }
    case 'SEED':
      return { ...state, ...action.payload }
    default:
      return state
  }
}

const INITIAL_STATE: FormState = {
  title: '',
  description: '',
  city: '',
  locality: '',
  address: '',
  roomType: null,
  rent: '',
  deposit: '',
  availableFrom: null,
  maxOccupants: 1,
  amenities: [],
  existingPhotoUrls: [],
  newPhotoUris: [],
  step: 1,
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(state: FormState, step: number): string | null {
  if (step === 1) {
    if (!state.title.trim()) return 'Listing title is required'
    if (!state.city) return 'Please select a city'
    if (!state.locality.trim()) return 'Locality / area is required'
  }
  if (step === 2) {
    if (!state.roomType) return 'Please select a room type'
    if (!state.rent.trim() || isNaN(Number(state.rent)) || Number(state.rent) <= 0)
      return 'Enter a valid monthly rent'
  }
  return null
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadPhoto(
  ownerId: string,
  listingId: string,
  uri: string,
  index: number,
): Promise<string> {
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpg', 'jpeg')
  const path = `${ownerId}/${Date.now()}_${index}.${ext}`

  const res = await fetch(uri)
  const blob = await res.blob()

  const { error } = await supabase.storage.from('pg-photos').upload(path, blob, {
    contentType: `image/${ext}`,
    upsert: true,
  })
  if (error) throw error

  return supabase.storage.from('pg-photos').getPublicUrl(path).data.publicUrl
}

// ─── Progress header ──────────────────────────────────────────────────────────

function ProgressHeader({
  step,
  onBack,
}: {
  step: number
  onBack: () => void
}) {
  return (
    <View style={styles.progressHeader}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <ArrowLeft size={22} color="#111827" />
      </Pressable>

      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === step && styles.dotActive,
              i + 1 < step && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
    </View>
  )
}

// ─── City picker modal ────────────────────────────────────────────────────────

function CityPicker({
  value,
  onSelect,
}: {
  value: string
  onSelect: (city: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        style={[styles.input, styles.pickerBtn]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.pickerBtnText, !value && styles.placeholderText]}>
          {value || 'Select city'}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Select City</Text>
            {CITIES.map((city) => (
              <Pressable
                key={city}
                style={[styles.pickerOption, value === city && styles.pickerOptionActive]}
                onPress={() => {
                  onSelect(city)
                  setOpen(false)
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    value === city && styles.pickerOptionTextActive,
                  ]}
                >
                  {city}
                </Text>
                {value === city && <CheckCircle2 size={18} color="#2563EB" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

// ─── Date picker ──────────────────────────────────────────────────────────────

function DateField({
  value,
  onChange,
}: {
  value: Date | null
  onChange: (date: Date) => void
}) {
  const [show, setShow] = useState(false)
  const displayDate = value
    ? value.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Select date'

  if (Platform.OS === 'android') {
    return (
      <>
        <Pressable style={[styles.input, styles.pickerBtn]} onPress={() => setShow(true)}>
          <Text style={[styles.pickerBtnText, !value && styles.placeholderText]}>
            {displayDate}
          </Text>
          <ChevronDown size={18} color="#9CA3AF" />
        </Pressable>
        {show && (
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShow(false)
              if (date) onChange(date)
            }}
          />
        )}
      </>
    )
  }

  // iOS — spinner inside modal
  return (
    <>
      <Pressable style={[styles.input, styles.pickerBtn]} onPress={() => setShow(true)}>
        <Text style={[styles.pickerBtnText, !value && styles.placeholderText]}>
          {displayDate}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </Pressable>

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.iosDateOverlay}>
          <View style={styles.iosDateModal}>
            <View style={styles.iosDateHeader}>
              <Text style={styles.iosDateTitle}>Available From</Text>
              <Pressable onPress={() => setShow(false)}>
                <Text style={styles.iosDateDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={value ?? new Date()}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_, date) => {
                if (date) onChange(date)
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Step 1 — Basic Info ──────────────────────────────────────────────────────

function Step1({ state, dispatch }: { state: FormState; dispatch: React.Dispatch<FormAction> }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Basic Information</Text>
        <Text style={styles.stepSubtitle}>Tell tenants about your PG</Text>

        <Label text="Listing Title *" />
        <TextInput
          style={styles.input}
          value={state.title}
          onChangeText={(t) => dispatch({ type: 'PATCH', payload: { title: t } })}
          placeholder="e.g. Comfortable Single Room in Koramangala"
          placeholderTextColor="#9CA3AF"
          maxLength={100}
          returnKeyType="next"
        />

        <Label text="Description" />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={state.description}
          onChangeText={(t) => dispatch({ type: 'PATCH', payload: { description: t } })}
          placeholder="Describe your PG — facilities, house rules, nearby places..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Label text="City *" />
        <CityPicker
          value={state.city}
          onSelect={(city) => dispatch({ type: 'PATCH', payload: { city } })}
        />

        <Label text="Locality / Area *" />
        <TextInput
          style={styles.input}
          value={state.locality}
          onChangeText={(t) => dispatch({ type: 'PATCH', payload: { locality: t } })}
          placeholder="e.g. Andheri West, Koramangala"
          placeholderTextColor="#9CA3AF"
          returnKeyType="next"
        />

        <Label text="Full Address" />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={state.address}
          onChangeText={(t) => dispatch({ type: 'PATCH', payload: { address: t } })}
          placeholder="Street address (optional)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Step 2 — Room & Price ────────────────────────────────────────────────────

function Step2({ state, dispatch }: { state: FormState; dispatch: React.Dispatch<FormAction> }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Room & Pricing</Text>
        <Text style={styles.stepSubtitle}>Set the room details and rent</Text>

        {/* Room type */}
        <Label text="Room Type *" />
        <View style={styles.roomTypeRow}>
          {ROOM_TYPES.map(({ value, label, sub }) => (
            <Pressable
              key={value}
              onPress={() => dispatch({ type: 'PATCH', payload: { roomType: value } })}
              style={[styles.roomCard, state.roomType === value && styles.roomCardActive]}
            >
              <Text style={[styles.roomLabel, state.roomType === value && styles.roomLabelActive]}>
                {label}
              </Text>
              <Text style={[styles.roomSub, state.roomType === value && styles.roomSubActive]}>
                {sub}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Pricing row */}
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Label text="Monthly Rent *" />
            <View style={styles.rupeeInput}>
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.rupeeTextInput}
                value={state.rent}
                onChangeText={(t) => dispatch({ type: 'PATCH', payload: { rent: t } })}
                placeholder="8000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Label text="Security Deposit" />
            <View style={styles.rupeeInput}>
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.rupeeTextInput}
                value={state.deposit}
                onChangeText={(t) => dispatch({ type: 'PATCH', payload: { deposit: t } })}
                placeholder="16000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Available from */}
        <Label text="Available From" />
        <DateField
          value={state.availableFrom}
          onChange={(date) => dispatch({ type: 'PATCH', payload: { availableFrom: date } })}
        />

        {/* Max occupants */}
        <Label text="Max Occupants" />
        <View style={styles.occupantRow}>
          {OCCUPANT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              onPress={() => dispatch({ type: 'PATCH', payload: { maxOccupants: n } })}
              style={[
                styles.occupantBtn,
                state.maxOccupants === n && styles.occupantBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.occupantBtnText,
                  state.maxOccupants === n && styles.occupantBtnTextActive,
                ]}
              >
                {n === 4 ? '4+' : n}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Step 3 — Amenities ───────────────────────────────────────────────────────

function Step3({ state, dispatch }: { state: FormState; dispatch: React.Dispatch<FormAction> }) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Amenities</Text>
      <Text style={styles.stepSubtitle}>Select all that your PG offers</Text>

      <View style={styles.amenitiesGrid}>
        {AMENITIES.map(({ key, label, Icon }) => {
          const selected = state.amenities.includes(key)
          return (
            <Pressable
              key={key}
              onPress={() => dispatch({ type: 'TOGGLE_AMENITY', amenity: key })}
              style={[styles.amenityCard, selected && styles.amenityCardActive]}
            >
              <Icon size={22} color={selected ? '#2563EB' : '#6B7280'} />
              <Text
                style={[styles.amenityLabel, selected && styles.amenityLabelActive]}
                numberOfLines={2}
                textBreakStrategy="simple"
              >
                {label}
              </Text>
              {selected && (
                <View style={styles.amenityCheck}>
                  <CheckCircle2 size={14} color="#2563EB" />
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

// ─── Step 4 — Photos ──────────────────────────────────────────────────────────

function Step4({
  state,
  dispatch,
  uploadProgress,
}: {
  state: FormState
  dispatch: React.Dispatch<FormAction>
  uploadProgress: { uploading: boolean; uploaded: number; total: number }
}) {
  const totalPhotos = state.existingPhotoUrls.length + state.newPhotoUris.length
  const allPhotos: { uri: string; isExisting: boolean }[] = [
    ...state.existingPhotoUrls.map((u) => ({ uri: u, isExisting: true })),
    ...state.newPhotoUris.map((u) => ({ uri: u, isExisting: false })),
  ]

  async function handleAddPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8 - totalPhotos,
    })
    if (!result.canceled) {
      dispatch({ type: 'ADD_PHOTOS', uris: result.assets.map((a) => a.uri) })
    }
  }

  const progressFraction =
    uploadProgress.total > 0 ? uploadProgress.uploaded / uploadProgress.total : 0

  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Photos</Text>
      <Text style={styles.stepSubtitle}>
        Add up to 8 photos — first photo is the cover
      </Text>

      {/* Upload progress */}
      {uploadProgress.uploading && (
        <View style={styles.uploadProgressContainer}>
          <Text style={styles.uploadProgressText}>
            Uploading {uploadProgress.uploaded} / {uploadProgress.total} photos...
          </Text>
          <View style={styles.uploadProgressTrack}>
            <View style={[styles.uploadProgressBar, { width: `${progressFraction * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Photo grid */}
      <View style={styles.photoGrid}>
        {allPhotos.map(({ uri, isExisting }, index) => (
          <View key={uri} style={styles.photoCell}>
            <Image source={{ uri }} style={styles.photoCellImage} contentFit="cover" />

            {/* Cover badge on first photo */}
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}

            {/* Remove button */}
            <Pressable
              onPress={() =>
                isExisting
                  ? dispatch({ type: 'REMOVE_EXISTING', url: uri })
                  : dispatch({ type: 'REMOVE_NEW', uri })
              }
              style={styles.photoRemoveBtn}
            >
              <X size={12} color="#fff" />
            </Pressable>
          </View>
        ))}

        {/* Add photo button */}
        {totalPhotos < 8 && (
          <Pressable onPress={handleAddPhotos} style={styles.photoAddBtn}>
            <ImagePlus size={26} color="#6B7280" />
            <Text style={styles.photoAddText}>Add Photo</Text>
          </Pressable>
        )}
      </View>

      {totalPhotos === 0 && (
        <Text style={styles.photoHint}>
          Photos help tenants make faster decisions — add at least one.
        </Text>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ListingFormScreen() {
  const { listingId } = useLocalSearchParams<{ listingId?: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session } = useAuthStore()
  const ownerId = session?.user.id ?? ''
  const isEdit = !!listingId

  const [state, dispatch] = useReducer(formReducer, INITIAL_STATE)
  const [uploadProgress, setUploadProgress] = useState({
    uploading: false,
    uploaded: 0,
    total: 0,
  })
  const [seeded, setSeeded] = useState(false)

  // Load existing listing if editing
  useQuery({
    queryKey: ['listing-form-seed', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pg_listings')
        .select('*')
        .eq('id', listingId!)
        .single()
      if (error) throw error
      return mapPGListing(data)
    },
    enabled: isEdit && !seeded,
    staleTime: 0,
    select: (listing) => {
      if (!seeded) {
        dispatch({
          type: 'SEED',
          payload: {
            title: listing.title,
            description: listing.description ?? '',
            city: listing.city,
            locality: listing.locality,
            address: listing.address ?? '',
            roomType: listing.roomType,
            rent: String(listing.rent),
            deposit: listing.deposit ? String(listing.deposit) : '',
            availableFrom: listing.availableFrom ? new Date(listing.availableFrom) : null,
            amenities: listing.amenities ?? [],
            existingPhotoUrls: listing.photos ?? [],
            newPhotoUris: [],
          },
        })
        setSeeded(true)
      }
      return listing
    },
  })

  function handleBack() {
    if (state.step === 1) {
      router.back()
    } else {
      dispatch({ type: 'SET_STEP', step: state.step - 1 })
    }
  }

  function handleNext() {
    const err = validateStep(state, state.step)
    if (err) {
      Alert.alert('Missing Information', err)
      return
    }
    dispatch({ type: 'SET_STEP', step: state.step + 1 })
  }

  async function handleSubmit() {
    const err = validateStep(state, state.step)
    if (err) {
      Alert.alert('Missing Information', err)
      return
    }

    setUploadProgress({ uploading: true, uploaded: 0, total: state.newPhotoUris.length })

    try {
      // Upload new photos
      const newUrls: string[] = []
      for (let i = 0; i < state.newPhotoUris.length; i++) {
        const url = await uploadPhoto(ownerId, listingId ?? 'new', state.newPhotoUris[i], i)
        newUrls.push(url)
        setUploadProgress((p) => ({ ...p, uploaded: i + 1 }))
      }

      const allPhotos = [...state.existingPhotoUrls, ...newUrls]

      const payload = {
        owner_id: ownerId,
        title: state.title.trim(),
        description: state.description.trim() || null,
        city: state.city,
        locality: state.locality.trim(),
        address: state.address.trim() || null,
        room_type: state.roomType,
        rent: Number(state.rent),
        deposit: state.deposit ? Number(state.deposit) : null,
        available_from: state.availableFrom?.toISOString().split('T')[0] ?? null,
        amenities: state.amenities,
        photos: allPhotos,
        is_active: true,
      }

      if (isEdit) {
        const { error } = await supabase
          .from('pg_listings')
          .update(payload)
          .eq('id', listingId!)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pg_listings').insert(payload)
        if (error) throw error
      }

      queryClient.invalidateQueries({ queryKey: ['owner-listings', ownerId] })
      queryClient.invalidateQueries({ queryKey: ['owner-stats', ownerId] })

      Alert.alert(
        isEdit ? 'Listing Updated' : '🎉 Listing Published!',
        isEdit
          ? 'Your changes have been saved.'
          : 'Your PG is now live and discoverable by tenants.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save listing. Please try again.')
    } finally {
      setUploadProgress({ uploading: false, uploaded: 0, total: 0 })
    }
  }

  const isLastStep = state.step === TOTAL_STEPS

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProgressHeader step={state.step} onBack={handleBack} />

      {/* Loading overlay while seeding edit data */}
      {isEdit && !seeded ? (
        <View style={styles.seedLoading}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={styles.seedLoadingText}>Loading listing...</Text>
        </View>
      ) : (
        <>
          {/* Step content */}
          <View style={{ flex: 1 }}>
            {state.step === 1 && <Step1 state={state} dispatch={dispatch} />}
            {state.step === 2 && <Step2 state={state} dispatch={dispatch} />}
            {state.step === 3 && <Step3 state={state} dispatch={dispatch} />}
            {state.step === 4 && (
              <Step4
                state={state}
                dispatch={dispatch}
                uploadProgress={uploadProgress}
              />
            )}
          </View>

          {/* Bottom CTA */}
          <View style={styles.bottomBar}>
            <Pressable
              onPress={isLastStep ? handleSubmit : handleNext}
              style={[styles.nextBtn, uploadProgress.uploading && styles.nextBtnDisabled]}
              disabled={uploadProgress.uploading}
            >
              {uploadProgress.uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>
                  {isLastStep ? (isEdit ? 'Save Changes' : 'Publish Listing') : 'Next →'}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Progress header
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  dotDone: {
    backgroundColor: '#93C5FD',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 64,
    textAlign: 'right',
  },

  // Step content
  stepContent: {
    padding: 20,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 24,
  },

  // Labels & inputs
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 7,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 12,
  },

  // City / date picker button
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerBtnText: {
    fontSize: 15,
    color: '#111827',
  },
  placeholderText: {
    color: '#9CA3AF',
  },

  // City picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 360,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },

  // iOS date modal
  iosDateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosDateModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  iosDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iosDateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  iosDateDone: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Room type
  roomTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  roomCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    gap: 5,
  },
  roomCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roomLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  roomLabelActive: {
    color: '#2563EB',
  },
  roomSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  roomSubActive: {
    color: '#93C5FD',
  },

  // Pricing
  priceRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  rupeeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 14,
    overflow: 'hidden',
  },
  rupeePrefix: {
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  rupeeTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // Max occupants
  occupantRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  occupantBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  occupantBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  occupantBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  occupantBtnTextActive: {
    color: '#2563EB',
  },

  // Amenities
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityCard: {
    width: '30.5%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    gap: 7,
    minHeight: 88,
    position: 'relative',
  },
  amenityCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  amenityLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 15,
  },
  amenityLabelActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  amenityCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCell: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photoCellImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddBtn: {
    width: '30.5%',
    aspectRatio: 1,
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
  },
  photoHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },

  // Upload progress
  uploadProgressContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  uploadProgressTrack: {
    height: 6,
    backgroundColor: '#BFDBFE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  nextBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Seed loading
  seedLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  seedLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
})
