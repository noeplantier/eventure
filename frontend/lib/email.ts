import { Linking } from 'react-native';
import { supabase } from './supabase';

const MANAGER_EMAIL = 'plantiernoe50@gmail.com';

export type EmailType =
  | 'mission_assigned'
  | 'payroll_approved'
  | 'invitation'
  | 'weekly_summary'
  | 'general';

const EMAIL_TEMPLATES: Record<
  EmailType,
  (staffName: string, extra?: string) => { subject: string; body: string }
> = {
  mission_assigned: (n, e) => ({
    subject: `Eventure — Nouvelle mission assignée à ${n}`,
    body: `Bonjour,\n\n${n} a été assigné(e) à une nouvelle mission${e ? ` :\n${e}` : ''}.\n\nConsultez l'app Eventure pour les détails.\n\nBonne soirée,\nPut.in Coffee`,
  }),
  payroll_approved: (n, e) => ({
    subject: `Eventure — Paie approuvée pour ${n}`,
    body: `Bonjour,\n\nLa paie de ${n} a été approuvée et marquée comme payée${e ? ` : ${e}` : ''}.\n\nMerci,\nPut.in Coffee`,
  }),
  invitation: (n, e) => ({
    subject: `Eventure — Invitation de ${n}`,
    body: `Bonjour,\n\n${n} a été invité(e) à l'événement "${e || 'prochain'}".\n\nMerci de confirmer votre disponibilité dans l'app.\n\nPut.in Coffee`,
  }),
  weekly_summary: (_n, e) => ({
    subject: `Eventure — Résumé hebdomadaire Put.in Coffee`,
    body: `Bonjour,\n\nVoici le résumé de la semaine pour votre équipe :\n\n${e || 'Aucune donnée disponible.'}\n\nBonne semaine,\nPut.in Coffee`,
  }),
  general: (n, e) => ({
    subject: `Eventure — Message de Put.in Coffee`,
    body: e ?? `Bonjour ${n},\n\nCeci est un message de Put.in Coffee.\n\nCordialement,\nArik`,
  }),
};

export interface EmailResult { ok: boolean; error?: string }

/**
 * Opens the default mail client with a pre-filled email.
 * No external API needed — uses mailto: deep link.
 * Target: plantiernoe50@gmail.com
 */
export async function sendEmail(
  staffId  : string,
  type     : EmailType = 'general',
  extra?   : string,
  toEmail? : string,
): Promise<EmailResult> {
  try {
    const { data: staff } = await supabase
      .from('staff')
      .select('display_name, email')
      .eq('id', staffId)
      .single();

    const staffName = staff?.display_name ?? 'Staff';
    const target    = toEmail ?? MANAGER_EMAIL;
    const tpl       = EMAIL_TEMPLATES[type](staffName, extra);

    const mailtoUrl = `mailto:${target}?subject=${encodeURIComponent(tpl.subject)}&body=${encodeURIComponent(tpl.body)}`;
    await Linking.openURL(mailtoUrl);

    // Log to in_app_notifications for real-time feed
    await supabase.from('in_app_notifications').insert({
      staff_id: staffId,
      type: 'email_sent',
      title: `Email envoyé — ${tpl.subject}`,
      body: `Destinataire : ${target}`,
      data: { email_type: type, recipient: target },
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Impossible d'ouvrir la messagerie" };
  }
}

/**
 * Send weekly summary email about all staff to manager.
 */
export async function sendWeeklySummaryEmail(): Promise<EmailResult> {
  try {
    const { data: payroll } = await supabase
      .from('payroll')
      .select('*, staff(display_name)')
      .eq('status', 'pending');

    const lines = (payroll ?? []).map((p: any) =>
      `• ${p.staff?.display_name}: ${p.hours_worked}h × ${p.hourly_rate}€/h = ${p.gross_total}€`
    ).join('\n');

    const subject = `Eventure — Résumé Put.in Coffee ${new Date().toLocaleDateString('fr-FR')}`;
    const body    = `Bonjour Arik,\n\nVoici le résumé de la semaine :\n\n${lines || 'Aucune paie en attente.'}\n\nCordialement,\nEventure`;

    const mailtoUrl = `mailto:${MANAGER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(mailtoUrl);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}
