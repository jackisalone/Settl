import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function OwnerAnalyticsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <Text className="text-2xl font-bold text-gray-900">Analytics</Text>
      <Text className="text-sm text-gray-400 mt-2">Coming soon</Text>
    </SafeAreaView>
  )
}
