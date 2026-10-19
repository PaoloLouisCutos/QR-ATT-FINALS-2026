import { supabase } from '@/lib/supabase';

export type UserRole = 'student' | 'teacher' | 'administrator';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(userId: string, fullName: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function ensureProfile(
  userId: string,
  fullName: string,
  role: UserRole
): Promise<Profile> {
  const existing = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as Profile;

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, full_name: fullName || 'New user', role })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
