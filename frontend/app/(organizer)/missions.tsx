/**
 * app/(organizer)/missions.tsx — EVENTURE v3
 * Timeline missions par date · Indigo Light Theme
 * Schema: public.missions (identique v2)
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, FlatList, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const BG      = '#F8FAFC';
const PRIMARY = '#6366F1';
const P_LIGHT = '#EEF2FF';
const P_GHOST = 'rgba(99,102,241,0.08)';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER  = '#EF4444';
const GOLD    = '#F59E0B';
const BLUE    = '#3B82F6';
const EDGE    = 16;

const C = {
  text:      '#111827',
  textSub:   '#6B7280',
  textMuted: '#9CA3AF',
  border:    '#E5E7EB',
  surface:   '#FFFFFF',
  surfaceAlt:'#F1F5F9',
} as const;

/* ─── Types ──────────────────────────────────────────────────────────────── */
type PayStatus = 'pending' | 'paid' | 'partial' | 'cancelled';

interface Mission {
  id:             string;
  application_id: string | null;
  staff_id:       string | null;
  event_id:       string | null;
  check_in:       string | null;
  check_out:      string | null;
  hours_worked:   number | null;
  amount_due:     number | null;
  amount_paid:    number | null;
  payment_status: PayStatus;
  stripe_transfer:string | null;
  created_at:     string;
  staff_name:     string;
  staff_avatar:   string | null;
  staff_role:     string[];
  event_title:    string;
  event_date:     string;
  event_location: string;
  event_type:     string | null;
}

/* ─── Pay config ─────────────────────────────────────────────────────────── */
const PAY: Record<PayStatus, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending  : { label: 'En attente', color: WARNING, bg: 'rgba(245,158,11,0.10)',  icon: 'time-outline' },
  paid     : { label: 'Payé',       color: SUCCESS, bg: 'rgba(16,185,129,0.10)',  icon: 'checkmark-circle-outline' },
  partial  : { label: 'Partiel',    color: BLUE,    bg: 'rgba(59,130,246,0.10)',  icon: 'ellipsis-horizontal-circle-outline' },
  cancelled: { label: 'Annulé',     color: DANGER,  bg: 'rgba(239,68,68,0.10)',   icon: 'close-circle-outline' },
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime  = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (n: number | null) => n != null ? `${Number(n).toLocaleString('fr-FR')}€` : '—';
const ymd      = (iso: string) => iso.slice(0, 10);

