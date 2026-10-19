import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    const normalizedEmail = email.trim();
    if (!fullName.trim()) return setMessage('Full name is required.');
    if (!normalizedEmail.includes('@')) return setMessage('Enter a valid email address.');
    if (password.length < 6) return setMessage('Password must be at least 6 characters.');
    setBusy(true);
    setMessage(null);
    const { data, error } = await signUp(normalizedEmail, password, fullName.trim());
    setBusy(false);
    if (error) return setMessage(error.message);
    if (!data.session) return setMessage('Account created. Check your email to confirm, then sign in.');
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Image source={require('@/assets/images/android-icon-foreground.png')} style={styles.brandImage} accessibilityLabel="QR Attendance" />
        </View>
        <Text style={styles.eyebrow}>JOIN QR ATTENDANCE</Text>
        <Text style={styles.title}>Create account</Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Full name</Text>
          <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={COLORS.textTertiary} value={fullName} onChangeText={setFullName} />
          <Text style={styles.fieldLabel}>Email address</Text>
          <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textTertiary} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput style={styles.input} placeholder="At least 6 characters" placeholderTextColor={COLORS.textTertiary} secureTextEntry value={password} onChangeText={setPassword} />
          <Text style={styles.roleNote}>New accounts are Students. An Administrator can assign Teacher access.</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <AppButton theme="primary" title={busy ? 'Creating...' : 'Create account'} icon="person-add-outline" onPress={handleRegister} disabled={busy} />
        </View>
        <Link href="/login" style={styles.link}>Already have an account?</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center' },
  content: { padding: 24, width: '100%', maxWidth: 540, alignSelf: 'center' },
  brandMark: { width: 78, height: 78, borderRadius: 25, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginBottom: 18, borderColor: COLORS.border, borderWidth: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.14, shadowRadius: 14, elevation: 4 },
  brandImage: { width: 72, height: 72, borderRadius: 22 },
  eyebrow: { color: COLORS.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  title: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '800', marginBottom: 22 },
  formCard: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 18, padding: 20, shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, color: COLORS.textPrimary, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 16 },
  roleNote: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  message: { color: '#B3261E', marginBottom: 12 },
  link: { color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginTop: 18 },
});