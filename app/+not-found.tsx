import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { COLORS } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
        <Link href="/" style={styles.button}>
          Go back to Home screen!
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  button: { fontSize: 18, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.card, paddingHorizontal: 22, paddingVertical: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
});
