import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Role, UserRole } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (...roles: Role[]) => boolean;
  isAdmin: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }
    setProfile(profileData as Profile | null);

    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('id, user_id, role, created_at')
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setRoles([]);
      return;
    }
    setRoles((rolesData ?? []).map((r: UserRole) => r.role as Role));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchProfileAndRoles(s.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfileAndRoles(s.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfileAndRoles]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfileAndRoles(session.user.id);
    }
  }, [session, fetchProfileAndRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setSession(null);
  }, []);

  const hasRole = useCallback(
    (role: Role) => roles.includes(role),
    [roles]
  );

  const hasAnyRole = useCallback(
    (...checkRoles: Role[]) => checkRoles.some((r) => roles.includes(r)),
    [roles]
  );

  const isAdmin = useCallback(
    () => roles.includes('super_admin') || roles.includes('admin'),
    [roles]
  );

  return (
    <AuthContext.Provider
      value={{ session, profile, roles, loading, signIn, signOut, hasRole, hasAnyRole, isAdmin, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
