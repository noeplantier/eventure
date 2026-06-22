import { supabase } from './supabase';

export type WAType =
  | 'shift_assigned'
  | 'shift_reminder'
  | 'availability_ask'
  | 'payroll_approved'
  | 'general';

export interface WAResult {
  ok         : boolean;
  configured?: boolean;
  error?     : string;
}

/**
 * Envoie un message WhatsApp à un membre du staff via l'Edge Function Twilio.
 * Nécessite TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN dans Supabase > Settings > Secrets.
 */
export async function sendWhatsApp(
  staffId  : string,
  type     : WAType = 'general',
  message? : string,
): Promise<WAResult> {
  const { data: staff } = await supabase
    .from('staff')
    .select('display_name, phone_whatsapp')
    .eq('id', staffId)
    .single();

  if (!staff?.phone_whatsapp) {
    return {
      ok: false,
      error: `Aucun numéro WhatsApp configuré pour ${staff?.display_name ?? 'ce staff'}`,
    };
  }

  const { data, error } = await supabase.functions.invoke('notify-staff', {
    body: {
      phone     : staff.phone_whatsapp,
      staffName : staff.display_name,
      type,
      message,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: data?.ok ?? false, configured: data?.configured, error: data?.error };
}

/**
 * Envoie un message WhatsApp à TOUTE l'équipe Put.in Coffee.
 * Arik est le gérant — pas inclus dans les broadcasts.
 */
export async function broadcastWhatsApp(
  type    : WAType = 'general',
  message?: string,
): Promise<WAResult[]> {
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, phone_whatsapp')
    .in('display_name', ['Oka', 'Redo']);

  if (!staff?.length) return [{ ok: false, error: 'Aucun staff trouvé' }];

  return Promise.all(staff.map(s => sendWhatsApp(s.id, type, message)));
}
