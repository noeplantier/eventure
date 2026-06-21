/**
 * app/(organizer)/missions.tsx — EVENTURE v3
 * Ultra-sophisticated mission management with real-time status,
 * payment tracking, timeline view, check-in/out actions, financial summary.
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, RefreshControl, SectionList, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }          from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons }                from '@expo/vector-icons';
import { useRouter }               from 'expo-router';
import { useSafeAreaInsets }       from 'react-native-safe-area-context';
import { supabase }                from '../../lib/supabase';
import { getWorkingOrganizerId }   from '../../lib/mockUser';
import { useInteractiveBg } from '../../components/InteractiveBg';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const BG       = '#050E1B';
const BLUE     = '#1A9FE3';
const CYAN     = '#1A9FE3';
const GOLD     = '#FFFFFF';
const NAVY     = '#0C1A30';
const WHITE    = '#FFFFFF';
const MUTED    = 'rgba(255,255,255,0.55)';
const FAINT    = 'rgba(255,255,255,0.08)';
const RED      = 'rgba(255,255,255,0.45)';
const GREEN_OK = '#1A9FE3';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type MissionStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

type FilterTab = MissionStatus | 'all';

interface EventRow {
  id: string;
  title: string;
  type: string | null;
  date_start: string;
}

interface Mission {
  id: string;
  application_id: string | null;
  event_id: string;
  staff_id: string;
  role: string;
  date_start: string;
  date_end: string;
  status: MissionStatus;
  hourly_rate: number;
  hours_worked: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  notes: string | null;
  // merged
  event?: EventRow;
  staff_name?: string;
}

interface Section {
  eventId: string;
  event: EventRow | undefined;
  data: Mission[];
}

/* ─── Status config ──────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<MissionStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending    : { label: 'En attente',  color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.07)', icon: 'time-outline' },
  confirmed  : { label: 'Confirmée',   color: '#1A9FE3',                bg: 'rgba(26,159,227,0.15)',  icon: 'checkmark-circle-outline' },
  in_progress: { label: 'En cours',    color: '#FFFFFF',                bg: 'rgba(26,159,227,0.20)',  icon: 'flash-outline' },
  completed  : { label: 'Terminée',    color: 'rgba(255,255,255,0.70)', bg: 'rgba(26,159,227,0.10)',  icon: 'checkmark-done-outline' },
  cancelled  : { label: 'Annulée',     color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.05)', icon: 'close-circle-outline' },
};

/* ─── Event type colors ──────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  Gala: GOLD, Festival: BLUE, 'Conférence': CYAN,
  Mariage: BLUE, 'Séminaire': '#1A9FE3', 'Soirée': GOLD,
  Concert: RED, Sport: BLUE,
};
const typeColor = (t: string | null | undefined) => TYPE_COLOR[t ?? ''] ?? BLUE;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
    : '—';

const fmtTime = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : '—';

const fmtMoney = (n: number | null | undefined) =>
  n != null ? `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €` : '—';

/* ─── Particle background ────────────────────────────────────────────────── */
/* ─── Enhanced particles ─── */
const _NUM_P = 32;
const _PCOLS = [
  '#1A9FE3','rgba(26,159,227,0.55)','#1A9FE3','rgba(26,159,227,0.40)',
  'rgba(255,255,255,0.28)','rgba(255,255,255,0.16)','rgba(26,159,227,0.22)',
];
const _PARTS = Array.from({ length: _NUM_P }, (_, i) => ({
  x:   (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
  y:   (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
  sz:  i % 9 === 0 ? 4.5 : i % 5 === 0 ? 3 : i % 3 === 0 ? 2.2 : 1.6,
  col: _PCOLS[i % _PCOLS.length],
  dur: 2400 + (i % 7) * 600,
  del: (i % 9) * 220,
  glow: i % 7 === 0,
}));
function ParticleBg() {
  const anims = React.useRef(_PARTS.map(() => new Animated.Value(0))).current;
  React.useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(_PARTS[i].del),
        Animated.timing(anim, { toValue: 1, duration: _PARTS[i].dur / 2, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: _PARTS[i].dur / 2, useNativeDriver: true }),
      ]))
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#050E1B','#091628','#05112A','#050E1B']} locations={[0,0.3,0.7,1]} style={StyleSheet.absoluteFill}/>
      <View style={{position:'absolute',top:'6%',left:'-25%',right:'-25%',height:'50%',backgroundColor:'rgba(26,159,227,0.035)',borderRadius:999}}/>
      {_PARTS.map((p, i) => {
        const opacity = anims[i].interpolate({ inputRange:[0,1], outputRange:[0.10, p.glow ? 0.80 : 0.52] });
        const scale   = anims[i].interpolate({ inputRange:[0,1], outputRange:[0.6, 1.4] });
        return (
          <Animated.View key={i} style={{
            position:'absolute', left:`${p.x}%` as any, top:`${p.y}%` as any,
            width:p.sz, height:p.sz, borderRadius:p.sz/2, backgroundColor:p.col,
            opacity, transform:[{scale}],
          }}/>
        );
      })}
    </View>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: WHITE, fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

