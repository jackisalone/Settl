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
  Building2,
  Camera,
  ChevronRight,
  Crown,
  FileText,
  Heart,
  LifeBuoy,
  LogOut,
  Pen,
  Phone,
  Shield,
} from 'lucide-react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OwnerStats {
  activeListings: number
  totalListings: number
  totalShortlists: number
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchOwnerStats(ownerId: string): Promise<OwnerStats> {
  const listingsRes = await supabase
    .from('pg_listings')
    .select('id, is_active')
    .eq('owner_id', ownerId)

  const listings = listingsRes.data ?? []
  if (listings.length === 0) {
    return { activeListings: 0, totalListings: 0, totalShortlists: 0 }
  }

  const listingIds = listings.map((l) => l.id)
  const shortlistsRes = await supabase
    .from('shortlists')
    .select('id', { count: 'exact', head: true })
    .in('pg_id', listingIds)

  return {
    activeListings: listings.filter((l) => l.is_active).length,
    totalListings: listings.length,
    totalShortlists: shortlistsRes.count ?? 0,
  }
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  visible: boolean
  initialName: string
  initialPhone: string
  onClose: () => void
  onSave: (name: string, phone: string) => Promise<void>
}

function EditProfileModal({
  visible,
  initialName,
  initialPhone,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), phone.trim())
      onClose()
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.')
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
              <Text style={[styles.modalSaveText, !name.trim() && { color: '#9CA3AF' }]}>
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

          <Text style={styles.modalFieldLabel}>WhatsApp / Phone</Text>
          <View style={styles.phoneInputRow}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>+91</Text>
            </View>
            <TextInput
              style={[styles.modalInput, styles.phoneInput]}
              value={phone.startsWith('+91') ? phone.slice(3) : phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          <Text style={styles.phoneHint}>
            Tenants use this number to contact you via WhatsApp
          </Text>
        </ScrollView>
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

// ─── Owner profile screen ─────────────────────────────────────────────────────

export default function OwnerProfileScreen() {
  const { profile, setProfile, clearAuth, session } = useAuthStore()
  const router = useRouter()

  const userId = session?.user.id

  const [stats, setStats] = useState<OwnerStats>({
    activeListings: 0,
    totalListings: 0,
    totalShortlists: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)

  // ── Refresh on screen focus ────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      setStatsLoading(true)
      fetchOwnerStats(userId)
        .then(setStats)
        .finally(() => setStatsLoading(false))
    }, [userId]),
  )

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarPress() {
    if (!userId) return
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
    const path = `${userId}/avatar.${ext}`

    setUploadingPhoto(true)
    try {
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('pg-photos')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('pg-photos').getPublicUrl(path)
      const avatarUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId ?? '')

      if (updateError) throw updateError

      if (profile) setProfile({ ...profile, avatarUrl })
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // ── Save profile edits ─────────────────────────────────────────────────────
  async function handleSaveProfile(name: string, phone: string) {
    // Normalise phone to E.164 format for WhatsApp deep links
    const normalised = phone
      ? phone.startsWith('+') ? phone : `+91${phone}`
      : null

    const { error } = await supabase
      .from('users')
      .update({ name, phone: normalised })
      .eq('id', userId ?? '')

    if (error) throw error
    if (profile) setProfile({ ...profile, name, phone: normalised })
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

  // Display phone without +91 prefix for readability
  const displayPhone = profile?.phone
    ? profile.phone.startsWith('+91')
      ? profile.phone.slice(3)
      : profile.phone
    : null

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
            <View style={styles.cameraOverlay}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </View>
          </Pressable>

          <Text style={styles.profileName}>{profile?.name ?? 'Your Name'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? session?.user.email ?? ''}</Text>

          {/* Phone badge */}
          {displayPhone ? (
            <View style={styles.phoneBadge}>
              <Phone size={12} color="#059669" />
              <Text style={styles.phoneBadgeText}>+91 {displayPhone}</Text>
            </View>
          ) : (
            <Pressable onPress={() => setEditModalVisible(true)} style={styles.addPhoneBtn}>
              <Phone size={12} color="#D97706" />
              <Text style={styles.addPhoneBtnText}>Add phone number</Text>
            </Pressable>
          )}

          {/* Edit Profile button */}
          <Pressable onPress={() => setEditModalVisible(true)} style={styles.editProfileBtn}>
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
                icon={<Building2 size={20} color="#2563EB" />}
                value={stats.activeListings}
                label="Active"
              />
              <View style={styles.statDivider} />
              <StatCard
                icon={<Building2 size={20} color="#6B7280" />}
                value={stats.totalListings}
                label="Total PGs"
              />
              <View style={styles.statDivider} />
              <StatCard
                icon={<Heart size={20} color="#EF4444" />}
                value={stats.totalShortlists}
                label="Shortlisted"
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
              icon={<Crown size={18} color="#D97706" />}
              label="Upgrade to Pro"
              onPress={() => router.push('/(owner)/subscription')}
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

        <Text style={styles.versionText}>Settl v1.0.0</Text>
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        initialName={profile?.name ?? ''}
        initialPhone={displayPhone ?? ''}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveProfile}
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
    marginBottom: 10,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  phoneBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  addPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  addPhoneBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
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
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phonePrefix: {
    height: 50,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  phoneHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
})
