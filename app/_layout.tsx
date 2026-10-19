import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/components/AuthProvider';

export default function RootLayout() {
  return <AuthProvider><RootNavigator /></AuthProvider>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isAuthRoute = pathname === '/login' || pathname === '/register';
    if (!session && !isAuthRoute) router.replace('/login');
    if (session && isAuthRoute) router.replace('/(tabs)');
  }, [loading, pathname, router, session]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
    </Stack>
  );
}
