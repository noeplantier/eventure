/**
 * app/(organizer)/dashboard.tsx — EVENTURE v4
 * AI-powered real-time control center
 * Dark navy theme — BG #050E1B + Liquid Glass cards
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BlurView }        from 'expo-blur';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }       from 'expo-status-bar';
import { useRouter }       from 'expo-router';
import { supabase }        from '@/lib/supabase';
import { getWorkingOrganizerId } from '@/lib/mockUser';
import { useInteractiveBg } from '@/components/InteractiveBg';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG      = '#050E1B';
const BLUE    = '#1A9FE3';
const CYAN    = '#1A9FE3';
const GOLD    = '#FFFFFF';
const NAVY    = '#0C1A30';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.52)';
const FAINT   = 'rgba(255,255,255,0.07)';
const SUCCESS = '#1A9FE3';
const WARNING = 'rgba(255,255,255,0.65)';
const DANGER  = 'rgba(255,255,255,0.45)';
const PURPLE  = '#1A9FE3';

const EDGE = 16;

const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: 'rgba(255,255,255,0.65)', Conférence: BLUE,
  Mariage: '#1A9FE3', Séminaire: PURPLE, Concert: DANGER,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface OrgProfile {
  display_name: string;
  company_name: string | null;
  avatar_url: string | null;
}
interface DashEvent {
  id: string;
  title: string;
  date_start: string;
  location: string;
  status: string;
  type: string | null;
  budget: number | null;
  cover_url: string | null;
}
interface StaffMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_available: boolean;
  rating: number | null;
}
interface MissionItem {
  id: string;
  date_start: string | null;
  event_id: string;
  staff_id: string;
  status: string;
  amount_due: number | null;
  amount_paid: number | null;
}
interface AppItem {
  id: string;
  status: string;
  applied_at: string;
  event_role_id: string;
  staff_id: string;
}
interface AIInsight {
  iconName: string;
  text: string;
  color: string;
}
interface Countdown {
  d: number;
  h: number;
  m: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate   = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

function eventTypeIcon(type: string | null): string {
  const map: Record<string, string> = {
    Techno: 'flash-outline', House: 'musical-notes-outline', Rock: 'musical-note-outline',
    Festival: 'ribbon-outline', Gala: 'sparkles-outline', Concert: 'musical-notes-outline',
  };
  return map[type ?? ''] ?? 'calendar-outline';
}

function generateInsights(
  events: DashEvent[],
  staff: StaffMember[],
  missions: MissionItem[],
  applications: AppItem[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  const nextEvent = events
    .filter(e => e.status === 'published' && new Date(e.date_start) > new Date())
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0];

  if (nextEvent) {
    const days = Math.ceil((new Date(nextEvent.date_start).getTime() - Date.now()) / 86400000);
    insights.push({
      iconName: 'navigate-circle-outline',
      color: BLUE,
      text: `"${nextEvent.title}" dans ${days}j — vérifiez la couverture staff`,
    });
  }

  const pendingApps = applications.filter(a => a.status === 'pending').length;
  if (pendingApps > 0) {
    insights.push({
      iconName: 'document-text-outline',
      color: WARNING,
      text: `${pendingApps} candidature${pendingApps > 1 ? 's' : ''} en attente de réponse`,
    });
  }

  const unpaidMissions = missions.filter(
    m => m.status === 'completed' && (m.amount_paid ?? 0) < (m.amount_due ?? 0),
  );
  if (unpaidMissions.length > 0) {
    const total = unpaidMissions.reduce(
      (s, m) => s + ((m.amount_due ?? 0) - (m.amount_paid ?? 0)),
      0,
    );
    insights.push({
      iconName: 'cash-outline',
      color: GOLD,
      text: `${total.toFixed(0)}€ en attente de paiement — ${unpaidMissions.length} mission${unpaidMissions.length > 1 ? 's' : ''}`,
    });
  }

  const availableStaff = staff.filter(s => s.is_available).length;
  insights.push({
    iconName: 'people-outline',
    color: SUCCESS,
    text: `${availableStaff}/${staff.length} staff disponibles pour les prochains events`,
  });

  const publishedEvents = events.filter(e => e.status === 'published').length;
  const totalBudget = events.reduce((s, e) => s + (e.budget ?? 0), 0);
  insights.push({
    iconName: 'trending-up-outline',
    color: PURPLE,
    text: `${publishedEvents} events publiés — budget total: ${(totalBudget / 1000).toFixed(0)}k€`,
  });

  return insights.length > 0 ? insights : [{ iconName: 'sparkles-outline', color: BLUE, text: 'Bienvenue sur votre tableau de bord IA' }];
}

/* ─── Liquid Glass Card ──────────────────────────────────────────────────── */
function GlassCard({
  children,
  style,
  radius = 18,
  tint = 'blue',
  noBorder = false,
}: {
  children: React.ReactNode;
  style?: any;
  radius?: number;
  tint?: 'blue' | 'gold' | 'white' | 'purple';
  noBorder?: boolean;
}) {
  const tintMap = {
    blue:   ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.03)'],
    gold:   ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)'],
    white:  ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)'],
    purple: ['rgba(255,255,255,0.06)', 'rgba(26,159,227,0.05)'],
  } as const;
  const borderMap = {
    blue:   'rgba(255,255,255,0.12)',
    gold:   'rgba(255,255,255,0.20)',
    white:  'rgba(255,255,255,0.18)',
    purple: 'rgba(255,255,255,0.12)',
  };
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,14,27,0.70)', borderRadius: radius }]}/>
      <BlurView intensity={55} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: radius }]}/>
      <LinearGradient
        colors={tintMap[tint] as any}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
      />
      <View style={{
        position: 'absolute', top: 0, left: radius * 0.5, right: radius * 0.5,
        height: 1, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 1,
      }}/>
      {!noBorder && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: borderMap[tint] }]}/>
      )}
      {children}
    </View>
  );
}

