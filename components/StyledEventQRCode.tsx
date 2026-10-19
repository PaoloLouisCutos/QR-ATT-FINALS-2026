import QRCode from 'react-native-qrcode-svg';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export function StyledEventQRCode({ value, size }: { value: string; size: number }) {
  return (
    <View style={styles.frame}>
      <View style={styles.codeSurface}>
        <QRCode
          value={value}
          size={size}
          color={COLORS.textPrimary}
          backgroundColor="#FFFFFF"
          quietZone={4}
          ecl="Q"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    padding: 9,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  codeSurface: {
    padding: 13,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
});
