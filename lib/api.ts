/**
 * lib/api.ts
 * Couche API — utilise Supabase si configuré, mock data sinon.
 * Remplacez isMockMode par false dès que votre Supabase est prêt.
 */

import { supabase, isMockMode } from './supabase';
import {
  MOCK_EVENTS, MOCK_STAFF, MOCK_APPLICATIONS,
  MOCK_MISSIONS, MOCK_STATS, MOCK_USER,
} from './mockData';

// ── Events ────────────────────────────────────────────────────────────────
export async function getEvents(organizerId?: string) {
  if (isMockMode) {
    return organizerId
      ? MOCK_EVENTS.filter(() => true)
      : MOCK_EVENTS.filter(e => e.status === 'published');
  }
  const q = supabase.from('events').select(`
    id, title, description, location, date_start, date_end,
    type, status, cover_url,
    event_roles(id, role, slots, slots_filled, hourly_rate, dress_code)
  `);
  if (organizerId) q.eq('organizer_id', organizerId);
  const { data } = await q.order('date_start', { ascending:true });
  return data ?? [];
}

export async function createEvent(payload: any) {
  if (isMockMode) {
    console.log('[MOCK] createEvent:', payload);
    return { id: 'mock-event-' + Date.now(), ...payload };
  }
  const { data, error } = await supabase.from('events').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

// ── Applications ─────────────────────────────────────────────────────────
export async function getApplications(eventId?: string) {
  if (isMockMode) return MOCK_APPLICATIONS;
  const { data } = await supabase.from('applications').select('*, staff:staff_id(*)');
  return data ?? [];
}

export async function applyToEvent(eventRoleId: string, staffId: string, message?: string) {
  if (isMockMode) {
    console.log('[MOCK] applyToEvent:', eventRoleId);
    return { id: 'mock-app-' + Date.now(), status:'pending' };
  }
  const { data, error } = await supabase.from('applications').insert({
    event_role_id: eventRoleId, staff_id: staffId, message,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateApplicationStatus(id: string, status: 'accepted'|'rejected') {
  if (isMockMode) { console.log('[MOCK] updateApp:', id, status); return; }
  await supabase.from('applications').update({ status }).eq('id', id);
}

// ── Staff ─────────────────────────────────────────────────────────────────
export async function getStaff() {
  if (isMockMode) return MOCK_STAFF;
  const { data } = await supabase.from('staff').select('*').eq('is_available', true);
  return data ?? [];
}

// ── Stats ─────────────────────────────────────────────────────────────────
export async function getOrganizerStats(organizerId: string) {
  if (isMockMode) return MOCK_STATS.organizer;
  // TODO : requêtes Supabase agrégées
  return MOCK_STATS.organizer;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function getCurrentUser() {
  if (isMockMode) return MOCK_USER;
  const { data:{ user } } = await supabase.auth.getUser();
  return user;
}
