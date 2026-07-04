/**
 * app/(organizer)/dashboard.tsx — EVENTURE v4
 * Design system : Aura (dark, futuristic, professionnel — halos interactifs)
 * Sections : Stats · Candidatures urgentes · Événements · Missions du jour · Échéances
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image,
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import { AURA } from '@/constants/aura-theme';
import Aura from '@/components/Aura';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG      = AURA.bg;
const PRIMARY = AURA.primary;
const P_GHOST = AURA.primaryGhost;
const PURPLE  = AURA.secondary;
const CYAN    = AURA.cyan;
const SUCCESS = AURA.success;
const WARNING = AURA.warning;
const DANGER  = AURA.danger;
const EDGE    = 16;

const C = {
  text:      AURA.text,
  textSub:   AURA.textSub,
  textMuted: AURA.textMuted,
  border:    AURA.border,
  surface:   AURA.surface,
  surfaceAlt:AURA.surfaceAlt,
} as const;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface OrgProfile { display_name: string; company_name: string | null; avatar_url: string | null; }
interface DashEvent  { id: string; title: string; date_start: string; location: string; status: string; type: string | null; }
interface AppCard    { id: string; staff_name: string; staff_avatar: string | null; role: string; event_title: string; applied_at: string; }
interface MissionItem{ id: string; check_in: string | null; event_title: string; staff_name: string; staff_avatar: string | null; payment_status: string; }
interface Stats      { totalEvents: number; activeEvents: number; staffRecruited: number; activeMissions: number; urgentDeadlines: number; }

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: 'Actif',     color: SUCCESS, bg: AURA.successGhost },
  draft:     { label: 'Brouillon', color: WARNING, bg: AURA.warningGhost },
  done:      { label: 'Terminé',   color: C.textMuted, bg: C.surfaceAlt },
  cancelled: { label: 'Annulé',    color: DANGER,  bg: AURA.dangerGhost },
};
const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: WARNING, Conférence: CYAN,
  Mariage: '#F472B6', Séminaire: PURPLE, Concert: DANGER,
};

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
const StatCard = memo(({ icon, value, label, color, bg, trend }: {
  icon: string; value: number; label: string; color: string; bg: string; trend?: string;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    anim.setValue(0);
    const l = anim.addListener(({ value: v }) => setDisplay(String(Math.round(v))));
    Animated.timing(anim, { toValue: value, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(l);
  }, [value]);

  return (
    <Aura color={`${color}73`} radius={16} style={{ flex: 1 }}>
      <View style={st.card}>
        <View style={[st.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={color}/>
        </View>
        <Text style={[st.value, { color }]}>{display}</Text>
        <Text style={st.label}>{label}</Text>
        {trend ? <Text style={[st.trend, { color }]}>{trend}</Text> : null}
      </View>
    </Aura>
  );
});
const st = StyleSheet.create({
  card:    { backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 6,
             borderWidth: 1, borderColor: C.border },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  label:   { fontSize: 11, color: C.textSub, fontWeight: '500', lineHeight: 15 },
  trend:   { fontSize: 10, fontWeight: '700' },
});

/* ─── Status Badge ───────────────────────────────────────────────────────── */
const StatusBadge = memo(({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: cfg.bg }}>
      <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '700' }}>{cfg.label}</Text>
    </View>
  );
});

