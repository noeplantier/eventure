/**
 * hooks/useMissions.ts — Eventure v3
 * React Query hook pour les missions (NO AUTH required).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getWorkingUid } from '@/lib/mockUser';

export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface MissionRow {
  id            : string;
  event_id      : string;
  staff_id      : string | null;
  application_id: string | null;
  role          : string | null;
  hourly_rate   : number | null;
  check_in      : string | null;
  check_out     : string | null;
  hours_worked  : number | null;
  amount_due    : number | null;
  amount_paid   : number | null;
  payment_status: PaymentStatus;
  created_at    : string;
}

/* ─── Fetchers ──────────────────────────────────────────────────────────── */

async function fetchMissionsByOrganizer(): Promise<MissionRow[]> {
  const uid = await getWorkingUid();
  const { data, error } = await supabase
    .from('missions')
    .select('*, events!inner(organizer_id)')
    .eq('events.organizer_id', uid)
    .order('created_at', { ascending: false });
  if (error) {
    // Fallback sans join
    const { data: d2 } = await supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false });
    return (d2 ?? []) as MissionRow[];
  }
  return (data ?? []) as MissionRow[];
}

async function fetchMissionsByStaff(staffId: string): Promise<MissionRow[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MissionRow[];
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useMissions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['missions', 'organizer'],
    queryFn : fetchMissionsByOrganizer,
    staleTime: 20_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<MissionRow>) => {
      const { data, error } = await supabase
        .from('missions')
        .insert({ payment_status: 'pending', ...input })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, amount_paid, payment_status }: {
      id: string; amount_paid?: number; payment_status: PaymentStatus;
    }) => {
      const { error } = await supabase.from('missions')
        .update({ amount_paid, payment_status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });

  return {
    missions : query.data ?? [],
    isLoading: query.isLoading,
    error    : query.error,
    refetch  : query.refetch,
    create,
    updatePayment,
  };
}

export function useStaffMissions(staffId: string) {
  return useQuery({
    queryKey: ['missions', 'staff', staffId],
    queryFn : () => fetchMissionsByStaff(staffId),
    enabled : !!staffId,
    staleTime: 20_000,
  });
}
