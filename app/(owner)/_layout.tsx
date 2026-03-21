import { Tabs, Redirect } from 'expo-router'
import { Building2, ChartBar, User } from 'lucide-react-native'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useAuthStore } from '@/store/authStore'

const ACTIVE = '#2563EB'
const INACTIVE = '#9CA3AF'

export default function OwnerLayout() {
  const { profile } = useAuthStore()

  // Redirect authenticated tenants who land on owner routes back to their dashboard
  if (profile && profile.role !== 'owner') {
    return <Redirect href="/(tenant)" />
  }

  return (
    <BottomSheetModalProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'My Listings',
            tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, size }) => <ChartBar size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
    </BottomSheetModalProvider>
  )
}
