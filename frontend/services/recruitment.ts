// services/recruitment.ts
// Logique de recrutement partagée entre applications.tsx et staff.tsx.
// Il n'existe aucun trigger DB pour créer la mission ou mettre à jour
// event_roles.slots_filled à l'acceptation/l'annulation — c'est fait
// explicitement ici à chaque changement d'état pour rester cohérent.
import { supabase } from '@/lib/supabase';

async function bumpSlotsFilled(eventRoleId: string, delta: number) {
  const { data } = await supabase.from('event_roles').select('slots_filled').eq('id', eventRoleId).single();
  const next = Math.max((data?.slots_filled ?? 0) + delta, 0);
  await supabase.from('event_roles').update({ slots_filled: next }).eq('id', eventRoleId);
}

export interface RecruitParams {
  eventId: string;
  eventRoleId: string;
  staffId: string;
  role: string;
  hourlyRate: number;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

/** Recrutement direct par l'organisateur (staff disponible, sans candidature préalable). */
export async function recruitStaffDirectly(p: RecruitParams) {
  const { data: application, error: appErr } = await supabase.from('applications').insert({
    event_role_id: p.eventRoleId, staff_id: p.staffId, status: 'accepted', reviewed_at: new Date().toISOString(),
  }).select('id').single();
  if (appErr) throw appErr;

  const { error: missionErr } = await supabase.from('missions').insert({
    event_id: p.eventId, staff_id: p.staffId, application_id: application.id,
    role: p.role, role_name: p.role, hourly_rate: p.hourlyRate,
    mission_status: 'confirmed', payment_status: 'pending',
    scheduled_start: p.scheduledStart ?? null, scheduled_end: p.scheduledEnd ?? null,
  });
  if (missionErr) throw missionErr;

  await bumpSlotsFilled(p.eventRoleId, 1);
}

/** Accepte une candidature en attente : crée la mission + incrémente les postes pourvus. */
export async function acceptApplication(app: { id: string; event_id: string; event_role_id: string; staff_id: string; role: string; hourly_rate: number }) {
  const { error } = await supabase.from('applications').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', app.id);
  if (error) throw error;

  const { error: missionErr } = await supabase.from('missions').insert({
    event_id: app.event_id, staff_id: app.staff_id, application_id: app.id,
    role: app.role, role_name: app.role, hourly_rate: app.hourly_rate,
    mission_status: 'confirmed', payment_status: 'pending',
  });
  if (missionErr) throw missionErr;

  await bumpSlotsFilled(app.event_role_id, 1);
}

/** Refuse une candidature en attente (aucune mission n'existe encore). */
export async function rejectApplication(applicationId: string, reason?: string) {
  const { error } = await supabase.from('applications')
    .update({ status: 'rejected', reject_reason: reason ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId);
  if (error) throw error;
}

/** Annule une candidature déjà acceptée : libère le poste + annule la mission associée. */
export async function cancelAcceptedApplication(applicationId: string, eventRoleId: string, reason?: string) {
  const { error } = await supabase.from('applications')
    .update({ status: 'cancelled', reject_reason: reason ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId);
  if (error) throw error;
  await supabase.from('missions').update({ mission_status: 'cancelled' }).eq('application_id', applicationId);
  await bumpSlotsFilled(eventRoleId, -1);
}

/** Planifie ou replanifie les horaires d'une mission. */
export async function scheduleMission(missionId: string, scheduledStart: string, scheduledEnd: string) {
  const { error } = await supabase.from('missions')
    .update({ scheduled_start: scheduledStart, scheduled_end: scheduledEnd })
    .eq('id', missionId);
  if (error) throw error;
}
