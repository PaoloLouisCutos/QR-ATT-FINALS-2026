import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}