/* ─── Event Card (horizontal scroll) ────────────────────────────────────── */
const EventCard = memo(({ evt, onPress }: { evt: DashEvent; onPress: () => void }) => {
  const tc = TYPE_COLORS[evt.type ?? ''] ?? PRIMARY;
  const days = daysUntil(evt.date_start);
  const urgency = days <= 2 ? DANGER : days <= 7 ? WARNING : SUCCESS;
  return (
    <Aura color={`${tc}66`} radius={16} onPress={onPress} style={{ marginRight: 12 }}>
      <View style={ec.card}>
        <LinearGradient colors={[`${tc}22`, `${tc}05`]} style={StyleSheet.absoluteFill}/>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={[ec.typeIcon, { backgroundColor: `${tc}22` }]}>
            <Ionicons name="calendar-outline" size={16} color={tc}/>
          </View>
          <StatusBadge status={evt.status}/>
        </View>
        <Text style={ec.title} numberOfLines={2}>{evt.title}</Text>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="location-outline" size={11} color={C.textMuted}/>
            <Text style={ec.meta} numberOfLines={1}>{evt.location.split(',')[0]}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="time-outline" size={11} color={urgency}/>
            <Text style={[ec.meta, { color: urgency, fontWeight: '700' }]}>
              {days <= 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `J-${days}`}
            </Text>
          </View>
        </View>
      </View>
    </Aura>
  );
});
const ec = StyleSheet.create({
  card:    { width: 170, backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 10,
             borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  typeIcon:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },
  meta:    { fontSize: 11, color: C.textMuted, flex: 1 },
});

/* ─── Application Card ───────────────────────────────────────────────────── */
const AppCard = memo(({ app, onAccept, onReject }: {
  app: AppCard; onAccept: () => void; onReject: () => void;
}) => {
  const [imgErr, setImgErr] = useState(false);
  const daysAgo = Math.ceil((Date.now() - new Date(app.applied_at).getTime()) / 86400000);
  const urgent = daysAgo >= 3;
  const init = app.staff_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={ac.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {app.staff_avatar && !imgErr
          ? <Image source={{ uri: app.staff_avatar }} style={ac.avatar} onError={() => setImgErr(true)}/>
          : <View style={[ac.avatar, ac.avatarFb]}><Text style={ac.init}>{init}</Text></View>
        }
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={ac.name} numberOfLines={1}>{app.staff_name}</Text>
            {urgent && (
              <View style={ac.urgentBadge}>
                <Text style={ac.urgentTxt}>Urgent</Text>
              </View>
            )}
          </View>
          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '600' }}>{app.role}</Text>
          <Text style={{ color: C.textMuted, fontSize: 10 }} numberOfLines={1}>{app.event_title}</Text>
        </View>
        <Text style={{ color: C.textMuted, fontSize: 10 }}>{daysAgo}j</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Aura color={AURA.dangerGlow} radius={8} onPress={onReject} style={{ flex: 0 }}>
          <View style={[ac.btn, ac.btnDanger]}>
            <Ionicons name="close" size={14} color={DANGER}/>
            <Text style={[ac.btnTxt, { color: DANGER }]}>Refuser</Text>
          </View>
        </Aura>
        <Aura color={AURA.successGlow} radius={8} onPress={onAccept} style={{ flex: 1 }}>
          <View style={[ac.btn, ac.btnSuccess]}>
            <Ionicons name="checkmark" size={14} color={SUCCESS}/>
            <Text style={[ac.btnTxt, { color: SUCCESS }]}>Accepter</Text>
          </View>
        </Aura>
      </View>
    </View>
  );
});
const ac = StyleSheet.create({
  card:       { backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 12,
                borderWidth: 1, borderColor: C.border },
  avatar:     { width: 44, height: 44, borderRadius: 22 },
  avatarFb:   { backgroundColor: P_GHOST, alignItems: 'center', justifyContent: 'center' },
  init:       { color: PRIMARY, fontSize: 16, fontWeight: '800' },
  name:       { fontSize: 14, fontWeight: '700', color: C.text },
  urgentBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: AURA.dangerGhost },
  urgentTxt:  { color: DANGER, fontSize: 9, fontWeight: '700' },
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: 10, borderWidth: 1 },
  btnDanger:  { borderColor: 'rgba(248,113,113,0.30)', backgroundColor: AURA.dangerGhost },
  btnSuccess: { borderColor: 'rgba(52,211,153,0.30)', backgroundColor: AURA.successGhost },
  btnTxt:     { fontSize: 12, fontWeight: '700' },
});

