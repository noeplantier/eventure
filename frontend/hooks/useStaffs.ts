/**
 * hooks/useStaffs.ts — Eventure v3
 * React Query hook pour le staffing (NO AUTH required).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type StaffStatus = 'active' | 'inactive' | 'pending';

export interface StaffRow {
  id          : string;
  name        : string;
  email       : string | null;
  phone       : string | null;
  skills      : string[];
  hourly_rate : number | null;
  rating      : number | null;
  status      : StaffStatus;
  avatar_url  : string | null;
  bio         : string | null;
  availability: Record<string, unknown> | null;
  user_id     : string | null;
  created_at  : string;
}

/* ─── Fetchers ──────────────────────────────────────────────────────────── */

async function fetchAllStaffs(): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from('staffs')
    .select('*')
    .eq('status', 'active')
    .order('rating', { ascending: false });
  if (error) {
    // Fallback: fetch without filter
    const { data: d2 } = await supabase.from('staffs').select('*').order('name');
    return (d2 ?? []) as StaffRow[];
  }
  return (data ?? []) as StaffRow[];
}

async function fetchAvailableStaffs(date: string): Promise<StaffRow[]> {
  // Returns staffs not already assigned on a given date
  const { data, error } = await supabase
    .from('staffs')
    .select('*, missions!left(check_in)')
    .eq('status', 'active')
    .is('missions.check_in', null);
  if (error) return fetchAllStaffs();
  return (data ?? []) as StaffRow[];
}

async function fetchStaffsBySkill(skill: string): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from('staffs')
    .select('*')
    .contains('skills', [skill])
    .eq('status', 'active')
    .order('rating', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

/* ─── Match score algorithm (staffs ↔ organizers) ──────────────────────── */

/** Simple compatibility score: skill match + rating + rate fit */
export function scoreStaffForRole(
  staff: StaffRow,
  requiredSkills: string[],
  maxRate: number
): number {
  const skillMatch = requiredSkills.filter(s => staff.skills?.includes(s)).length;
  const skillScore = requiredSkills.length > 0
    ? (skillMatch / requiredSkills.length) * 50
    : 25;
  const ratingScore = (staff.rating ?? 3) * 6;          // 0–30
  const rateScore   = staff.hourly_rate != null && staff.hourly_rate <= maxRate
    ? 20 : 0;
  return Math.round(skillScore + ratingScore + rateScore);
}

/** Returns all active staffs ranked by fit for the given requirements */
export function rankStaffsForRole(
  staffs: StaffRow[],
  requiredSkills: string[],
  maxRate: number
): Array<StaffRow & { score: number }> {
  return staffs
    .map(s => ({ ...s, score: scoreStaffForRole(s, requiredSkills, maxRate) }))
    .sort((a, b) => b.score - a.score);
}

/* ─── Hooks ─────────────────────────────────────────────────────────────── */

export function useStaffs() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['staffs'],
    queryFn : fetchAllStaffs,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<StaffRow>) => {
      const { data, error } = await supabase
        .from('staffs')
        .insert({ status: 'active', skills: [], ...input })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffs'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<StaffRow>) => {
      const { error } = await supabase.from('staffs').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffs'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staffs').update({ status: 'inactive' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffs'] }),
  });

  return {
    staffs   : query.data ?? [],
    isLoading: query.isLoading,
    error    : query.error,
    refetch  : query.refetch,
    create,
    update,
    remove,
  };
}

export function useAvailableStaffs(date: string) {
  return useQuery({
    queryKey: ['staffs', 'available', date],
    queryFn : () => fetchAvailableStaffs(date),
    enabled : !!date,
    staleTime: 15_000,
  });
}

export function useStaffsBySkill(skill: string) {
  return useQuery({
    queryKey: ['staffs', 'skill', skill],
    queryFn : () => fetchStaffsBySkill(skill),
    enabled : !!skill,
    staleTime: 60_000,
  });
}
