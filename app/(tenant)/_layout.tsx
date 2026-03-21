import { Tabs } from 'expo-router'
import { Heart, Home, Search, User } from 'lucide-react-native'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useShortlistStore } from '@/store/shortlistStore'

const ACTIVE = '#2563EB'
const INACTIVE = '#9CA3AF'

export default function TenantLayout() {
  const count = useShortlistStore((s) => s.shortlistedIds.size)

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
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shortlist"
          options={{
            title: 'Shortlist',
            tabBarBadge: count > 0 ? count : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#2563EB',
              fontSize: 10,
              minWidth: 16,
              height: 16,
              lineHeight: 16,
            },
            tabBarIcon: ({ color, size }) => <Heart size={size} color={color} />,
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
