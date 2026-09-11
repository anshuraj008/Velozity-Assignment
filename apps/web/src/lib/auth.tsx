import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@velozity/shared';
import { api, json, refreshSession, setToken } from './api';
interface Auth {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useQueryClient();
  useEffect(() => {
    let active = true;
    void refreshSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      cache.clear();
    };
    window.addEventListener('session-expired', expired);
    return () => {
      active = false;
      window.removeEventListener('session-expired', expired);
    };
  }, [cache]);
  async function login(email: string, password: string) {
    const data = await api<{ user: User; accessToken: string }>(
      '/auth/login',
      json('POST', { email, password }),
    );
    cache.clear();
    setToken(data.accessToken);
    setUser(data.user);
  }
  async function logout() {
    await api('/auth/logout', json('POST'));
    setToken(null);
    setUser(null);
    cache.clear();
  }
  return <Context.Provider value={{ user, loading, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
