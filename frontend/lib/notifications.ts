/**
 * lib/notifications.ts — Eventure v3
 *
 * Setup push notifications via expo-notifications.
 * Permissions + Expo Push Token + local scheduling + Supabase storage.
 *
 * Usage dans _layout.tsx :
 *   import { setupNotifications } from '@/lib/notifications';
 *   await setupNotifications(userId);
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/* ─── Configure handler (called before anything else) ─────────────────── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner : true,
    shouldShowList   : true,
    shouldPlaySound  : true,
    shouldSetBadge   : true,
  }),
});

/* ─── Permission + Token ─────────────────────────────────────────────── */

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    return token;
  } catch (e) {
    console.warn('[notifications] getExpoPushToken error:', e);
    return null;
  }
}

/** Saves the Expo push token to Supabase (table: push_tokens) */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (e) {
    console.warn('[notifications] savePushToken error:', e);
  }
}

/** Full setup: permission → token → save. Call once on app start. */
export async function setupNotifications(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const token = await getExpoPushToken();
    if (token && userId) await savePushToken(userId, token);
    return token;
  } catch (e) {
    console.warn('[notifications] setup error:', e);
    return null;
  }
}

/* ─── Local notifications (no backend needed) ──────────────────────────── */

/** Schedule a local notification immediately */
export async function notifyNow(title: string, body: string, data?: object): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: true },
      trigger : null, // immediate
    });
  } catch {}
}

/** Schedule a local notification at a future date */
export async function notifyAt(
  title: string, body: string, date: Date, data?: object
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    return id;
  } catch { return null; }
}

/** Cancel a previously scheduled notification */
export async function cancelNotification(id: string): Promise<void> {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}

/* ─── Eventure-specific helpers ─────────────────────────────────────────── */

/** Notify organizer that a new application arrived */
export const notifyNewApplication = (staffName: string, role: string, eventTitle: string) =>
  notifyNow(
    '📋 Nouvelle candidature',
    `${staffName} postule pour ${role} · ${eventTitle}`
  );

/** Notify organizer that a mission is starting soon (24h before) */
export const notifyMissionSoon = (eventTitle: string, date: Date) =>
  notifyAt(
    '⏰ Mission demain',
    `${eventTitle} commence dans 24h — vérifiez le staffing`,
    new Date(date.getTime() - 86400000)
  );

/** Notify staff that their application was accepted */
export const notifyApplicationAccepted = (role: string, eventTitle: string) =>
  notifyNow(
    '✅ Candidature acceptée !',
    `Vous êtes sélectionné·e pour ${role} · ${eventTitle}`
  );

/** Notify staff that a new mission matching their profile is available */
export const notifyNewMission = (role: string, location: string, rate: number) =>
  notifyNow(
    '🎯 Nouvelle mission disponible',
    `${role} · ${location} · ${rate}€/h`
  );
