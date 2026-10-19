import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = PropsWithChildren<{
  variant?: 'default' | 'elevated' | 'outlined';
  style?: StyleProp<ViewStyle>;
}>;

export default function Card({ children, variant = 'default', style }: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  elevated: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
});
