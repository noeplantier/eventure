/**
 * app/(organizer)/missions.tsx — EVENTURE v3
 * Dark green theme — hardcoded design tokens.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useRouter }       from 'expo-router';
import { supabase }        from '@/lib/supabase';
import { getWorkingUid }   from '@/lib/mockUser';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG    = '#050E1B';
const GOLD  = '#F5C842';

const T = {
  white   : '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.18)',
  surf    : 'rgba(255,255,255,0.045)',
  surfHi  : 'rgba(255,255,255,0.09)',
  border  : 'rgba(26,159,227,0.12)',
  borderHi: 'rgba(26,159,227,0.30)',
  navy    : '#0C1A30',
  amber   : '#F59E0B',
  red     : '#EF4444',
  blue    : '#60A5FA',
  purple  : '#A78BFA',
} as const;

const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER  = '#EF4444';
const BLUE    = '#1A9FE3';
const EDGE    = 16;
/* ─── Payment status config ──────────────────────────────────────────────── */
type PayStatus = 'pending' | 'paid' | 'partial' | 'cancelled';

const PAY: Record<PayStatus, { l: string; c: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending  : { l: 'En attente', c: WARNING, icon: 'time-outline' },
  paid     : { l: 'Payé',       c: SUCCESS, icon: 'checkmark-circle-outline' },
  partial  : { l: 'Partiel',    c: BLUE,    icon: 'ellipsis-horizontal-circle-outline' },
  cancelled: { l: 'Annulé',     c: DANGER,  icon: 'close-circle-outline' },
};

/* ─── Event type colors ──────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  'Gala': GOLD, 'Festival': SUCCESS, 'Conférence': T.blue,
  'Mariage': '#F472B6', 'Séminaire': T.purple, 'Soirée': T.amber,
  'Concert': T.red, 'Sport': '#34D399',
};
const typeColor = (t: string | null) => TYPE_COLOR[t ?? ''] ?? T.muted;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Mission {
  id: string; application_id: string | null; staff_id: string | null; event_id: string | null;
  check_in: string | null; check_out: string | null; hours_worked: number | null;
  amount_due: number | null; amount_paid: number | null; payment_status: PayStatus;
  stripe_transfer: string | null; created_at: string;
  staff_name: string; staff_avatar: string | null; staff_role: string[];
  event_title: string; event_date: string; event_location: string; event_type: string | null;
  event_status: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtTime  = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (n: number | null) =>
  n != null ? `${Number(n).toLocaleString('fr-FR')}€` : '—';

/* ─── Particle background ────────────────────────────────────────────────── */
const PCOLS = ['#1A9FE3','rgba(26,159,227,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
const PTS   = Array.from({length:18},(_,i)=>({
  id:i, x:((Math.sin(i*2.399)+1)/2)*SW, y:((Math.cos(i*1.618)+1)/2)*900,
  sz:0.8+(i%8)*0.2, col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
}));
const ParticleBg = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#091628',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'6%',left:'12%',width:SW*.7,height:SW*.7,borderRadius:SW*.35,backgroundColor:'rgba(26,159,227,0.025)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(56,189,248,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Card component ─────────────────────────────────────────────────────── */
const Card = memo(({children,style,glow=BLUE}:{children:React.ReactNode;style?:any;glow?:string}) => (
  <View style={[{borderRadius:20,overflow:'hidden',padding:18,gap:14,backgroundColor:T.navy},style]}>
    <LinearGradient colors={[`${glow}0B`,`${glow}03`]} style={StyleSheet.absoluteFillObject}/>
    {children}
    <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
  </View>
));

/* ─── Counter ────────────────────────────────────────────────────────────── */
const Counter = memo(({ value, suffix = '', prefix = '', decimals = 0, color = T.white, size = 26 }: {
  value: number; suffix?: string; prefix?: string; decimals?: number; color?: string; size?: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState(`${prefix}0${suffix}`);
  useEffect(() => {
    anim.setValue(0);
    const l = anim.addListener(({ value: v }) => setTxt(`${prefix}${v.toFixed(decimals)}${suffix}`));
    Animated.timing(anim, { toValue: value, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(l);
  }, [value]);
  return <Text style={{ color, fontSize: size, fontWeight: '900', letterSpacing: -0.5 }}>{txt}</Text>;
});

/* ─── LiveDot ────────────────────────────────────────────────────────────── */
const LiveDot = memo(() => {
  const p = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1.85, duration: 900, useNativeDriver: true }),
      Animated.timing(p, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ position: 'relative', width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: `${BLUE}28`, transform: [{ scale: p }] }}/>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE }}/>
      </View>
      <Text style={{ color: BLUE, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>LIVE</Text>
    </View>
  );
});

