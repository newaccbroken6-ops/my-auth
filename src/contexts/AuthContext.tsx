import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, Profile } from '../lib/api';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  username?: string | null;
  avatar_url?: string | null;
}

export interface Session {
  access_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { user: userProfile } = await api.getMe();
      setProfile(userProfile);
      setUser(userProfile);
      setSession({
        access_token: token,
        user: userProfile,
      });
    } catch (err) {
      console.warn('Failed to load authenticated profile:', err);
      api.logout();
      setUser(null);
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    await loadProfile();
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      setProfile(data.user);
      setSession({
        access_token: data.token,
        user: data.user,
      });
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  }

  async function signUp(email: string, password: string, username: string) {
    try {
      const data = await api.register(email, password, username);
      setUser(data.user);
      setProfile(data.user);
      setSession({
        access_token: data.token,
        user: data.user,
      });
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Registration failed' };
    }
  }

  async function signOut() {
    api.logout();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
