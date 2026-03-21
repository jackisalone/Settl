import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import {
  Camera,
  ChevronRight,
  FileText,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageCircle,
  Pen,
  Shield,
  Star,
} from 'lucide-react-native'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useShortlistStore } from '@/store/shortlistStore'
import { mapUser } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  shortlisted: number
  citiesExplored: number
  reviewsGiven: number
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchStats(userId: string): Promise<Stats> {
  const [shortlistRes, reviewsRes] = await Promise.all([
    supabase
      .from('shortlists')
      .select('pg_id, pg_listings(city)')
      .eq('tenant_id', userId),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', userId),
  ])

  const rows = (shortlistRes.data ?? []) as Array<{
    pg_id: string | null
    pg_listings: { city: string } | null
  }>

  const shortlisted = rows.length
  const citiesExplored = new Set(
    rows.map((r) => r.pg_listings?.city).filter(Boolean),
  ).size
  const reviewsGiven = reviewsRes.count ?? 0

  return { shortlisted, citiesExplored, reviewsGiven }
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  visible: boolean
  initialName: string
  initialCity: string
  onClose: () => void
  onSave: (name: string, city: string) => Promise<void>
}

function EditProfileModal({
  visible,
  initialName,
  initialCity,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName)
  const [city, setCity] = useState(initialCity)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), city.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={!name.trim() || saving}
            style={styles.modalSaveBtn}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text
                style={[
                  styles.modalSaveText,
                  !name.trim() && { color: '#9CA3AF' },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalFieldLabel}>Full Name</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            autoFocus
            autoCapitalize="words"
            maxLength={40}
          />

          <Text style={styles.modalFieldLabel}>City</Text>
          <TextInput
            style={styles.modalInput}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Mumbai"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            maxLength={40}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Reviews list modal ───────────────────────────────────────────────────────

interface ReviewRow {
  id: string
  rating: number | null
  text: string | null
  created_at: string | null
  pg_listings: { title: string; city: string } | null
}

interface MyReviewsModalProps {
  visible: boolean
  userId: string
  onClose: () => void
}

function MyReviewsModal({ visible, userId, onClose }: MyReviewsModalProps) {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!visible || !userId) return
      setLoading(true)
      supabase
        .from('reviews')
        .select('id, rating, text, created_at, pg_listings(title, city)')
        .eq('tenant_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setReviews((data ?? []) as unknown as ReviewRow[])
          setLoading(false)
        })
    }, [visible, userId]),
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={{ width: 60 }} />
          <Text style={styles.modalTitle}>My Reviews</Text>
          <Pressable onPress={onClose} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelText}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : reviews.length === 0 ? (
          <View style={styles.reviewsEmpty}>
            <Star size={36} color="#E5E7EB" />
            <Text style={styles.reviewsEmptyText}>No reviews written yet</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle} numberOfLines={1}>
                  {r.pg_listings?.title ?? 'Unknown PG'}
                </Text>
                <Text style={styles.reviewCardCity}>
                  📍 {r.pg_listings?.city ?? ''}
                </Text>
                <View style={styles.reviewCardStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Text key={i} style={{ color: i < (r.rating ?? 0) ? '#F59E0B' : '#E5E7EB', fontSize: 14 }}>
                      ★
                    </Text>
                  ))}
                  <Text style={styles.reviewCardDate}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : ''}
                  </Text>
                </View>
                {r.text ? (
                  <Text style={styles.reviewCardText}>{r.text}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={[styles.menuItemLabel, destructive && styles.menuItemDestructive]}>
          {label}
        </Text>
      </View>
      <ChevronRight size={18} color={destructive ? '#EF4444' : '#9CA3AF'} />
    </Pressable>
  )
}

// ─── Profile screen ───────────────────────────────────────────────────────────