const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: GOLD, Conférence: BLUE,
  Mariage: '#EC4899', Séminaire: '#8B5CF6', Concert: DANGER, Sport: SUCCESS,
};

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
const KPICard = memo(({ icon, value, label, color, bg, suffix = '' }: {
  icon: string; value: number; label: string; color: string; bg: string; suffix?: string;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    anim.setValue(0);
    const l = anim.addListener(({ value: v }) => setDisplay(v.toFixed(suffix ? 1 : 0)));
    Animated.timing(anim, { toValue: value, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(l);
  }, [value]);
  return (
    <View style={[kc.card, { shadowColor: color }]}>
      <View style={[kc.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color}/>
      </View>
      <Text style={[kc.value, { color }]}>{display}{suffix}</Text>
      <Text style={kc.label}>{label}</Text>
    </View>
  );
});
const kc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, gap: 5, alignItems: 'flex-start',
             borderWidth: 1, borderColor: C.border,
             shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  iconWrap:{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  value:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label:   { fontSize: 10, color: C.textMuted, fontWeight: '500', lineHeight: 14 },
});

/* ─── Mission Card ───────────────────────────────────────────────────────── */
const MissionCard = memo(function MissionCard({
  m, index, onPress,
}: { m: Mission; index: number; onPress: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const pay       = PAY[m.payment_status] ?? PAY.pending;
  const tc        = TYPE_COLORS[m.event_type ?? ''] ?? PRIMARY;
  const init      = m.staff_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roles     = Array.isArray(m.staff_role) ? m.staff_role : [];
  const paidPct   = m.amount_due && m.amount_due > 0 && m.amount_paid != null ? Math.min(m.amount_paid / m.amount_due, 1) : 0;
  const durationStr = m.hours_worked != null ? `${Number(m.hours_worked).toFixed(1)}h`
    : (m.check_in && m.check_out)
    ? `${((new Date(m.check_out).getTime() - new Date(m.check_in).getTime()) / 3600000).toFixed(1)}h`
    : null;

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: press }],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        style={[mc.card, { borderLeftColor: pay.color }]}
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1,   useNativeDriver: true, tension: 300, friction: 10 }).start()}
        activeOpacity={1}
      >
        {/* Event row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[mc.evtIcon, { backgroundColor: `${tc}15` }]}>
            <Ionicons name="calendar-outline" size={12} color={tc}/>
          </View>
          <Text style={mc.evtTitle} numberOfLines={1}>{m.event_title}</Text>
          <View style={{ flex: 1 }}/>
          <View style={[mc.payChip, { backgroundColor: pay.bg }]}>
            <Ionicons name={pay.icon} size={9} color={pay.color}/>
            <Text style={[mc.payTxt, { color: pay.color }]}>{pay.label}</Text>
          </View>
        </View>

        {/* Staff row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {m.staff_avatar && !imgErr
            ? <Image source={{ uri: m.staff_avatar }} style={mc.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[mc.avatar, mc.avatarFb]}><Text style={mc.init}>{init}</Text></View>
          }
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={mc.staffName} numberOfLines={1}>{m.staff_name}</Text>
            {roles[0] && <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '600' }}>{roles[0]}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[mc.amount, { color: GOLD }]}>{fmtMoney(m.amount_due)}</Text>
            {m.amount_paid != null && m.amount_paid > 0 && (
              <Text style={{ color: SUCCESS, fontSize: 10, fontWeight: '700' }}>{fmtMoney(m.amount_paid)} payé</Text>
            )}
          </View>
        </View>

        {/* Hours row */}
        {(m.check_in || m.check_out || durationStr) && (
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {m.check_in && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="log-in-outline" size={12} color={C.textMuted}/>
                <Text style={{ color: C.textMuted, fontSize: 11 }}>{fmtTime(m.check_in)}</Text>
              </View>
            )}
            {m.check_out && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="log-out-outline" size={12} color={C.textMuted}/>
                <Text style={{ color: C.textMuted, fontSize: 11 }}>{fmtTime(m.check_out)}</Text>
              </View>
            )}
            {durationStr && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="timer-outline" size={12} color={PRIMARY}/>
                <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700' }}>{durationStr}</Text>
              </View>
            )}
          </View>
        )}

        {/* Payment bar */}
        {m.amount_due != null && m.amount_due > 0 && (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600' }}>Paiement</Text>
              <Text style={{ color: pay.color, fontSize: 10, fontWeight: '800' }}>{Math.round(paidPct * 100)}%</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
              <View style={{ width: `${paidPct * 100}%` as any, height: '100%', borderRadius: 2, backgroundColor: pay.color }}/>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});