/* ─── Payment progress bar ───────────────────────────────────────────────── */
function PayBar({ paid, due }: { paid: number; due: number }) {
  const pct = due > 0 ? Math.min(paid / due, 1) : 0;
  return (
    <View style={{ height: 4, backgroundColor: FAINT, borderRadius: 2, overflow: 'hidden' }}>
      <View style={{
        width: `${pct * 100}%` as any, height: '100%',
        backgroundColor: pct >= 1 ? GREEN_OK : BLUE, borderRadius: 2,
      }} />
    </View>
  );
}

/* ─── Pulsing active dot ─────────────────────────────────────────────────── */
function PulseDot({ color = BLUE }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.6, duration: 700, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10,
        borderRadius: 5, backgroundColor: `${color}40`, transform: [{ scale }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
function Skeleton() {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.7, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  const B = ({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: FAINT, opacity: op }} />
  );
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ backgroundColor: NAVY, borderRadius: 20, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Animated.View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: FAINT, opacity: op }} />
            <View style={{ flex: 1, gap: 8 }}>
              <B w="60%" h={13} />
              <B w="40%" h={10} />
            </View>
            <B w={70} h={24} r={12} />
          </View>
          <B w="100%" h={4} r={2} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <B w="45%" h={10} />
            <B w="35%" h={10} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <B w="30%" h={32} r={12} />
            <B w="30%" h={32} r={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Mission Card ───────────────────────────────────────────────────────── */
interface MissionCardProps {
  mission: Mission;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string, checkInTime: string, hourlyRate: number) => void;
  onPay: (id: string, amountDue: number) => void;
}