/* ─── ProgBar ────────────────────────────────────────────────────────────── */
const ProgBar = memo(({ value, max, color = BLUE, label, right }: {
  value: number; max: number; color?: string; label: string; right: string;
}) => {
  const animV = useRef(new Animated.Value(0)).current;
  const pct   = max > 0 ? Math.min(value / max, 1) : 0;
  useEffect(() => {
    animV.setValue(0);
    Animated.timing(animV, { toValue: pct, duration: 880, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color, fontSize: 12, fontWeight: '800' }}>{right}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 2.5, backgroundColor: T.faint, overflow: 'hidden' }}>
        <Animated.View style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 2.5,
          backgroundColor: color,
          width: animV.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}/>
      </View>
    </View>
  );
});

/* ─── TrendBadge ─────────────────────────────────────────────────────────── */
const TrendBadge = memo(({ curr, prev }: { curr: number; prev: number }) => {
  if (prev === 0 || curr === prev) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  const up  = pct > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
      backgroundColor: up ? 'rgba(26,159,227,0.12)' : 'rgba(239,68,68,0.12)' }}>
      <Ionicons name={up ? 'trending-up' : 'trending-down'} size={10} color={up ? BLUE : T.red}/>
      <Text style={{ color: up ? BLUE : T.red, fontSize: 9, fontWeight: '800' }}>{up ? '+' : ''}{pct}%</Text>
    </View>
  );
});

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
const Skeleton = memo(() => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 860, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 860, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  const L = ({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) => (
    <Animated.View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: T.surf }, { opacity: op }]}/>
  );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2, 3].map(i => <Animated.View key={i} style={{ flex: 1, height: 80, borderRadius: 16, backgroundColor: T.navy, opacity: op }}/>)}
      </View>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ borderRadius: 20, padding: 16, gap: 12, backgroundColor: T.navy }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Animated.View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: T.surf, opacity: op }}/>
            <View style={{ flex: 1, gap: 8 }}><L w="65%" h={13}/><L w="40%" h={9}/></View>
            <L w={52} h={22} r={9}/>
          </View>
          <L w="100%" h={4} r={2}/>
          <View style={{ flexDirection: 'row', gap: 8 }}><L w="45%" h={9}/><L w="35%" h={9}/></View>
        </View>
      ))}
    </View>
  );
});