export default function TenantProfileScreen() {
  const { profile, setProfile, clearAuth, session } = useAuthStore()
  const shortlistedCount = useShortlistStore((s) => s.shortlistedIds.size)

  const userId = session?.user.id

  const [stats, setStats] = useState<Stats>({
    shortlisted: shortlistedCount,
    citiesExplored: 0,
    reviewsGiven: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false)

  // ── Refresh on screen focus ────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      setStatsLoading(true)
      fetchStats(userId)
        .then((s) =>
          setStats({
            ...s,
            shortlisted: shortlistedCount > 0 ? shortlistedCount : s.shortlisted,
          }),
        )
        .finally(() => setStatsLoading(false))
    }, [userId, shortlistedCount]),
  )

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarPress() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    const ext = asset.uri.split('.').pop() ?? 'jpg'
    const path = `avatars/${userId}.${ext}`

    setUploadingPhoto(true)
    try {
      // Fetch the image as a blob
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('pg-photos')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('pg-photos')
        .getPublicUrl(path)

      const avatarUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId!)

      if (updateError) throw updateError

      // Update Zustand store
      if (profile) setProfile({ ...profile, avatarUrl })
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // ── Save profile edits ─────────────────────────────────────────────────────
  async function handleSaveProfile(name: string, city: string) {
    const { error } = await supabase
      .from('users')
      .update({ name, city })
      .eq('id', userId!)

    if (error) throw error
    if (profile) setProfile({ ...profile, name, city })
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          clearAuth()
        },
      },
    ])
  }

  const initial = profile?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Top section ── */}
        <View style={styles.topSection}>
          {/* Avatar */}
          <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
            {/* Camera overlay */}
            <View style={styles.cameraOverlay}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </View>
          </Pressable>

          {/* Name */}
          <Text style={styles.profileName}>{profile?.name ?? 'Your Name'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? session?.user.email ?? ''}</Text>

          {/* Edit Profile button */}
          <Pressable
            onPress={() => setEditModalVisible(true)}
            style={styles.editProfileBtn}
          >
            <Pen size={13} color="#2563EB" />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          {statsLoading ? (
            <ActivityIndicator color="#2563EB" style={{ flex: 1, paddingVertical: 20 }} />
          ) : (
            <>
              <StatCard
                icon={<Heart size={20} color="#EF4444" />}
                value={stats.shortlisted}
                label="Shortlisted"
              />
              <View style={styles.statDivider} />
              <StatCard
                icon={<MapPin size={20} color="#2563EB" />}
                value={stats.citiesExplored}
                label="Cities"
              />
              <View style={styles.statDivider} />
              <StatCard
                icon={<Star size={20} color="#F59E0B" />}
                value={stats.reviewsGiven}
                label="Reviews"
              />
            </>
          )}
        </View>

        {/* ── Menu ── */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionLabel}>Account</Text>

          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Pen size={18} color="#6B7280" />}
              label="Edit Profile"
              onPress={() => setEditModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon={<MessageCircle size={18} color="#6B7280" />}
              label="My Reviews"
              onPress={() => setReviewsModalVisible(true)}
            />
          </View>

          <Text style={styles.menuSectionLabel}>Support</Text>

          <View style={styles.menuGroup}>
            <MenuItem
              icon={<LifeBuoy size={18} color="#6B7280" />}
              label="Help & Support"
              onPress={() => Linking.openURL('mailto:support@settl.in')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon={<Shield size={18} color="#6B7280" />}
              label="Privacy Policy"
              onPress={() => Linking.openURL('https://settl.in/privacy')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon={<FileText size={18} color="#6B7280" />}
              label="Terms of Service"
              onPress={() => Linking.openURL('https://settl.in/terms')}
            />
          </View>

          <View style={styles.menuGroup}>
            <MenuItem
              icon={<LogOut size={18} color="#EF4444" />}
              label="Log Out"
              onPress={handleSignOut}
              destructive
            />
          </View>
        </View>

        {/* App version */}
        <Text style={styles.versionText}>Settl v1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <EditProfileModal
        visible={editModalVisible}
        initialName={profile?.name ?? ''}
        initialCity={profile?.city ?? ''}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveProfile}
      />

      {userId && (
        <MyReviewsModal
          visible={reviewsModalVisible}
          userId={userId}
          onClose={() => setReviewsModalVisible(false)}
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

  // Top section
  topSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarWrapper: {
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 14,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Menu
  menuSection: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  menuSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  menuItemDestructive: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 46,
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 24,
    marginBottom: 32,
  },

  // Edit modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalCancelBtn: { width: 60 },
  modalCancelText: {
    fontSize: 15,
    color: '#6B7280',
  },
  modalSaveBtn: { width: 60, alignItems: 'flex-end' },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalContent: {
    padding: 20,
    gap: 8,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },

  // Reviews modal
  reviewsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  reviewsEmptyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  reviewCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  reviewCardCity: {
    fontSize: 12,
    color: '#6B7280',
  },
  reviewCardStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  reviewCardDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  reviewCardText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 4,
  },
})