/* ─── Enhanced Particle Background ──────────────────────────────────────── */
const NUM_P = 36;
const PCOLS = [
  '#1A9FE3', 'rgba(26,159,227,0.55)', '#1A9FE3', 'rgba(26,159,227,0.45)',
  'rgba(255,255,255,0.30)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)',
];
const PARTS = Array.from({ length: NUM_P }, (_, i) => ({
  x:   (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
  y:   (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
  sz:  i % 9 === 0 ? 5 : i % 5 === 0 ? 3.5 : i % 3 === 0 ? 2.5 : 1.8,
  col: PCOLS[i % PCOLS.length],
  dur: 2400 + (i % 7) * 600,
  del: (i % 9) * 220,
  shadow: i % 7 === 0,
}));

function ParticleBg() {
  const anims = useRef(PARTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(PARTS[i].del),
          Animated.timing(anim, { toValue: 1, duration: PARTS[i].dur / 2, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: PARTS[i].dur / 2, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[BG, '#091628', '#05112A', BG]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{
        position: 'absolute', top: '8%', left: '-20%', right: '-20%', height: '55%',
        backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 999,
      }}/>
      {PARTS.map((p, i) => {
        const opacity = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.12, p.shadow ? 0.85 : 0.55] });
        const scale   = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%` as any,
              top:  `${p.y}%` as any,
              width: p.sz,
              height: p.sz,
              borderRadius: p.sz / 2,
              backgroundColor: p.col,
              opacity,
              transform: [{ scale }],
              ...(p.shadow ? { shadowColor: BLUE, shadowOpacity: 0.9, shadowRadius: 6 } : {}),
            }}
          />
        );
      })}
    </View>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const init = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: WHITE, fontSize: size * 0.36, fontWeight: '700' }}>{init}</Text>
    </View>
  );
}

/* ─── KPI Pill Card ──────────────────────────────────────────────────────── */
const KpiCard = memo(({
  icon, value, label, tint, suffix,
}: {
  icon: string;
  value: string | number;
  label: string;
  tint: 'blue' | 'gold' | 'white' | 'purple';
  suffix?: string;
}) => {
  const glowMap = { blue: BLUE, gold: GOLD, white: WHITE, purple: PURPLE };
  const glow = glowMap[tint];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const val = typeof value === 'number' ? value : parseFloat(String(value));
    if (val > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 1800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0,  duration: 1800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [value]);

  return (
    <GlassCard tint={tint} radius={16} style={{ width: 130, marginRight: 10 }}>
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Animated.View style={{
            width: 32, height: 32, borderRadius: 9, backgroundColor: `${glow}22`,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pulse }],
          }}>
            <Ionicons name={icon as any} size={16} color={glow}/>
          </Animated.View>
        </View>
        <Text style={{ color: WHITE, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
          {value}{suffix ?? ''}
        </Text>
        <Text style={{ color: MUTED, fontSize: 10, fontWeight: '500', lineHeight: 14 }}>{label}</Text>
      </View>
    </GlassCard>
  );
});

/* ─── Staff Mini Card ────────────────────────────────────────────────────── */
const StaffMiniCard = memo(({ member }: { member: StaffMember }) => (
  <GlassCard tint="white" radius={14} style={{ width: 110, marginRight: 10 }}>
    <View style={{ padding: 12, alignItems: 'center', gap: 8 }}>
      <View style={{ position: 'relative' }}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: WHITE, fontWeight: '700', fontSize: 16 }}>
              {member.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 11, height: 11, borderRadius: 5.5,
          backgroundColor: member.is_available ? SUCCESS : MUTED,
          borderWidth: 2, borderColor: BG,
        }}/>
      </View>
      <Text style={{ color: WHITE, fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
        {member.display_name}
      </Text>
      {member.rating != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="star" size={10} color={GOLD}/>
          <Text style={{ color: GOLD, fontSize: 10, fontWeight: '700' }}>{member.rating.toFixed(1)}</Text>
        </View>
      )}
    </View>
  </GlassCard>
));

/* ─── Event Row Card ─────────────────────────────────────────────────────── */
const EventRowCard = memo(({ evt, onPress }: { evt: DashEvent; onPress: () => void }) => {
  const tc   = TYPE_COLORS[evt.type ?? ''] ?? BLUE;
  const days = daysUntil(evt.date_start);
  const urg  = days <= 2 ? DANGER : days <= 7 ? WARNING : SUCCESS;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={{ marginBottom: 10 }}>
      <GlassCard tint="white" radius={14} style={{ borderLeftWidth: 3, borderLeftColor: tc }}>
        {/* Cover image */}
        {evt.cover_url ? (
          <Image
            source={{ uri: evt.cover_url }}
            style={{ width: '100%', height: 80, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: 80, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={eventTypeIcon(evt.type) as any} size={28} color="rgba(255,255,255,0.25)" />
          </View>
        )}
        <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: `${tc}22`, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="calendar-outline" size={16} color={tc}/>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: WHITE, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{evt.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={10} color={MUTED}/>
                <Text style={{ color: MUTED, fontSize: 10 }} numberOfLines={1}>{evt.location.split(',')[0]}</Text>
              </View>
              <Text style={{ color: MUTED, fontSize: 10 }}>·</Text>
              <Text style={{ color: urg, fontSize: 10, fontWeight: '700' }}>
                {days <= 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `J-${days}`}
              </Text>
            </View>
          </View>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
            backgroundColor: evt.status === 'published' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{
              color: evt.status === 'published' ? SUCCESS : WARNING,
              fontSize: 10, fontWeight: '700',
            }}>
              {evt.status === 'published' ? 'Actif' : evt.status === 'draft' ? 'Brouillon' : 'Terminé'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
});

/* ─── Section Header ─────────────────────────────────────────────────────── */
const SectionHeader = memo(({
  title, count, onAll, allLabel = 'Tout voir',
}: {
  title: string; count?: number; onAll?: () => void; allLabel?: string;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: WHITE }}>{title}</Text>
      {count != null && count > 0 && (
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800' }}>{count}</Text>
        </View>
      )}
    </View>
    {onAll && (
      <TouchableOpacity onPress={onAll} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: BLUE, fontSize: 12, fontWeight: '700' }}>{allLabel}</Text>
        <Ionicons name="arrow-forward-outline" size={12} color={BLUE}/>
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
    loop.start();
    return () => loop.stop();
  }, []);
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const B = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.05)', opacity: op }}/>
  );
  return (
    <View style={{ gap: 20, paddingHorizontal: EDGE }}>
      <B w="60%" h={28} r={10}/>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2, 3].map(i => <B key={i} w={130} h={100} r={16}/>)}
      </View>
      <B w="100%" h={130} r={18}/>
      <B w="100%" h={100} r={16}/>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map(i => <B key={i} w={110} h={120} r={14}/>)}
      </View>
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  /* state */
  const [org,          setOrg]          = useState<OrgProfile | null>(null);
  const [orgId,        setOrgId]        = useState<string | null>(null);
  const [events,       setEvents]       = useState<DashEvent[]>([]);
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [missions,     setMissions]     = useState<MissionItem[]>([]);
  const [applications, setApplications] = useState<AppItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [liveActive,   setLiveActive]   = useState(false);

  /* AI insight rotation */
  const [insightIdx,    setInsightIdx]    = useState(0);
  const insightOpacity  = useRef(new Animated.Value(1)).current;

  /* countdown */
  const [countdown, setCountdown] = useState<Countdown>({ d: 0, h: 0, m: 0 });

  /* derived */
  const insights = useMemo(() => generateInsights(events, staff, missions, applications), [events, staff, missions, applications]);

  const nextEvent = useMemo(() =>
    events
      .filter(e => e.status === 'published' && new Date(e.date_start) > new Date())
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0],
    [events],
  );

  const pendingCount   = useMemo(() => applications.filter(a => a.status === 'pending').length, [applications]);
  const activeMissions = useMemo(() => missions.filter(m => m.status === 'active' || m.status === 'confirmed').length, [missions]);
  const totalRevenue   = useMemo(() => events.reduce((s, e) => s + (e.budget ?? 0), 0), [events]);

  /* sticky header animation */
  const headerBg = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: ['rgba(5,14,27,0)', 'rgba(5,14,27,0.95)'],
    extrapolate: 'clamp',
  });

  /* live pulse animation */
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  /* ── Data fetch ─────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const id = await getWorkingOrganizerId();
      if (!id) return;
      setOrgId(id);

      const [orgRes, eventsRes, staffRes] = await Promise.all([
        supabase.from('organizers').select('display_name,company_name,avatar_url').eq('id', id).maybeSingle(),
        supabase.from('events').select('id,title,date_start,location,status,type,budget,cover_url').eq('organizer_id', id).order('date_start', { ascending: false }).limit(50),
        supabase.from('staff').select('id,display_name,avatar_url,is_available,rating').order('display_name').limit(20),
      ]);

      if (orgRes.data)    setOrg(orgRes.data as OrgProfile);
      const evts = (eventsRes.data ?? []) as DashEvent[];
      setEvents(evts);
      setStaff((staffRes.data ?? []) as StaffMember[]);

      const evtIds = evts.map(e => e.id);
      if (evtIds.length > 0) {
        const [missionsRes, rolesRes] = await Promise.all([
          supabase.from('missions').select('id,date_start,event_id,staff_id,status,amount_due,amount_paid').in('event_id', evtIds).order('date_start', { ascending: false }).limit(10),
          supabase.from('event_roles').select('id').in('event_id', evtIds),
        ]);
        setMissions((missionsRes.data ?? []) as MissionItem[]);

        const roleIds = (rolesRes.data ?? []).map((r: any) => r.id);
        if (roleIds.length > 0) {
          const { data: appsData } = await supabase
            .from('applications')
            .select('id,status,applied_at,event_role_id,staff_id')
            .in('event_role_id', roleIds)
            .order('applied_at', { ascending: false });
          setApplications((appsData ?? []) as AppItem[]);
        } else {
          setApplications([]);
        }
      } else {
        setMissions([]);
        setApplications([]);
      }
    } catch (e) {
      console.error('[dashboard v4]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  /* ── Real-time subscription ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    const topic = `dashboard_rt_${orgId}`;

    // Purge any stale channel with same topic before creating a new one
    supabase.getChannels()
      .filter(c => c.topic === `realtime:${topic}`)
      .forEach(c => supabase.removeChannel(c));

    const ch = supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' },     () => { if (alive) fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => { if (alive) fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },       () => { if (alive) fetchData(); })
      .subscribe(status => {
        if (alive) setLiveActive(status === 'SUBSCRIBED');
      });

    return () => {
      alive = false;
      supabase.removeChannel(ch);
      setLiveActive(false);
    };
  // fetchData excluded intentionally — it changes on every orgId update and would
  // cause the channel to teardown/rebuild repeatedly, triggering the same error.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  /* ── AI insight cycle ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(insightOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setInsightIdx(prev => (prev + 1) % insights.length);
        Animated.timing(insightOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [insights.length]);

  /* ── Countdown ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const compute = () => {
      if (!nextEvent) return;
      const diff = new Date(nextEvent.date_start).getTime() - Date.now();
      if (diff <= 0) return;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown({ d, h, m });
    };
    compute();
    const t = setInterval(compute, 60000);
    return () => clearInterval(t);
  }, [nextEvent]);

  /* ── Greeting ─────────────────────────────────────────────────────────────── */
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const fname    = (org?.display_name ?? '').split(' ')[0];
  const today    = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const recentEvents = useMemo(() =>
    events.filter(e => e.status !== 'cancelled').slice(0, 4),
    [events],
  );

  /* ── Render ────────────────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light"/>
      <ParticleBg/>

      {/* ── Floating sticky header ── */}
      <Animated.View style={[styles.stickyHeader, { backgroundColor: headerBg, paddingTop: insets.top + 4 }]}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}/>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="analytics-outline" size={18} color={BLUE}/>
          <Text style={{ color: WHITE, fontSize: 16, fontWeight: '800' }}>Hub</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Animated.View style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: liveActive ? SUCCESS : MUTED,
            transform: [{ scale: liveActive ? livePulse : 1 }],
          }}/>
          <Text style={{ color: liveActive ? SUCCESS : MUTED, fontSize: 11, fontWeight: '700' }}>
            {liveActive ? 'LIVE' : 'OFFLINE'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(organizer)/create-event' as any)}
            activeOpacity={0.82}
            style={styles.createBtn}
          >
            <Ionicons name="add" size={16} color={BG}/>
            <Text style={{ color: BG, fontSize: 12, fontWeight: '700' }}>Créer</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Main scroll ── */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, paddingBottom: 110, paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={BLUE}
          />
        }
      >
        {/* ── Welcome banner ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: insets.top + 64, paddingBottom: 8 }}>
          <Text style={{ color: WHITE, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            {greeting}{fname ? `, ${fname}` : ''}
          </Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>
            {today}
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 20 }}>
            <Skeleton/>
          </View>
        ) : (
          <>
            {/* ── KPI Row ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, paddingHorizontal: EDGE, paddingVertical: 12 }}
             style={{backgroundColor:'#050E1B'}}>
              <KpiCard
                icon="cash-outline"
                value={totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}k` : totalRevenue.toString()}
                label="Budget total"
                tint="gold"
                suffix="€"
              />
              <KpiCard
                icon="people-outline"
                value={staff.length}
                label="Staff actifs"
                tint="blue"
              />
              <KpiCard
                icon="clipboard-outline"
                value={activeMissions}
                label="Missions actives"
                tint="purple"
              />
              <KpiCard
                icon="calendar-outline"
                value={nextEvent ? `${daysUntil(nextEvent.date_start)}j` : '—'}
                label="Prochain event"
                tint="white"
              />
            </ScrollView>

            {/* ── AI Control Center ── */}
            <View style={{ paddingHorizontal: EDGE, marginBottom: 20 }}>
              <GlassCard tint="blue" radius={20}>
                <View style={{ padding: 18, gap: 16 }}>
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 10,
                        backgroundColor: 'rgba(255,255,255,0.09)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="flash-outline" size={16} color={BLUE}/>
                      </View>
                      <Text style={{ color: WHITE, fontSize: 15, fontWeight: '800' }}>Centre IA</Text>
                    </View>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                    }}>
                      <Animated.View style={{
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: BLUE,
                        transform: [{ scale: livePulse }],
                      }}/>
                      <Text style={{ color: BLUE, fontSize: 10, fontWeight: '800' }}>IA</Text>
                    </View>
                  </View>

                  {/* Insight chip */}
                  <GlassCard tint="white" radius={12} noBorder>
                    <Animated.View style={{ padding: 14, opacity: insightOpacity, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={(insights[insightIdx]?.iconName ?? 'sparkles-outline') as any}
                        size={20}
                        color={insights[insightIdx]?.color ?? WHITE}
                      />
                      <Text style={{
                        color: insights[insightIdx]?.color ?? WHITE,
                        fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18,
                      }}>
                        {insights[insightIdx]?.text ?? ''}
                      </Text>
                    </Animated.View>
                  </GlassCard>

                  {/* Insight dots */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                    {insights.map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          Animated.timing(insightOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                            setInsightIdx(i);
                            Animated.timing(insightOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: i === insightIdx ? 16 : 6,
                          height: 6, borderRadius: 3,
                          backgroundColor: i === insightIdx ? BLUE : 'rgba(255,255,255,0.20)',
                        }}/>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Quick actions */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.quickAction}
                      onPress={() => router.push('/(organizer)/applications' as any)}
                      activeOpacity={0.82}
                    >
                      <View style={{ position: 'relative' }}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={SUCCESS}/>
                        {pendingCount > 0 && (
                          <View style={styles.quickBadge}>
                            <Text style={{ color: WHITE, fontSize: 8, fontWeight: '800' }}>{pendingCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: SUCCESS, fontSize: 11, fontWeight: '700' }}>Approuver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickAction, { borderColor: 'rgba(255,255,255,0.12)' }]}
                      onPress={() => router.push('/(organizer)/missions' as any)}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="flash-outline" size={16} color={PURPLE}/>
                      <Text style={{ color: PURPLE, fontSize: 11, fontWeight: '700' }}>Missions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickAction, { borderColor: 'rgba(255,255,255,0.12)', flex: 1 }]}
                      onPress={() => router.push('/(organizer)/create-event' as any)}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={BLUE}/>
                      <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700' }}>+ Événement</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            </View>

            {/* ── Next event countdown ── */}
            {nextEvent && (
              <View style={{ paddingHorizontal: EDGE, marginBottom: 20 }}>
                <SectionHeader title="Prochain événement"/>
                <GlassCard tint="blue" radius={18}>
                  <View style={{ padding: 18, gap: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        width: 38, height: 38, borderRadius: 11,
                        backgroundColor: 'rgba(255,255,255,0.09)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="time-outline" size={18} color={BLUE}/>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: WHITE, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{nextEvent.title}</Text>
                        <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                          {fmtDate(nextEvent.date_start)} · {nextEvent.location.split(',')[0]}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {[
                        { val: countdown.d, label: 'Jours' },
                        { val: countdown.h, label: 'Heures' },
                        { val: countdown.m, label: 'Minutes' },
                      ].map(({ val, label }) => (
                        <GlassCard key={label} tint="white" radius={12} style={{ flex: 1 }}>
                          <View style={{ padding: 12, alignItems: 'center', gap: 4 }}>
                            <Text style={{ color: WHITE, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                              {String(val).padStart(2, '0')}
                            </Text>
                            <Text style={{ color: MUTED, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                              {label}
                            </Text>
                          </View>
                        </GlassCard>
                      ))}
                    </View>
                  </View>
                </GlassCard>
              </View>
            )}

            {/* ── Staff overview ── */}
            {staff.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ paddingHorizontal: EDGE }}>
                  <SectionHeader
                    title="Équipe staff"
                    count={staff.filter(s => s.is_available).length}
                    onAll={() => router.push('/(organizer)/staff' as any)}
                    allLabel="Voir équipe"
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, paddingHorizontal: EDGE, paddingBottom: 4 }}
                 style={{backgroundColor:'#050E1B'}}>
                  {staff.map(member => (
                    <StaffMiniCard key={member.id} member={member}/>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Recent events ── */}
            {recentEvents.length > 0 && (
              <View style={{ paddingHorizontal: EDGE, marginBottom: 20 }}>
                <SectionHeader
                  title="Événements récents"
                  count={events.length}
                  onAll={() => router.push('/(organizer)/events' as any)}
                />
                {recentEvents.map(evt => (
                  <EventRowCard
                    key={evt.id}
                    evt={evt}
                    onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: evt.id } } as any)}
                  />
                ))}
              </View>
            )}

            {/* ── Empty state ── */}
            {events.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 52, paddingHorizontal: EDGE, gap: 16 }}>
                <GlassCard tint="blue" radius={50} style={{ width: 80, height: 80 }}>
                  <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="rocket-outline" size={36} color={BLUE}/>
                  </View>
                </GlassCard>
                <Text style={{ fontSize: 22, fontWeight: '900', color: WHITE, textAlign: 'center' }}>
                  Lancez votre premier{'\n'}événement
                </Text>
                <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 }}>
                  Créez un événement, publiez-le{'\n'}et recrutez votre équipe en 5 minutes.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: BLUE, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
                    shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 8,
                  }}
                  onPress={() => router.push('/(organizer)/create-event' as any)}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: BG, fontWeight: '800', fontSize: 15 }}>+ Créer un événement</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EDGE,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: BG,
  },
});
