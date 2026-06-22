// lib/emailNotifications.ts — Eventure v3
// Sends email notifications via the send-email Edge Function (Resend)
import { supabase } from './supabase';

export async function sendMissionNotification(params: {
  staffName: string;
  eventTitle: string;
  missionDate: string;
  role: string;
  amount: number;
  action: 'confirmed' | 'rejected';
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lhiqmyyxunpoyqdqkcnb.supabase.co'}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify(params),
      }
    );
  } catch {
    // Silent — email is non-critical
  }
}
