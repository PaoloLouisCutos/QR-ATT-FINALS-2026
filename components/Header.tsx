import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = { title: string };

export default function Header({ title }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/android-icon-foreground.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="QR Attendance logo"
      />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 26,
    marginBottom: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
});