function MissionCard({ mission: m, onCheckIn, onCheckOut, onPay }: MissionCardProps) {
  const cfg       = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
  const staffName = m.staff_name ?? 'Staff inconnu';
  const paid      = m.amount_paid ?? 0;
  const due       = m.amount_due  ?? 0;
  const paidPct   = due > 0 ? Math.min(paid / due, 1) : 0;

  return (
    <View style={[styles.missionCard, { borderColor: `${cfg.color}25` }]}>
      <LinearGradient
        colors={[`${cfg.color}08`, 'transparent']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top row: avatar + name/role + status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={staffName} size={38} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={1}>
            {staffName}
          </Text>
          <View style={{
            alignSelf: 'flex-start', backgroundColor: `${BLUE}18`,
            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
          }}>
            <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700' }}>{m.role || '—'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30`, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
          <Ionicons name={cfg.icon as any} size={10} color={cfg.color}/>
          <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '800' }}>{cfg.label}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: FAINT }} />

      {/* Timeline row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Ionicons name="time-outline" size={12} color={MUTED}/>
        <Text style={{ color: MUTED, fontSize: 12 }}>
          {fmtDate(m.date_start)}
        </Text>
        <Text style={{ color: MUTED, fontSize: 12 }}>
          {fmtTime(m.date_start)}
        </Text>
        <Ionicons name="arrow-forward-outline" size={10} color={MUTED}/>
        <Text style={{ color: MUTED, fontSize: 12 }}>
          {fmtTime(m.date_end)}
        </Text>
      </View>

      {/* Check-in / check-out times if available */}
      {(m.check_in_time || m.check_out_time) ? (
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          {m.check_in_time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="log-in-outline" size={12} color={BLUE}/>
              <Text style={{ color: BLUE, fontSize: 11 }}>Arrivée</Text>
              <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700' }}>{fmtTime(m.check_in_time)}</Text>
            </View>
          ) : null}
          {m.check_out_time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="log-out-outline" size={12} color={GOLD}/>
              <Text style={{ color: GOLD, fontSize: 11 }}>Départ</Text>
              <Text style={{ color: GOLD, fontSize: 11, fontWeight: '700' }}>{fmtTime(m.check_out_time)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Financials */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Ionicons name="cash-outline" size={12} color={MUTED}/>
          <Text style={{ color: MUTED, fontSize: 12 }}>
            {m.hours_worked != null ? m.hours_worked.toFixed(1) : '—'} h
            {' × '}
            {m.hourly_rate != null ? `${m.hourly_rate} €/h` : '—'}
            {' = '}
            <Text style={{ color: GOLD, fontWeight: '800' }}>{fmtMoney(due > 0 ? due : null)}</Text>
          </Text>
        </View>
        {due > 0 && (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: MUTED, fontSize: 11 }}>
                Payé : {fmtMoney(paid)} / {fmtMoney(due)}
              </Text>
              <Text style={{ color: paidPct >= 1 ? GREEN_OK : BLUE, fontSize: 11, fontWeight: '700' }}>
                {Math.round(paidPct * 100)} %
              </Text>
            </View>
            <PayBar paid={paid} due={due} />
          </View>
        )}
      </View>

      {/* Action buttons */}
      {(m.status === 'confirmed' || m.status === 'in_progress' ||
        (m.status === 'completed' && paid < due)) ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {m.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(26,159,227,0.15)', borderColor: `${BLUE}40`, flexDirection: 'row', alignItems: 'center', gap: 5 }]}
              onPress={() => onCheckIn(m.id)}
              activeOpacity={0.78}
            >
              <Ionicons name="log-in-outline" size={13} color={BLUE}/>
              <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800' }}>Check-in</Text>
            </TouchableOpacity>
          )}
          {m.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(26,159,227,0.12)', borderColor: `${GOLD}40`, flexDirection: 'row', alignItems: 'center', gap: 5 }]}
              onPress={() => onCheckOut(m.id, m.check_in_time ?? new Date().toISOString(), m.hourly_rate)}
              activeOpacity={0.78}
            >
              <Ionicons name="log-out-outline" size={13} color={GOLD}/>
              <Text style={{ color: GOLD, fontSize: 12, fontWeight: '800' }}>Check-out</Text>
            </TouchableOpacity>
          )}
          {m.status === 'completed' && paid < due && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(26,159,227,0.15)', borderColor: `${BLUE}40`, flexDirection: 'row', alignItems: 'center', gap: 5 }]}
              onPress={() => onPay(m.id, due)}
              activeOpacity={0.78}
            >
              <Ionicons name="card-outline" size={13} color={BLUE}/>
              <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800' }}>Marquer payé</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Card border overlay */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: `${cfg.color}25`,
      }} />
    </View>
  );
}

