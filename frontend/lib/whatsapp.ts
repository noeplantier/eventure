import { Linking } from 'react-native';
import { supabase } from './supabase';

const MANAGER_PHONE = '33666167788'; // +33 6 66 16 77 88

export type WAType =
  | 'mission_assigned'
  | 'invitation'
  | 'availability_ask'
  | 'payroll_approved'
  | 'general';

export interface WAResult { ok: boolean; error?: string }

const WA_TEMPLATES: Record<WAType, (name: string, extra?: string) => string> = {
  mission_assigned: (n, e) => `Bonjour ${n} ! Vous avez été assigné(e) à une nouvelle mission${e ? ` : ${e}` : ''}. Consultez l'app Eventure pour les détails.`,
  invitation:       (n, e) => `Bonjour ${n} ! Arik vous invite à l'événement "${e || 'prochain'}". Merci de confirmer votre disponibilité.`,
  availability_ask: (n)    => `Bonjour ${n} ! Pouvez-vous confirmer vos disponibilités pour la semaine prochaine sur l'app Eventure ?`,
  payroll_approved: (n, e) => `Bonjour ${n} ! Votre paie a été approuvée${e ? ` : ${e}` : ''}. Merci pour votre travail !`,
  general:          (n, e) => e ?? `Bonjour ${n} ! Message de Put.in Coffee.`,
};

/**
 * Opens WhatsApp with a pre-filled message.
 * Sends to the manager's number (+33 6 66 16 77 88) by default, or to staff's phone if provided.
 * No external API — uses wa.me deep link.
 */
export async function sendWhatsApp(
  staffId  : string,
  type     : WAType = 'general',
  extra?   : string,
  toPhone? : string, // optional override; defaults to MANAGER_PHONE
): Promise<WAResult> {
  try {
    const { data: staff } = await supabase
      .from('staff')
      .select('display_name, phone_whatsapp')
      .eq('id', staffId)
      .single();

    const staffName = staff?.display_name ?? 'Staff';
    const phone     = toPhone ?? staff?.phone_whatsapp ?? MANAGER_PHONE;
    const msg       = WA_TEMPLATES[type](staffName, extra);
    const encoded   = encodeURIComponent(msg);
    const cleaned   = phone.replace(/\D/g, '');
    const url       = `whatsapp://send?phone=${cleaned}&text=${encoded}`;
    const fallback  = `https://wa.me/${cleaned}?text=${encoded}`;

    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallback);

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Impossible d'ouvrir WhatsApp" };
  }
}

/**
 * Opens WhatsApp with a custom message to the manager.
 */
export async function sendWhatsAppToManager(message: string): Promise<WAResult> {
  try {
    const encoded  = encodeURIComponent(message);
    const url      = `whatsapp://send?phone=${MANAGER_PHONE}&text=${encoded}`;
    const fallback = `https://wa.me/${MANAGER_PHONE}?text=${encoded}`;
    const canOpen  = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallback);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

/**
 * Broadcast WhatsApp to all staff (Oka + Redo).
 */
export async function broadcastWhatsApp(type: WAType = 'general', extra?: string): Promise<WAResult[]> {
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, phone_whatsapp')
    .in('display_name', ['Oka', 'Redo']);

  if (!staff?.length) return [{ ok: false, error: 'Aucun staff trouvé' }];
  return Promise.all(staff.map(s => sendWhatsApp(s.id, type, extra)));
}
