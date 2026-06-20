/**
 * hooks/useEvents.ts — Eventure v3
 * React Query hook pour les événements Supabase.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getWorkingUid } from '@/lib/mockUser';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface EventRow {
  id          : string;
  title       : string;
  type        : string | null;
  date_start  : string | null;
  date_end    : string | null;
  location    : string | null;
  budget      : number | null;
  guests_count: number | null;
  description : string | null;
  status      : EventStatus;
  cover_image : string | null;
  organizer_id: string;
  created_at  : string;
}

type CreateEventInput = Omit<EventRow, 'id' | 'created_at'>;

/* ─── Fetchers ──────────────────────────────────────────────────────────── */

async function fetchMyEvents(): Promise<EventRow[]> {
  const uid = await getWorkingUid();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', uid)
    .order('date_start', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

async function fetchAllEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('date_start', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useMyEvents() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['events', 'mine'],
    queryFn : fetchMyEvents,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<CreateEventInput>) => {
      const uid = await getWorkingUid();
      const { data, error } = await supabase
        .from('events')
        .insert({ ...input, organizer_id: uid })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<EventRow>) => {
      const { error } = await supabase.from('events').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  return {
    events   : query.data ?? [],
    isLoading: query.isLoading,
    error    : query.error,
    refetch  : query.refetch,
    create,
    update,
    remove,
  };
}

export function usePublicEvents() {
  return useQuery({
    queryKey: ['events', 'public'],
    queryFn : fetchAllEvents,
    staleTime: 60_000,
  });
}
