import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSession, subscribeToAuth } from '@/lib/auth';
import { ensureProfile, getProfile, type Profile, type UserRole } from '@/lib/profiles';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      setProfile(await getProfile(session.user.id));
    } catch (profileLoadError) {
      try {
        setProfile(await ensureProfile(
          session.user.id,
          session.user.user_metadata?.full_name ?? '',
          'student'
        ));
      } catch (error) {
        setProfile(null);
        setProfileError(
          error instanceof Error
            ? error.message
            : profileLoadError instanceof Error
              ? profileLoadError.message
              : 'Could not load your account profile.'
        );
      }
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    getSession()
      .then((currentSession) => {
        if (active) setSession(currentSession);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = subscribeToAuth((nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, profileLoading, profileError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}