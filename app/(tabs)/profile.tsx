import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import { signOut } from '@/lib/auth';
import { updateProfile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  const saveProfile = async () => {
    if (!profile) return;
    if (!fullName.trim()) {
      setMessage('Full name is required.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await updateProfile(profile.id, fullName);
      await refreshProfile();
      setMessage('Profile updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await signOut();
    if (error) setMessage(error.message);
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>Your profile</Text>
        <Text style={styles.role}>
          {profile?.role === 'administrator' ? 'Administrator' : profile?.role === 'teacher' ? 'Teacher' : 'Student'}
        </Text>
        <Text style={styles.detail}>{session?.user.email}</Text>
        <Text style={styles.detail}>User ID: {session?.user.id}</Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
        {message && <Text style={styles.message}>{message}</Text>}
        <AppButton theme="primary" title={busy ? 'Saving...' : 'Save profile'} icon="save-outline" onPress={saveProfile} disabled={busy} />
        <AppButton title="Sign out" icon="log-out-outline" onPress={handleSignOut} disabled={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, width: '100%', maxWidth: 700, alignSelf: 'center', marginTop: 22, marginBottom: 22, backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: 10 },
  title: { color: COLORS.textPrimary, fontSize: 30, fontWeight: '800', marginBottom: 6 },
  role: { color: COLORS.primary, backgroundColor: COLORS.surface, overflow: 'hidden', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, fontWeight: '700', marginBottom: 22 },
  detail: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, lineHeight: 19 },
  label: { color: COLORS.textPrimary, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, color: COLORS.textPrimary, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 14 },
  message: { color: COLORS.primary, marginBottom: 12 },
});