/* ─── Section Header ─────────────────────────────────────────────────────── */
function EventSectionHeader({ event }: { event: EventRow | undefined }) {
  if (!event) return null;
  const tc = typeColor(event.type);
  return (
    <View style={styles.sectionHeader}>
      <LinearGradient
        colors={[`${tc}10`, 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
          {fmtDate(event.date_start)}
        </Text>
      </View>
      {event.type ? (
        <View style={{
          backgroundColor: `${tc}18`, borderRadius: 8, paddingHorizontal: 10,
          paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: `${tc}35`,
        }}>
          <Text style={{ color: tc, fontSize: 11, fontWeight: '700' }}>{event.type}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ─── KPI Chip ───────────────────────────────────────────────────────────── */
interface KpiChipProps {
  icon: string;
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
}
function KpiChip({ icon, label, value, color, pulse }: KpiChipProps) {
  return (
    <View style={[styles.kpiChip, { borderColor: `${color}30` }]}>
      <LinearGradient colors={[`${color}14`, `${color}05`]} style={StyleSheet.absoluteFillObject} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        {pulse ? <PulseDot color={color} /> : null}
        <Ionicons name={icon as any} size={14} color={color}/>
      </View>
      <Text style={{ color, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: MUTED, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Filter tab type ────────────────────────────────────────────────────── */
interface TabDef { key: FilterTab; label: string }

const FILTER_TABS: TabDef[] = [
  { key: 'all',         label: 'Toutes'      },
  { key: 'in_progress', label: 'En cours'    },
  { key: 'confirmed',   label: 'Confirmées'  },
  { key: 'pending',     label: 'En attente'  },
  { key: 'completed',   label: 'Complétées'  },
  { key: 'cancelled',   label: 'Annulées'    },
];

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function MissionsScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeTab,   setActiveTab]   = useState<FilterTab>('all');

  /* ── Data fetching ─────────────────────────────────────────────────────── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const orgId = await getWorkingOrganizerId();
      if (!orgId) { setAllMissions([]); return; }

      const { data: events } = await supabase
        .from('events')
        .select('id,title,type,date_start')
        .eq('organizer_id', orgId);

      const eventIds = (events ?? []).map((e: any) => e.id as string);

      if (eventIds.length === 0) { setAllMissions([]); return; }

      const { data: missions, error } = await supabase
        .from('missions')
        .select('*, staff:staff_id(display_name)')
        .in('event_id', eventIds)
        .order('date_start', { ascending: true });

      if (error) throw error;

      const missionsFull: Mission[] = (missions ?? []).map((m: any) => ({
        id:             m.id,
        application_id: m.application_id ?? null,
        event_id:       m.event_id,
        staff_id:       m.staff_id,
        role:           m.role ?? '',
        date_start:     m.date_start,
        date_end:       m.date_end,
        status:         (m.status ?? 'pending') as MissionStatus,
        hourly_rate:    m.hourly_rate ?? 0,
        hours_worked:   m.hours_worked ?? null,
        amount_due:     m.amount_due ?? null,
        amount_paid:    m.amount_paid ?? null,
        check_in_time:  m.check_in_time ?? null,
        check_out_time: m.check_out_time ?? null,
        notes:          m.notes ?? null,
        event:          (events ?? []).find((e: any) => e.id === m.event_id) as EventRow | undefined,
        staff_name:     m.staff?.display_name ?? 'Staff inconnu',
      }));

      setAllMissions(missionsFull);
    } catch (err) {
      console.error('[missions] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Real-time subscription ────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    const channel = supabase
      .channel(`missions_realtime_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => {
        if (mounted) load(true);
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [load]);

  /* ── Actions ───────────────────────────────────────────────────────────── */
  const handleCheckIn = useCallback(async (missionId: string) => {
    const now = new Date().toISOString();
    setAllMissions(prev =>
      prev.map(m => m.id === missionId
        ? { ...m, status: 'in_progress' as MissionStatus, check_in_time: now }
        : m
      )
    );
    try {
      await supabase
        .from('missions')
        .update({ status: 'in_progress', check_in_time: now })
        .eq('id', missionId);
    } catch (err) {
      console.error('[missions] check-in error:', err);
    }
  }, []);

  const handleCheckOut = useCallback(async (
    missionId: string,
    checkInTime: string,
    hourlyRate: number,
  ) => {
    const now         = new Date().toISOString();
    const hoursWorked = (new Date(now).getTime() - new Date(checkInTime).getTime()) / 3_600_000;
    const amountDue   = Math.round(hoursWorked * hourlyRate * 100) / 100;
    setAllMissions(prev =>
      prev.map(m => m.id === missionId
        ? {
            ...m,
            status:         'completed' as MissionStatus,
            check_out_time: now,
            hours_worked:   hoursWorked,
            amount_due:     amountDue,
          }
        : m
      )
    );
    try {
      await supabase
        .from('missions')
        .update({ status: 'completed', check_out_time: now, hours_worked: hoursWorked, amount_due: amountDue })
        .eq('id', missionId);
    } catch (err) {
      console.error('[missions] check-out error:', err);
    }
  }, []);

  const handlePay = useCallback(async (missionId: string, amountDue: number) => {
    setAllMissions(prev =>
      prev.map(m => m.id === missionId ? { ...m, amount_paid: amountDue } : m)
    );
    try {
      await supabase
        .from('missions')
        .update({ amount_paid: amountDue })
        .eq('id', missionId);
    } catch (err) {
      console.error('[missions] pay error:', err);
    }
  }, []);

  /* ── Derived data ──────────────────────────────────────────────────────── */
  const filtered = useMemo<Mission[]>(() => {
    if (activeTab === 'all') return allMissions;
    return allMissions.filter(m => m.status === activeTab);
  }, [allMissions, activeTab]);

  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, Mission[]>();
    for (const m of filtered) {
      if (!map.has(m.event_id)) map.set(m.event_id, []);
      map.get(m.event_id)!.push(m);
    }
    return Array.from(map.entries()).map(([eventId, data]) => ({
      eventId,
      event: data[0]?.event,
      data,
    }));
  }, [filtered]);

  const kpis = useMemo(() => {
    const active      = allMissions.filter(m => m.status === 'in_progress' || m.status === 'confirmed').length;
    const completed   = allMissions.filter(m => m.status === 'completed').length;
    const unpaidTotal = allMissions.reduce((sum, m) => {
      const due  = m.amount_due  ?? 0;
      const paid = m.amount_paid ?? 0;
      return sum + Math.max(due - paid, 0);
    }, 0);
    return { active, completed, unpaidTotal };
  }, [allMissions]);

  const tabCounts = useMemo<Record<FilterTab, number>>(() => {
    const counts: Record<FilterTab, number> = {
      all: allMissions.length,
      pending:     0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0,
    };
    for (const m of allMissions) {
      counts[m.status] = (counts[m.status] ?? 0) + 1;
    }
    return counts;
  }, [allMissions]);

  /* ── Render helpers ────────────────────────────────────────────────────── */
  const renderItem = useCallback(({ item }: { item: Mission }) => (
    <MissionCard
      mission={item}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onPay={handlePay}
    />
  ), [handleCheckIn, handleCheckOut, handlePay]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <EventSectionHeader event={section.event} />
  ), []);

  const keyExtractor = useCallback((item: Mission) => item.id, []);

  /* ── Header ────────────────────────────────────────────────────────────── */
  const ListHeader = useMemo(() => (
    <>
      {/* Page title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600' }}>Gestion des</Text>
          <Text style={{ color: WHITE, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 }}>Missions</Text>
        </View>
        <TouchableOpacity
          style={{
            width: 40, height: 40, borderRadius: 13,
            backgroundColor: FAINT, borderWidth: StyleSheet.hairlineWidth,
            borderColor: `${BLUE}25`, alignItems: 'center', justifyContent: 'center',
          }}
          onPress={() => router.push('/(organizer)/applications' as any)}
          activeOpacity={0.78}
        >
          <Ionicons name="document-text-outline" size={18} color={BLUE}/>
        </TouchableOpacity>
      </View>

      {/* KPI chips */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <KpiChip
          icon="cash-outline"
          label="À payer"
          value={kpis.unpaidTotal > 0 ? `${Math.round(kpis.unpaidTotal)} €` : '—'}
          color={GOLD}
        />
        <KpiChip
          icon="flash-outline"
          label="Actives"
          value={String(kpis.active)}
          color={BLUE}
          pulse={kpis.active > 0}
        />
        <KpiChip
          icon="checkmark-circle-outline"
          label="Complétées"
          value={String(kpis.completed)}
          color={GREEN_OK}
        />
      </View>

      {/* Filter tabs — horizontal scroll via ScrollView inside a fixed-height View */}
      <View style={{ marginBottom: 16 }}>
        <FilterTabsRow
          tabs={FILTER_TABS}
          activeTab={activeTab}
          tabCounts={tabCounts}
          onPress={setActiveTab}
        />
      </View>

      {/* Skeleton while loading */}
      {loading && <Skeleton />}
    </>
  ), [kpis, activeTab, tabCounts, loading, router]);

  /* ── Empty state ───────────────────────────────────────────────────────── */
  const ListEmpty = useMemo(() => {
    if (loading) return null;
    return (
      <View style={{ alignItems: 'center', paddingTop: 60, gap: 14 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(26,159,227,0.12)',
          alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${BLUE}30`,
        }}>
          <Ionicons name="flash-outline" size={36} color={BLUE}/>
        </View>
        <Text style={{ color: WHITE, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 }}>
          Aucune mission
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          {activeTab === 'all'
            ? 'Créez un événement et affectez du staff\npour générer vos premières missions.'
            : 'Aucune mission ne correspond à ce filtre.'}
        </Text>
        {activeTab === 'all' && (
          <TouchableOpacity
            style={{
              paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
              backgroundColor: BLUE, shadowColor: BLUE,
              shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
            }}
            onPress={() => router.push('/(organizer)/create-event' as any)}
            activeOpacity={0.82}
          >
            <Text style={{ color: BG, fontWeight: '800', fontSize: 13 }}>+ Créer un événement</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loading, activeTab, router]);

  /* ── Main render ───────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <ParticleBg />

      <SectionList<Mission, Section>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 16,
        }}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={BLUE}
          />
        }
        showsVerticalScrollIndicator={false}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

/* ─── Filter tabs row (extracted to avoid hook-in-callback issues) ────────── */
interface FilterTabsRowProps {
  tabs: TabDef[];
  activeTab: FilterTab;
  tabCounts: Record<FilterTab, number>;
  onPress: (k: FilterTab) => void;
}
function FilterTabsRow({ tabs, activeTab, tabCounts, onPress }: FilterTabsRowProps) {
  return (
    <SectionList<TabDef, { data: TabDef[] }>
      horizontal
      sections={[{ data: tabs }]}
      keyExtractor={item => item.key}
      renderItem={({ item: tab }) => {
        const isActive = activeTab === tab.key;
        const count    = tabCounts[tab.key];
        return (
          <TouchableOpacity
            style={[
              styles.filterTab,
              isActive
                ? { backgroundColor: 'rgba(26,159,227,0.14)', borderColor: `${BLUE}60` }
                : { backgroundColor: FAINT, borderColor: 'transparent' },
            ]}
            onPress={() => onPress(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterTabText, isActive && { color: BLUE, fontWeight: '800' }]}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={{
                backgroundColor: isActive ? `${BLUE}25` : `${MUTED}30`,
                borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4,
              }}>
                <Text style={{ color: isActive ? BLUE : MUTED, fontSize: 10, fontWeight: '700' }}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
      renderSectionHeader={() => null}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, gap: 8, paddingBottom: 2 }}
    />
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  missionCard: {
    backgroundColor: NAVY,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${NAVY}CC`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    marginTop: 8,
    gap: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FAINT,
  },
  kpiChip: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterTabText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
});