const mc = StyleSheet.create({
  card:    { backgroundColor: C.surface, borderRadius: 12, padding: 14, paddingLeft: 16, gap: 10,
             borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, overflow: 'hidden',
             shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  evtIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  evtTitle:{ fontSize: 12, fontWeight: '700', color: C.textSub, flex: 1 },
  payChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  payTxt:  { fontSize: 10, fontWeight: '700' },
  avatar:  { width: 42, height: 42, borderRadius: 21, flexShrink: 0 },
  avatarFb:{ backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  init:    { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  staffName:{ fontSize: 14, fontWeight: '800', color: C.text },
  amount:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
});

/* ─── Timeline Section Header ────────────────────────────────────────────── */
const TimelineHeader = memo(({ dateStr, count }: { dateStr: string; count: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 6 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: C.border }}/>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: P_LIGHT }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: PRIMARY, textTransform: 'capitalize' }}>{dateStr}</Text>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{count}</Text>
      </View>
    </View>
    <View style={{ flex: 1, height: 1, backgroundColor: C.border }}/>
  </View>
));

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
const Skeleton = memo(() => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2, 3].map(i => <Animated.View key={i} style={{ flex: 1, height: 80, borderRadius: 12, backgroundColor: '#E5E7EB', opacity: op }}/>)}
      </View>
      {[0, 1, 2].map(i => <Animated.View key={i} style={{ height: 130, borderRadius: 12, backgroundColor: '#E5E7EB', opacity: op }}/>)}
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function MissionsScreen() {
  const router = useRouter();

  const [missions,    setMissions]   = useState<Mission[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [refreshing,  setRefreshing] = useState(false);
  const [tab,         setTab]        = useState<PayStatus | 'all'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMissions([]); return; }
      const uid = session.user.id;

      const { data: evts } = await supabase.from('events')
        .select('id,title,date_start,location,type,status')
        .eq('organizer_id', uid);
      if (!evts?.length) { setMissions([]); return; }

      const evtIds = evts.map((e: any) => e.id);
      const { data: raw, error } = await supabase.from('missions')
        .select('id,application_id,staff_id,event_id,check_in,check_out,hours_worked,amount_due,amount_paid,payment_status,stripe_transfer,created_at')
        .in('event_id', evtIds)
        .order('check_in', { ascending: false });

      if (error) throw error;
      if (!raw?.length) { setMissions([]); return; }

      const staffIds = [...new Set((raw as any[]).map((m: any) => m.staff_id).filter(Boolean))];
      const { data: staffRows } = staffIds.length
        ? await supabase.from('staff').select('id,display_name,avatar_url,role').in('id', staffIds)
        : { data: [] };

      const sm = Object.fromEntries((staffRows ?? []).map((s: any) => [s.id, s]));
      const em = Object.fromEntries(evts.map((e: any) => [e.id, e]));

      setMissions((raw as any[]).map(m => {
        const st = sm[m.staff_id] ?? {};
        const ev = em[m.event_id] ?? {};
        return {
          ...m,
          payment_status: (m.payment_status ?? 'pending') as PayStatus,
          staff_name:    st.display_name ?? 'Staff',
          staff_avatar:  st.avatar_url ?? null,
          staff_role:    st.role ?? [],
          event_title:   ev.title ?? '—',
          event_date:    ev.date_start ?? '',
          event_location:ev.location ?? '',
          event_type:    ev.type ?? null,
        };
      }));
    } catch (e) { console.error('[missions v3]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let alive = true;
    const ch = supabase.channel(`missions3_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => { if (alive) load(true); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() =>
    tab === 'all' ? missions : missions.filter(m => m.payment_status === tab),
    [missions, tab]);

  // Group by date for timeline
  const grouped = useMemo(() => {
    const map: Record<string, Mission[]> = {};
    filtered.forEach(m => {
      const key = m.check_in ? ymd(m.check_in) : ymd(m.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const kpis = useMemo(() => ({
    total:      missions.length,
    totalDue:   missions.reduce((s, m) => s + (m.amount_due ?? 0), 0),
    totalPaid:  missions.reduce((s, m) => s + (m.amount_paid ?? 0), 0),
    totalHours: missions.reduce((s, m) => s + (m.hours_worked ?? 0), 0),
    pending:    missions.filter(m => m.payment_status === 'pending').length,
    paid:       missions.filter(m => m.payment_status === 'paid').length,
  }), [missions]);

  const TABS: { key: PayStatus | 'all'; label: string; count: number }[] = [
    { key: 'all',     label: 'Toutes',    count: missions.length },
    { key: 'pending', label: 'En attente', count: kpis.pending },
    { key: 'paid',    label: 'Payées',    count: kpis.paid },
    { key: 'partial', label: 'Partielles', count: missions.filter(m => m.payment_status === 'partial').length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Missions</Text>
              <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{kpis.total} mission{kpis.total !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                       shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
              onPress={() => router.push('/(organizer)/create-event' as any)}
              activeOpacity={0.82}
            >
              <Ionicons name="add" size={16} color="#FFF"/>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Créer</Text>
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {TABS.map(({ key, label, count }) => (
              <TouchableOpacity
                key={key}
                style={[ts.chip, tab === key && ts.chipActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.75}
              >
                <Text style={[ts.chipTxt, tab === key && ts.chipTxtActive]}>{label}</Text>
                {count > 0 && (
                  <View style={[ts.badge, tab === key && ts.badgeActive]}>
                    <Text style={[ts.badgeTxt, tab === key && { color: PRIMARY }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, gap: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY}/>}
        >
          {loading ? <Skeleton/> : (<>

            {/* ── KPI STRIP ── */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <KPICard icon="briefcase-outline"  value={kpis.total}       label="Total"        color={PRIMARY}  bg={P_GHOST}/>
              <KPICard icon="time-outline"        value={kpis.pending}     label="En attente"   color={WARNING}  bg="rgba(245,158,11,0.08)"/>
              <KPICard icon="timer-outline"       value={kpis.totalHours} label="Heures"       color={BLUE}     bg="rgba(59,130,246,0.08)" suffix="h"/>
              <KPICard icon="checkmark-circle-outline" value={kpis.paid}  label="Payées"       color={SUCCESS}  bg="rgba(16,185,129,0.08)"/>
            </View>

            {/* ── FINANCE SUMMARY ── */}
            {kpis.total > 0 && (
              <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border, marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Finances</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {[
                    { label: 'Dû',      value: kpis.totalDue,              color: GOLD },
                    { label: 'Payé',    value: kpis.totalPaid,             color: SUCCESS },
                    { label: 'Restant', value: Math.max(kpis.totalDue - kpis.totalPaid, 0), color: WARNING },
                  ].map(({ label, value, color }) => (
                    <View key={label} style={{ alignItems: 'center', gap: 3 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color, letterSpacing: -0.5 }}>
                        {value.toLocaleString('fr-FR')}€
                      </Text>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
                    </View>
                  ))}
                </View>
                {kpis.totalDue > 0 && (
                  <View style={{ gap: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.textMuted, fontSize: 11 }}>Taux de paiement</Text>
                      <Text style={{ color: SUCCESS, fontWeight: '700', fontSize: 11 }}>
                        {Math.round((kpis.totalPaid / kpis.totalDue) * 100)}%
                      </Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' }}>
                      <View style={{
                        width: `${Math.min((kpis.totalPaid / kpis.totalDue) * 100, 100)}%` as any,
                        height: '100%', borderRadius: 3, backgroundColor: SUCCESS,
                      }}/>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── TIMELINE ── */}
            {grouped.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 72, gap: 14 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="briefcase-outline" size={32} color={PRIMARY}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
                  {tab === 'all' ? 'Aucune mission' : `Aucune mission "${TABS.find(t => t.key === tab)?.label.toLowerCase()}"`}
                </Text>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {tab === 'all'
                    ? 'Créez un événement et publiez une mission.'
                    : 'Changez d\'onglet pour voir d\'autres missions.'}
                </Text>
                {tab === 'all' && (
                  <TouchableOpacity
                    style={{ backgroundColor: PRIMARY, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10,
                             shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    onPress={() => router.push('/(organizer)/create-event' as any)}
                    activeOpacity={0.82}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>+ Créer une mission</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              grouped.map(([date, mlist]) => (
                <View key={date}>
                  <TimelineHeader
                    dateStr={new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    count={mlist.length}
                  />
                  {mlist.map((m, i) => (
                    <MissionCard
                      key={m.id}
                      m={m}
                      index={i}
                      onPress={() => router.push({ pathname: '/(organizer)/mission/[id]', params: { id: m.id } } as any)}
                    />
                  ))}
                </View>
              ))
            )}

          </>)}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ts = StyleSheet.create({
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7,
                 borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:  { backgroundColor: P_LIGHT, borderColor: PRIMARY },
  chipTxt:     { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTxtActive:{ color: PRIMARY, fontWeight: '700' },
  badge:       { backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeActive: { backgroundColor: P_LIGHT },
  badgeTxt:    { fontSize: 10, fontWeight: '700', color: C.textMuted },
});
