import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import type { ActivityPage } from '@velozity/shared';
import { api, apiOrigin, getToken, refreshSession } from './api';
import { useAuth } from './auth';
const LiveContext = createContext({ connected: false, online: 0 });
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(0);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let renewing = false;
    const cursorKey = `activity-cursor:${user.id}`;
    const socket = io(apiOrigin || window.location.origin, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => callback({ token: getToken() }),
    });
    const catchup = async () => {
      const saved = sessionStorage.getItem(cursorKey);
      const after = saved && /^\d{1,19}$/.test(saved) ? saved : '0';
      const page = await api<ActivityPage>(`/activities/catchup?after=${after}`);
      if (!stopped) {
        sessionStorage.setItem(cursorKey, page.cursor);
        void cache.invalidateQueries();
      }
    };
    const renew = async () => {
      if (renewing || stopped) return;
      renewing = true;
      try {
        await refreshSession();
        if (!stopped) socket.connect();
      } catch {
        /* AuthProvider handles an expired session. */
      } finally {
        renewing = false;
      }
    };
    socket.on('connect', () => {
      setConnected(true);
      void catchup().catch(() => {});
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') retryTimer = setTimeout(() => void renew(), 250);
    });
    socket.on('connect_error', (error) => {
      setConnected(false);
      if (error.message === 'UNAUTHENTICATED') retryTimer = setTimeout(() => void renew(), 1000);
    });
    socket.on('presence', (data: { count: number }) => setOnline(data.count));
    socket.on('sync', (data: { resources: string[] }) => {
      for (const key of data.resources) void cache.invalidateQueries({ queryKey: [key] });
    });
    const visible = () => {
      if (document.visibilityState === 'visible' && socket.connected)
        void catchup().catch(() => {});
    };
    document.addEventListener('visibilitychange', visible);
    socket.connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket.disconnect();
      document.removeEventListener('visibilitychange', visible);
      setConnected(false);
    };
  }, [user, cache]);
  return <LiveContext.Provider value={{ connected, online }}>{children}</LiveContext.Provider>;
}
export const useLive = () => useContext(LiveContext);
