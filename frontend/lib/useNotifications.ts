import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { markAllRead, markRead } from './notificationService';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [userId]);

  useEffect(() => {
    fetch();
    if (!userId) return;

    const topic = `notif_${userId}`;
    supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`).forEach((c) => supabase.removeChannel(c));

    const channel = supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetch]);

  const readAll = useCallback(async () => {
    if (userId) {
      await markAllRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  const readOne = useCallback(async (id: string) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, refresh: fetch, readAll, readOne };
}
