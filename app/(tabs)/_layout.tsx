import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';

// Height of the tappable area, excluding the device's bottom safe area.
const TAB_BAR_CONTENT_HEIGHT = 60;

export default function TabLayout() {
  const { role } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.textOnPrimary,
        tabBarInactiveTintColor: '#D8CBF2',
        headerStyle: { backgroundColor: COLORS.primary },
        headerShadowVisible: false,
        headerTintColor: COLORS.textOnPrimary,
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopColor: COLORS.accent,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Include the system navigation inset so the labels/icons stay above it.
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          shadowColor: COLORS.shadow,
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarIconStyle: { marginTop: 2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home-sharp' : 'home-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'school' : 'school-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: role === 'administrator' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
