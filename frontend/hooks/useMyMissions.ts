// hooks/useMyMissions.ts
// Missions du jour pour le staff connecté (résolu via app_users.staff_id).
// Lecture directe Supabase + realtime — pas de backend FastAPI dans ce flux.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentStaffId } from '@/services/api';

export type MissionStatus = 'assigned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface MyMission {
  id: string;
  event_id: string;
  event_title: string;
  event_location: string;
  role: string | null;
  mission_status: MissionStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  date_start: string | null;
  date_end: string | null;
  check_in: string | null;
  check_out: string | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Meilleure estimation de la date d'une mission — les colonnes scheduled_start/date_start sont incohérentes en base. */
export function missionDate(m: MyMission): Date | null {
  const raw = m.scheduled_start ?? m.date_start ?? m.scheduled_end ?? m.date_end;
  return raw ? new Date(raw) : null;
}

export function isToday(m: MyMission): boolean {
  const d = missionDate(m);
  if (!d) return false;
  return d >= startOfToday() && d <= endOfToday();
}

/** "Régisseur" est un libellé de rôle par mission, pas un rôle de compte — cf. missions.role / role_name. */
export function isRegisseur(m: Pick<MyMission, 'role'>): boolean {
  return (m.role ?? '').toLowerCase().includes('régisseur') || (m.role ?? '').toLowerCase().includes('regisseur');
}

const SELECT_COLS = 'id,event_id,role,role_name,mission_status,scheduled_start,scheduled_end,date_start,date_end,check_in,check_out,events(title,location)';

function mapRow(m: any): MyMission {
  return {
    id: m.id,
    event_id: m.event_id,
    event_title: m.events?.title ?? 'Événement',
    event_location: m.events?.location ?? '',
    role: m.role ?? m.role_name ?? null,
    mission_status: m.mission_status,
    scheduled_start: m.scheduled_start,
    scheduled_end: m.scheduled_end,
    date_start: m.date_start,
    date_end: m.date_end,
    check_in: m.check_in,
    check_out: m.check_out,
  };
}

export function useMyMissions() {
  const [missions, setMissions] = useState<MyMission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [staffId, setStaffId]   = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    const id = await getCurrentStaffId();
    if (!mountedRef.current) return;
    setStaffId(id);

    if (!id) { setMissions([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from('missions')
      .select(SELECT_COLS)
      .eq('staff_id', id)
      .neq('mission_status', 'cancelled')
      .order('scheduled_start', { ascending: true, nullsFirst: false });

    if (!mountedRef.current) return;
    if (error) {
      console.warn('[useMyMissions]', error.message);
      setMissions([]);
    } else {
      setMissions((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime — replanification / annulation de dernière minute
  useEffect(() => {
    if (!staffId) return;
    const channel = supabase
      .channel(`my_missions_${staffId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'missions', filter: `staff_id=eq.${staffId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staffId, load]);

  const checkIn = useCallback(async (missionId: string) => {
    const { error } = await supabase
      .from('missions')
      .update({ check_in: new Date().toISOString(), mission_status: 'in_progress' })
      .eq('id', missionId);
    if (!error) await load();
    return !error;
  }, [load]);

  const checkOut = useCallback(async (missionId: string) => {
    const { error } = await supabase
      .from('missions')
      .update({ check_out: new Date().toISOString(), mission_status: 'completed' })
      .eq('id', missionId);
    if (!error) await load();
    return !error;
  }, [load]);

  const todayMissions = missions.filter(isToday);

  return { missions, todayMissions, loading, staffId, refresh: load, checkIn, checkOut };
}