/* ─── Mission Timeline Item ──────────────────────────────────────────────── */
const MissionItem = memo(({ m, isLast }: { m: MissionItem; isLast: boolean }) => {
  const [imgErr, setImgErr] = useState(false);
  const init = m.staff_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const payColor = m.payment_status === 'paid' ? SUCCESS : m.payment_status === 'pending' ? WARNING : C.textMuted;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {/* Timeline */}
      <View style={{ alignItems: 'center', width: 44 }}>
        <Text style={mi.time}>{fmtTime(m.check_in)}</Text>
        <View style={mi.dot}/>
        {!isLast && <View style={mi.line}/>}
      </View>
      {/* Content */}
      <View style={[mi.content, { marginBottom: isLast ? 0 : 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {m.staff_avatar && !imgErr
            ? <Image source={{ uri: m.staff_avatar }} style={mi.avatar} onError={() => setImgErr(true)}/>
            : <View style={[mi.avatar, mi.avatarFb]}><Text style={mi.init}>{init}</Text></View>
          }
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={mi.name} numberOfLines={1}>{m.staff_name}</Text>
            <Text style={mi.evtTitle} numberOfLines={1}>{m.event_title}</Text>
          </View>
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: `${payColor}22` }}>
            <Text style={{ color: payColor, fontSize: 9, fontWeight: '700' }}>
              {m.payment_status === 'paid' ? 'Payé' : m.payment_status === 'pending' ? 'En attente' : 'Partiel'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});
const mi = StyleSheet.create({
  time:     { fontSize: 10, fontWeight: '700', color: PRIMARY, textAlign: 'right', width: 44 },
  dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY, marginVertical: 4,
              borderWidth: 2, borderColor: P_GHOST },
  line:     { flex: 1, width: 2, backgroundColor: C.border, minHeight: 24 },
  content:  { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12 },
  avatar:   { width: 34, height: 34, borderRadius: 17 },
  avatarFb: { backgroundColor: P_GHOST, alignItems: 'center', justifyContent: 'center' },
  init:     { color: PRIMARY, fontSize: 12, fontWeight: '800' },
  name:     { fontSize: 13, fontWeight: '700', color: C.text },
  evtTitle: { fontSize: 11, color: C.textSub },
});

/* ─── Deadline Card ──────────────────────────────────────────────────────── */
const DeadlineCard = memo(({ evt }: { evt: DashEvent }) => {
  const days = daysUntil(evt.date_start);
  const { color, bg, label } = days <= 3
    ? { color: DANGER, bg: AURA.dangerGhost, label: `${days}j` }
    : days <= 7
    ? { color: WARNING, bg: AURA.warningGhost, label: `${days}j` }
    : { color: CYAN, bg: AURA.cyanGhost, label: `${days}j` };

  return (
    <View style={[dl.card, { borderLeftColor: color }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={dl.title} numberOfLines={1}>{evt.title}</Text>
        <Text style={dl.date}>{fmtDate(evt.date_start)} · {evt.location.split(',')[0]}</Text>
      </View>
      <View style={[dl.badge, { backgroundColor: bg }]}>
        <Text style={[dl.badgeTxt, { color }]}>{label}</Text>
      </View>
    </View>
  );
});
const dl = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface,
              borderRadius: 12, padding: 12, borderLeftWidth: 3,
              borderWidth: 1, borderColor: C.border },
  title:    { fontSize: 13, fontWeight: '700', color: C.text },
  date:     { fontSize: 11, color: C.textSub },
  badge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
});

