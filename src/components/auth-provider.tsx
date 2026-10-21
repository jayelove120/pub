'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';
import { api } from '@/lib/api-client';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  phone?: string | null;
  receive_alert_sms?: boolean;
}

interface AuthContextType {
  loading: boolean;
  authenticated: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  loading: true,
  authenticated: false,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api<Profile>('/api/profile');
      setProfile(p);
    } catch {
      // 未登录则忽略
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const client = await getSupabaseBrowserClientAsync();
        const { data } = await client.auth.getSession();
        if (data.session?.access_token) {
          setAuthenticated(true);
        }
        await refreshProfile();
      } catch (e) {
        console.error('[auth] 初始化失败', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    try {
      const client = await getSupabaseBrowserClientAsync();
      await client.auth.signOut();
    } catch {
      // ignore
    }
    setAuthenticated(false);
    setProfile(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ loading, authenticated, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}