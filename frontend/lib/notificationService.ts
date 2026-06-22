import { supabase } from './supabase';

export type NotifType = 'mission_confirmed' | 'mission_rejected' | 'application_new' | 'event_update' | 'payment';

export interface CreateNotifParams {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotifParams) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
    read: false,
  });
  if (error) console.warn('[notif]', error.message);
}

export async function markAllRead(userId: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function markRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}