/* ─── Section Header ─────────────────────────────────────────────────────── */
const SectionHeader = memo(({ title, count, onAll, allLabel = 'Tout voir' }: {
  title: string; count?: number; onAll?: () => void; allLabel?: string;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{title}</Text>
      {count != null && count > 0 && (
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: P_GHOST }}>
          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '800' }}>{count}</Text>
        </View>
      )}
    </View>
    {onAll && (
      <TouchableOpacity onPress={onAll} activeOpacity={0.7}>
        <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '700' }}>{allLabel} →</Text>
      </TouchableOpacity>
    )}
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
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const B = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: C.surfaceAlt, opacity: op }}/>
  );
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2, 3].map(i => <B key={i} w={(SW - EDGE * 2 - 30) / 4} h={90} r={16}/>)}
      </View>
      <B w="100%" h={14} r={8}/>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[0, 1].map(i => <B key={i} w={170} h={140} r={16}/>)}
      </View>
      <B w="100%" h={14} r={8}/>
      {[0, 1, 2].map(i => <B key={i} w="100%" h={80} r={14}/>)}
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const router = useRouter();

  const [org,        setOrg]        = useState<OrgProfile | null>(null);
  const [stats,      setStats]      = useState<Stats>({ totalEvents: 0, activeEvents: 0, staffRecruited: 0, activeMissions: 0, urgentDeadlines: 0 });
  const [events,     setEvents]     = useState<DashEvent[]>([]);
  const [pendingApps,setPendingApps]= useState<AppCard[]>([]);
  const [todayMissions,setTodayMissions] = useState<MissionItem[]>([]);
  const [deadlines,  setDeadlines]  = useState<DashEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const uid = await getCurrentOrganizerId();
      if (!uid) return;

      const [orgRes, eventsRes] = await Promise.all([
        supabase.from('organizers').select('display_name,company_name,avatar_url').eq('id', uid).maybeSingle(),
        supabase.from('events').select('id,title,date_start,location,status,type').eq('organizer_id', uid).order('date_start', { ascending: false }).limit(50),
      ]);

      if (orgRes.data) setOrg(orgRes.data as OrgProfile);

      const evts = (eventsRes.data ?? []) as DashEvent[];
      const now = new Date();

      // Events for display (upcoming published first, then recent)
      const upcoming = evts.filter(e => new Date(e.date_start) > now && e.status === 'published').slice(0, 6);
      const recent   = evts.filter(e => e.status !== 'cancelled').slice(0, 6);
      setEvents(upcoming.length > 0 ? upcoming : recent);

      // Upcoming deadlines (next 30 days)
      const soon = evts.filter(e => {
        const d = daysUntil(e.date_start);
        return d >= 0 && d <= 30 && e.status === 'published';
      }).sort((a, b) => daysUntil(a.date_start) - daysUntil(b.date_start)).slice(0, 5);
      setDeadlines(soon);

      // Stats — active events
      const activeEvents = evts.filter(e => e.status === 'published').length;
      const urgentDeadlines = soon.filter(e => daysUntil(e.date_start) <= 7).length;

      // Pending applications + recruited count
      const evtIds = evts.map(e => e.id);
      if (evtIds.length > 0) {
        const [rolesRes, missionRes] = await Promise.all([
          supabase.from('event_roles').select('id,role,event_id').in('event_id', evtIds),
          supabase.from('missions').select('id,check_in,check_out,event_id,staff_id,payment_status').in('event_id', evtIds),
        ]);

        const roles    = (rolesRes.data ?? []) as any[];
        const missions = (missionRes.data ?? []) as any[];
        const roleIds  = roles.map(r => r.id);
        const roleMap  = Object.fromEntries(roles.map(r => [r.id, r]));
        const evtMap   = Object.fromEntries(evts.map(e => [e.id, e]));

        // Applications
        if (roleIds.length > 0) {
          const { data: apps } = await supabase
            .from('applications')
            .select('id,status,applied_at,event_role_id,staff_id')
            .in('event_role_id', roleIds)
            .order('applied_at', { ascending: false });

          const allApps = (apps ?? []) as any[];
          const recruitedCount = allApps.filter(a => a.status === 'accepted').length;

          // Fetch staff info for pending apps (limit 5)
          const pendingAppsRaw = allApps.filter(a => a.status === 'pending').slice(0, 5);
          if (pendingAppsRaw.length > 0) {
            const sids = [...new Set(pendingAppsRaw.map(a => a.staff_id).filter(Boolean))];
            const { data: staffRows } = sids.length
              ? await supabase.from('staff').select('id,display_name,avatar_url').in('id', sids)
              : { data: [] };
            const sm = Object.fromEntries((staffRows ?? []).map((s: any) => [s.id, s]));
            setPendingApps(pendingAppsRaw.map(a => {
              const s = sm[a.staff_id] ?? {};
              const r = roleMap[a.event_role_id] ?? {};
              const ev = evtMap[r.event_id] ?? {};
              return {
                id: a.id, staff_name: s.display_name ?? 'Staff', staff_avatar: s.avatar_url ?? null,
                role: r.role ?? '—', event_title: ev.title ?? '—', applied_at: a.applied_at,
              };
            }));
          } else {
            setPendingApps([]);
          }

          // Today's missions
          const todayStr = now.toISOString().slice(0, 10);
          const todayM = missions.filter(m => m.check_in?.startsWith(todayStr)).slice(0, 5);
          if (todayM.length > 0) {
            const staffIds = [...new Set(todayM.map(m => m.staff_id).filter(Boolean))];
            const { data: staffMission } = staffIds.length
              ? await supabase.from('staff').select('id,display_name,avatar_url').in('id', staffIds)
              : { data: [] };
            const sm2 = Object.fromEntries((staffMission ?? []).map((s: any) => [s.id, s]));
            setTodayMissions(todayM.map(m => {
              const s = sm2[m.staff_id] ?? {};
              const ev = evtMap[m.event_id] ?? {};
              return {
                id: m.id, check_in: m.check_in, event_title: ev.title ?? '—',
                staff_name: s.display_name ?? 'Staff', staff_avatar: s.avatar_url ?? null,
                payment_status: m.payment_status ?? 'pending',
              };
            }));
          } else {
            setTodayMissions([]);
          }

          // Active missions (check_in set, check_out null)
          const activeMissions = missions.filter(m => m.check_in && !m.check_out).length;

          setStats({ totalEvents: evts.length, activeEvents, staffRecruited: recruitedCount, activeMissions, urgentDeadlines });
        } else {
          setStats({ totalEvents: evts.length, activeEvents, staffRecruited: 0, activeMissions: 0, urgentDeadlines });
          setPendingApps([]);
          setTodayMissions([]);
        }
      } else {
        setStats({ totalEvents: 0, activeEvents: 0, staffRecruited: 0, activeMissions: 0, urgentDeadlines: 0 });
      }
    } catch (e) {
      console.error('[dashboard v4]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, []);

  // Realtime
  useEffect(() => {
    let alive = true;
    const ch = supabase.channel(`dash4_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { if (alive) fetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => { if (alive) fetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => { if (alive) fetch(); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [fetch]);

  const handleAccept = useCallback(async (appId: string) => {
    await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
    fetch();
  }, [fetch]);

  const handleReject = useCallback(async (appId: string) => {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId);
    fetch();
  }, [fetch]);

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const fname = (org?.display_name ?? '').split(' ')[0];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={ds.header}>
          <View style={{ flex: 1 }}>
            <Text style={ds.greet}>{greet}{fname ? `, ${fname}` : ''} 👋</Text>
            <Text style={ds.dateStr} numberOfLines={1}>{today}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Aura color={AURA.primaryGlow} radius={12} onPress={() => router.push('/(shared)/notifications' as any)}>
              <View style={ds.iconBtn}>
                <Ionicons name="notifications-outline" size={20} color={C.text}/>
                {pendingApps.length > 0 && <View style={ds.notifDot}/>}
              </View>
            </Aura>
            <Aura color={AURA.primaryGlow} radius={12} onPress={() => router.push('/(organizer)/create-event' as any)}>
              <View style={ds.createBtn}>
                <Ionicons name="add" size={18} color="#FFFFFF"/>
                <Text style={ds.createTxt}>Créer</Text>
              </View>
            </Aura>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: EDGE, gap: 24, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={PRIMARY}/>}
        >
          {loading ? <Skeleton/> : (<>

            {/* ── STATS ── */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard icon="calendar-outline" value={stats.activeEvents} label="Événements actifs"  color={PRIMARY}  bg={P_GHOST}/>
                <StatCard icon="people-outline"   value={stats.staffRecruited} label="Staffs recrutés" color={PURPLE}   bg={AURA.secondaryGhost}/>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard icon="clipboard-outline" value={stats.activeMissions} label="Missions en cours" color={SUCCESS} bg={AURA.successGhost}/>
                <StatCard
                  icon="warning-outline"
                  value={stats.urgentDeadlines}
                  label="Échéances urgentes"
                  color={stats.urgentDeadlines > 0 ? DANGER : C.textMuted}
                  bg={stats.urgentDeadlines > 0 ? AURA.dangerGhost : C.surfaceAlt}
                  trend={stats.urgentDeadlines > 0 ? '< 7 jours' : undefined}
                />
              </View>
            </View>

            {/* ── CANDIDATURES EN ATTENTE ── */}
            {pendingApps.length > 0 && (
              <View>
                <SectionHeader
                  title="Candidatures en attente"
                  count={pendingApps.length}
                  onAll={() => router.push('/(organizer)/applications' as any)}
                />
                <View style={{ gap: 10 }}>
                  {pendingApps.map(app => (
                    <AppCard
                      key={app.id}
                      app={app}
                      onAccept={() => handleAccept(app.id)}
                      onReject={() => handleReject(app.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ── ÉVÉNEMENTS RÉCENTS ── */}
            {events.length > 0 && (
              <View>
                <SectionHeader
                  title="Événements"
                  count={stats.totalEvents}
                  onAll={() => router.push('/(organizer)/events' as any)}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                  {events.map(evt => (
                    <EventCard
                      key={evt.id}
                      evt={evt}
                      onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: evt.id } } as any)}
                    />
                  ))}
                  <Aura color={AURA.primaryGlow} radius={16} onPress={() => router.push('/(organizer)/events' as any)}>
                    <View style={[ec.card, { justifyContent: 'center', alignItems: 'center', width: 140 }]}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P_GHOST, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Ionicons name="arrow-forward" size={18} color={PRIMARY}/>
                      </View>
                      <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Voir tous</Text>
                    </View>
                  </Aura>
                </ScrollView>
              </View>
            )}

            {/* ── MISSIONS DU JOUR ── */}
            {todayMissions.length > 0 && (
              <View>
                <SectionHeader
                  title="Missions du jour"
                  count={todayMissions.length}
                  onAll={() => router.push('/(organizer)/missions' as any)}
                />
                <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
                  {todayMissions.map((m, i) => (
                    <MissionItem key={m.id} m={m} isLast={i === todayMissions.length - 1}/>
                  ))}
                </View>
              </View>
            )}

            {/* ── ÉCHÉANCES À VENIR ── */}
            {deadlines.length > 0 && (
              <View>
                <SectionHeader title="Échéances à venir" count={stats.urgentDeadlines}/>
                <View style={{ gap: 8 }}>
                  {deadlines.map(evt => <DeadlineCard key={evt.id} evt={evt}/>)}
                </View>
              </View>
            )}

            {/* ── EMPTY STATE ── */}
            {stats.totalEvents === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 52, gap: 16 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: P_GHOST, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="rocket-outline" size={38} color={PRIMARY}/>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' }}>
                  Lancez votre premier{'\n'}événement
                </Text>
                <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 }}>
                  Créez un événement, publiez-le{'\n'}et recrutez votre équipe en 5 minutes.
                </Text>
                <Aura color={AURA.primaryGlow} radius={12} onPress={() => router.push('/(organizer)/create-event' as any)}>
                  <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>+ Créer un événement</Text>
                  </View>
                </Aura>
              </View>
            )}

          </>)}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ds = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: EDGE, paddingVertical: 12, paddingBottom: 8 },
  greet:     { fontSize: 18, fontWeight: '800', color: C.text },
  dateStr:   { fontSize: 12, color: C.textSub, marginTop: 2, textTransform: 'capitalize' },
  iconBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
               borderWidth: 1, borderColor: C.border, position: 'relative' },
  notifDot:  { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER,
               borderWidth: 1.5, borderColor: BG },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 10,
               borderRadius: 12 },
  createTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
