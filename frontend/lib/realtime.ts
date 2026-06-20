/**
 * lib/realtime.ts — Eventure v3
 *
 * Supabase Realtime subscriptions for live updates.
 * Covers: events, staffs, missions, applications, organizers.
 *
 * Usage:
 *   const unsub = realtime.subscribeToEvents((payload) => { ... });
 *   // Later: unsub();
 */
import { supabase } from './supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeHandler<T = Record<string, unknown>> = (
  payload: RealtimePostgresChangesPayload<T>
) => void;

type Unsub = () => void;

/* ─── Generic subscription factory ─────────────────────────────────────── */

function subscribeToTable<T = Record<string, unknown>>(
  table   : string,
  handler : ChangeHandler<T>,
  filter? : string
): Unsub {
  const channelName = filter
    ? `rt-${table}-${filter.replace(/[^a-z0-9]/gi, '_')}`
    : `rt-${table}-${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
      handler as ChangeHandler
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/* ─── Public realtime API ───────────────────────────────────────────────── */

export const realtime = {
  /**
   * Subscribe to changes on the `events` table.
   * Fires on INSERT, UPDATE, DELETE.
   */
  subscribeToEvents: (handler: ChangeHandler, organizerId?: string): Unsub =>
    subscribeToTable(
      'events',
      handler,
      organizerId ? `organizer_id=eq.${organizerId}` : undefined
    ),

  /**
   * Subscribe to changes on the `staffs` table.
   * Useful for live staff availability updates.
   */
  subscribeToStaffs: (handler: ChangeHandler): Unsub =>
    subscribeToTable('staffs', handler),

  /**
   * Subscribe to changes on the `missions` table.
   * Optionally filter by event_id.
   */
  subscribeToMissions: (handler: ChangeHandler, eventId?: string): Unsub =>
    subscribeToTable(
      'missions',
      handler,
      eventId ? `event_id=eq.${eventId}` : undefined
    ),

  /**
   * Subscribe to changes on the `applications` table.
   * Optionally filter by event_id to track applications for a specific event.
   */
  subscribeToApplications: (handler: ChangeHandler, eventId?: string): Unsub =>
    subscribeToTable(
      'applications',
      handler,
      eventId ? `event_id=eq.${eventId}` : undefined
    ),

  /**
   * Subscribe to changes on the `organizers` table.
   * Useful for profile sync across sessions.
   */
  subscribeToOrganizers: (handler: ChangeHandler, organizerId?: string): Unsub =>
    subscribeToTable(
      'organizers',
      handler,
      organizerId ? `id=eq.${organizerId}` : undefined
    ),
};

/* ─── React hook: useRealtime ────────────────────────────────────────────── */

import { useEffect } from 'react';

/**
 * Hook that subscribes to a realtime channel and auto-unsubscribes on unmount.
 *
 * @example
 * useRealtime(() => realtime.subscribeToMissions(refetch, eventId), [eventId]);
 */
export function useRealtime(
  subscribe: () => Unsub,
  deps: unknown[] = []
): void {
  useEffect(() => {
    const unsub = subscribe();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