/* ─── Mission Card ───────────────────────────────────────────────────────── */
const MissionCard = memo(function MissionCard({ m, index, onPress }: {
  m: Mission; index: number; onPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 360,
      delay: Math.min(index * 45, 300),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const onPI = () => Animated.spring(press, { toValue: 0.97, tension: 270, friction: 9, useNativeDriver: true }).start();
  const onPO = () => Animated.spring(press, { toValue: 1,    tension: 220, friction: 12, useNativeDriver: true }).start();

  const pay         = PAY[m.payment_status] ?? PAY.pending;
  const tc          = typeColor(m.event_type);
  const init        = m.staff_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roles       = Array.isArray(m.staff_role) ? m.staff_role : [];
  const primaryRole = roles[0] ?? '—';

  const durationStr = m.hours_worked != null
    ? `${Number(m.hours_worked).toFixed(1)}h`
    : (m.check_in && m.check_out)
      ? `${((new Date(m.check_out).getTime() - new Date(m.check_in).getTime()) / 3600000).toFixed(1)}h`
      : null;

  const paidPct = (m.amount_due && m.amount_due > 0 && m.amount_paid != null)
    ? Math.min(m.amount_paid / m.amount_due, 1)
    : 0;

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: press }],
      marginBottom: 12,
    }}>
      <TouchableOpacity
        style={[mc.card, { borderColor: `${pay.c}20` }]}
        onPress={onPress} onPressIn={onPI} onPressOut={onPO} activeOpacity={1}
      >
        <LinearGradient colors={[`${pay.c}0A`, `${pay.c}03`]} style={StyleSheet.absoluteFillObject}/>

        {/* Event header */}
        <View style={mc.evtRow}>
          <View style={[mc.evtIcon, { backgroundColor: `${tc}16`, borderColor: `${tc}28` }]}>
            <Ionicons name="calendar-outline" size={13} color={tc}/>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mc.evtTitle} numberOfLines={1}>{m.event_title}</Text>
            <Text style={{ color: T.muted, fontSize: 10 }}>
              {fmt(m.event_date)}
              {m.event_location ? `  ·  ${m.event_location.split(',')[0]}` : ''}
            </Text>
          </View>
          <View style={[mc.payChip, { backgroundColor: `${pay.c}14`, borderColor: `${pay.c}30` }]}>
            <Ionicons name={pay.icon} size={9} color={pay.c}/>
            <Text style={{ color: pay.c, fontSize: 9, fontWeight: '800' }}>{pay.l}</Text>
          </View>
        </View>

        {/* Staff row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          {m.staff_avatar && !imgErr
            ? <Image source={{ uri: m.staff_avatar }} style={mc.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[mc.avatar, mc.avatarFb]}>
                <Text style={{ color: BLUE, fontSize: 17, fontWeight: '900' }}>{init}</Text>
              </View>
          }
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={mc.staffName} numberOfLines={1}>{m.staff_name}</Text>
            <Text style={{ color: BLUE, fontSize: 11, fontWeight: '600' }}>{primaryRole}</Text>
            {roles.length > 1 && <Text style={{ color: T.muted, fontSize: 10 }}>{roles.slice(1).join('  ·  ')}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={{ color: GOLD, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>
              {fmtMoney(m.amount_due)}
            </Text>
            {m.amount_paid != null && m.amount_paid > 0 && (
              <Text style={{ color: SUCCESS, fontSize: 10, fontWeight: '700' }}>
                {fmtMoney(m.amount_paid)} payé
              </Text>
            )}
          </View>
        </View>

        {/* Time row */}
        {(m.check_in || m.check_out || durationStr) && (
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {m.check_in && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="log-in-outline" size={12} color={T.muted}/>
                <Text style={{ color: T.muted, fontSize: 11 }}>{fmtTime(m.check_in)}</Text>
              </View>
            )}
            {m.check_out && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="log-out-outline" size={12} color={T.muted}/>
                <Text style={{ color: T.muted, fontSize: 11 }}>{fmtTime(m.check_out)}</Text>
              </View>
            )}
            {durationStr && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="timer-outline" size={12} color={BLUE}/>
                <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700' }}>{durationStr}</Text>
              </View>
            )}
          </View>
        )}

        {/* Payment progress bar */}
        {m.amount_due != null && m.amount_due > 0 && (
          <View style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: T.muted, fontSize: 10, fontWeight: '600' }}>Paiement</Text>
              <Text style={{ color: pay.c, fontSize: 10, fontWeight: '800' }}>{Math.round(paidPct * 100)}%</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: T.faint, overflow: 'hidden' }}>
              <View style={{ width: `${paidPct * 100}%` as any, height: '100%', borderRadius: 2, backgroundColor: pay.c }}/>
            </View>
          </View>
        )}

        {/* Stripe */}
        {m.stripe_transfer && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="card-outline" size={11} color={T.purple}/>
            <Text style={{ color: T.purple, fontSize: 10, fontWeight: '600' }}>
              Stripe: {m.stripe_transfer.slice(0, 20)}…
            </Text>
          </View>
        )}

        {/* Border overlay */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: `${pay.c}20` }}/>
      </TouchableOpacity>
    </Animated.View>
  );
});
const mc = StyleSheet.create({
  card    : { borderRadius: 20, overflow: 'hidden', padding: 16, gap: 11, backgroundColor: T.navy },
  evtRow  : { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evtIcon : { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  evtTitle: { color: T.white, fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  payChip : { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth },
  avatar  : { width: 44, height: 44, borderRadius: 13, backgroundColor: T.navy },
  avatarFb: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(26,159,227,0.12)', borderWidth: 1.5, borderColor: T.border },
  staffName: { color: T.white, fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function MissionsScreen() {
  const router = useRouter();

  const [missions,    setMissions]    = useState<Mission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [tab,         setTab]         = useState<PayStatus | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const uid = await getWorkingUid();
      if (!uid) { setMissions([]); return; }

      const { data: evts } = await supabase.from('events')
        .select('id,title,date_start,location,type,status,organizer_id')
        .eq('organizer_id', uid);
      if (!evts?.length) { setMissions([]); setLoading(false); setRefreshing(false); return; }

      const evtIds = evts.map((e: any) => e.id);
      const { data: raw, error } = await supabase.from('missions')
        .select('id,application_id,staff_id,event_id,check_in,check_out,hours_worked,amount_due,amount_paid,payment_status,stripe_transfer,created_at')
        .in('event_id', evtIds)
        .order('created_at', { ascending: false });

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
          staff_name    : st.display_name ?? 'Staff inconnu',
          staff_avatar  : st.avatar_url ?? null,
          staff_role    : st.role ?? [],
          event_title   : ev.title ?? '—',
          event_date    : ev.date_start ?? '',
          event_location: ev.location ?? '',
          event_type    : ev.type ?? null,
          event_status  : ev.status ?? '',
        };
      }));
      setLastUpdated(new Date());
    } catch (e) { console.error('[missions]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let mounted = true;
    const ch = supabase.channel(`missions_rt_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' },
        () => { if (mounted) load(true); })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === 'all') return missions;
    return missions.filter(m => m.payment_status === tab);
  }, [missions, tab]);

  const kpis = useMemo(() => ({
    total     : missions.length,
    totalDue  : missions.reduce((s, m) => s + (m.amount_due  ?? 0), 0),
    totalPaid : missions.reduce((s, m) => s + (m.amount_paid ?? 0), 0),
    totalHours: missions.reduce((s, m) => s + (m.hours_worked ?? 0), 0),
    pending   : missions.filter(m => m.payment_status === 'pending').length,
    paid      : missions.filter(m => m.payment_status === 'paid').length,
  }), [missions]);

  const TABS: [PayStatus | 'all', string, number][] = [
    ['all',     'Toutes',      missions.length],
    ['pending', 'En attente',  missions.filter(m => m.payment_status === 'pending').length],
    ['paid',    'Payées',      missions.filter(m => m.payment_status === 'paid').length],
    ['partial', 'Partielles',  missions.filter(m => m.payment_status === 'partial').length],
  ];

  const lastStr = lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const renderItem = useCallback(({ item, index }: { item: Mission; index: number }) => (
    <MissionCard m={item} index={index}
      onPress={() => router.push({ pathname: '/(organizer)/mission/[id]', params: { id: item.id } } as any)}
    />
  ), [router]);
  const keyExtractor = useCallback((m: Mission) => `m_${m.id}`, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg/>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── NAV ── */}
        <View style={ds.nav}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ds.greet}>Gestion</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={ds.title}>Missions</Text>
              <LiveDot/>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <TouchableOpacity
              style={ds.navBtn}
              onPress={() => router.push('/(organizer)/applications' as any)}
              activeOpacity={0.78}
            >
              <Ionicons name="document-text-outline" size={17} color={T.muted}/>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ds.navBtn, { backgroundColor: 'rgba(26,159,227,0.15)', borderColor: T.borderHi }]}
              onPress={() => router.push('/(organizer)/create-event' as any)}
              activeOpacity={0.82}
            >
              <Ionicons name="add" size={20} color={BLUE}/>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: EDGE, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE}/>}
        >
          {/* Timestamp */}
          <Text style={{ color: T.faint, fontSize: 9, fontWeight: '600', textAlign: 'right', letterSpacing: 0.3 }}>
            Mis à jour à {lastStr}
          </Text>

          {loading ? <Skeleton/> : (<>

            {/* ── KPI STRIP ── */}
            <View style={ds.kpiRow}>
              {[
                { l: 'Missions\ntotales',    v: kpis.total,      c: T.white, icon: 'briefcase-outline'       as const },
                { l: 'En attente\npaiement', v: kpis.pending,    c: T.amber, icon: 'time-outline'             as const },
                { l: 'Heures\ntravaillées',  v: kpis.totalHours, c: T.blue,  icon: 'timer-outline'            as const, dec: 1 },
                { l: 'Payées',               v: kpis.paid,       c: BLUE,   icon: 'checkmark-circle-outline' as const },
              ].map(({ l, v, c, icon, dec }) => (
                <View key={l} style={[ds.kpiCard, { borderColor: `${c}20` }]}>
                  <LinearGradient colors={[`${c}12`, `${c}04`]} style={StyleSheet.absoluteFillObject}/>
                  <Ionicons name={icon} size={15} color={c}/>
                  <Counter value={v} color={c} size={20} decimals={dec ?? 0}/>
                  <Text style={{ color: T.muted, fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 }}>{l}</Text>
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: `${c}20` }}/>
                </View>
              ))}
            </View>

            {/* ── FINANCE CARD ── */}
            {kpis.total > 0 && (
              <Card glow={GOLD}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={ds.cardTitle}>Finances</Text>
                  <TrendBadge curr={kpis.totalPaid} prev={kpis.totalDue * 0.5}/>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Counter value={kpis.totalDue} suffix="€" color={GOLD} size={22}/>
                    <Text style={{ color: T.muted, fontSize: 9, fontWeight: '700' }}>DÛ</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Counter value={kpis.totalPaid} suffix="€" color={SUCCESS} size={22}/>
                    <Text style={{ color: T.muted, fontSize: 9, fontWeight: '700' }}>PAYÉ</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Counter value={Math.max(kpis.totalDue - kpis.totalPaid, 0)} suffix="€" color={T.amber} size={22}/>
                    <Text style={{ color: T.muted, fontSize: 9, fontWeight: '700' }}>RESTANT</Text>
                  </View>
                </View>
                <ProgBar
                  value={kpis.totalPaid}
                  max={Math.max(kpis.totalDue, 1)}
                  color={SUCCESS}
                  label="Taux de paiement"
                  right={`${kpis.totalDue > 0 ? Math.round(kpis.totalPaid / kpis.totalDue * 100) : 0}%`}
                />
              </Card>
            )}

            {/* ── FILTER TABS ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {TABS.map(([k, l, n]) => (
                <TouchableOpacity
                  key={k}
                  style={[
                    ds.chip,
                    tab === k
                      ? { backgroundColor: 'rgba(26,159,227,0.12)', borderColor: T.borderHi }
                      : { backgroundColor: T.surf, borderColor: T.border },
                  ]}
                  onPress={() => setTab(k)}
                  activeOpacity={0.75}
                >
                  <Text style={[ds.chipTxt, tab === k && { color: BLUE, fontWeight: '800' }]}>{l}</Text>
                  {n > 0 && (
                    <Text style={{ color: tab === k ? BLUE : T.faint, fontSize: 11, fontWeight: '700' }}> {n}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── LIST ── */}
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 72, gap: 14 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(26,159,227,0.12)',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Ionicons name="briefcase-outline" size={38} color="rgba(26,159,227,0.4)"/>
                </View>
                <Text style={{ color: T.white, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 }}>
                  {tab === 'all'     ? 'Aucune mission créée'        :
                   tab === 'pending' ? 'Aucun paiement en attente'   :
                   tab === 'paid'    ? 'Aucune mission payée'         : 'Aucune mission'}
                </Text>
                <Text style={{ color: T.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                  {tab === 'all'
                    ? "Créez un événement et publiez une mission\npour démarrer le recrutement."
                    : "Changez d'onglet pour voir d'autres missions."}
                </Text>
                {tab === 'all' && (
                  <TouchableOpacity
                    style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
                             backgroundColor: BLUE, shadowColor: BLUE, shadowOffset: { width: 0, height: 3 },
                             shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 }}
                    onPress={() => router.push('/(organizer)/create-event' as any)}
                    activeOpacity={0.82}
                  >
                    <Text style={{ color: BG, fontWeight: '800', fontSize: 13 }}>+ Créer une mission</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                scrollEnabled={false}
                ListFooterComponent={<View style={{ height: 14 }}/>}
              />
            )}

          </>)}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ds = StyleSheet.create({
  nav     : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: EDGE, paddingVertical: 12, paddingBottom: 8 },
  greet   : { color: T.muted, fontSize: 12, fontWeight: '600' },
  title   : { color: T.white, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  navBtn  : { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  kpiRow  : { flexDirection: 'row', gap: 10 },
  kpiCard : { flex: 1, borderRadius: 16, overflow: 'hidden', padding: 13, gap: 6, alignItems: 'center', backgroundColor: T.navy },
  cardTitle: { color: T.white, fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  chip    : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7,
              borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  chipTxt : { color: T.muted, fontSize: 12, fontWeight: '600' },
});
