import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const { session, profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.subtitle}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Permission Needed</Text>
        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
        </Text>
        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    if (!session || !profile || profile.role !== 'student') {
      setMessage('Only student accounts can record attendance.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await registerAttendance(data, session.user.id);
      setSuccess(result.success);
      setMessage(result.message);
      setEventTitle(result.eventTitle ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record attendance.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {busy ? 'Checking event and recording attendance...' : scanned ? 'QR Code detected' : 'Point your camera at a QR code'}
        </Text>

        {eventTitle && (
          <Text style={styles.scanResult}>{eventTitle}</Text>
        )}

        {message && (
          <Text accessibilityRole="alert" style={[styles.message, success && styles.success]}>
            {message}
          </Text>
        )}

        {scanned && (
          <AppButton
            theme="primary"
            title={busy ? 'Checking...' : 'Scan Again'}
            icon="refresh"
            onPress={() => {
              if (busy) return;
              setScanned(false);
              setEventTitle(null);
              setMessage(null);
              setSuccess(false);
            }}
            disabled={busy}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  scanResult: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#B71C1C',
    textAlign: 'center',
    marginBottom: 12,
  },
  success: { color: '#2E7D32' },
});
