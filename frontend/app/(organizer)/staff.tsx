/**
 * app/(organizer)/staff.tsx — EVENTURE v3
 * Dark blue theme with staff profile modal, star ratings, avatar initials.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
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
const BLUE  = '#1A9FE3';
const CYAN  = '#38BDF8';
const GOLD  = '#F5C842';
const NAVY  = '#0C1A30';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const FAINT = 'rgba(255,255,255,0.08)';

const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const EDGE    = 16;

const T = {
  white   : WHITE,
  offWhite: 'rgba(255,255,255,0.88)',
  muted   : MUTED,
  faint   : FAINT,
  surf    : 'rgba(255,255,255,0.045)',
  surfHi  : 'rgba(255,255,255,0.09)',
  border  : 'rgba(26,159,227,0.12)',
  borderHi: 'rgba(26,159,227,0.30)',
  navy    : NAVY,
  amber   : '#F59E0B',
  red     : '#EF4444',
  blue    : '#60A5FA',
  purple  : '#A78BFA',
} as const;

/* ─── Particle background ────────────────────────────────────────────────── */
const PCOLS = [BLUE, 'rgba(26,159,227,0.4)', GOLD, 'rgba(245,200,66,0.32)', 'rgba(255,255,255,0.16)'];
const PTS   = Array.from({ length: 18 }, (_, i) => ({
  id: i, x: ((Math.sin(i * 2.399) + 1) / 2) * SW, y: ((Math.cos(i * 1.618) + 1) / 2) * 900,
  sz: 0.8 + (i % 8) * 0.2, col: PCOLS[i % PCOLS.length], op: 0.04 + (i % 6) * 0.03,
}));
const ParticleBg = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG, '#091628', BG]} style={StyleSheet.absoluteFill}/>
    <View style={{ position: 'absolute', top: '6%', left: '12%', width: SW * 0.7, height: SW * 0.7, borderRadius: SW * 0.35, backgroundColor: 'rgba(26,159,227,0.025)' }}/>
    <View style={{ position: 'absolute', bottom: '8%', right: '-18%', width: SW * 0.6, height: SW * 0.6, borderRadius: SW * 0.3, backgroundColor: 'rgba(56,189,248,0.02)' }}/>
    {PTS.map(p => <View key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, width: p.sz, height: p.sz, borderRadius: p.sz / 2, backgroundColor: p.col, opacity: p.op }}/>)}
  </View>
));

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface StaffRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string[];
  rating: number | null;
  missions_count: number | null;
  experience_years: number | null;
  bio: string | null;
  hourly_rate?: number | null;
  is_available?: boolean | null;
}
interface EngagedStaff extends StaffRow {
  event_title: string;
  event_date: string;
  mission_status: string;
  role_title: string;
}
type Tab = 'available' | 'engaged';

/* ─── Avatar component ───────────────────────────────────────────────────── */
function Avatar({ name, size = 44, bg = BLUE }: { name: string; size?: number; bg?: string }) {
  const initials = name
    .trim()
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: WHITE, fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

/* ─── StarRating component (display only) ────────────────────────────────── */
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? GOLD : 'rgba(255,255,255,0.2)' }}>★</Text>
      ))}
      <Text style={{ fontSize: size - 2, color: MUTED, marginLeft: 4 }}>{rating.toFixed(1)}</Text>
    </View>
  );
}

/* ─── Staff Profile Modal ────────────────────────────────────────────────── */
const StaffProfileModal = memo(function StaffProfileModal({
  staff,
  visible,
  onClose,
}: {
  staff: StaffRow | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => { setImgErr(false); }, [staff?.id]);

  if (!staff) return null;

  const roles = Array.isArray(staff.role) ? staff.role : [];
  const rating = staff.rating ?? 0;
  const isAvailable = staff.is_available !== false; // default true if not set

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={ms.overlay}>
        {/* Tap outside to close */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>

        <View style={ms.sheet}>
          <LinearGradient
            colors={['#0C1A30', '#050E1B']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Blue glow accent at top */}
          <View style={{ position: 'absolute', top: 0, left: SW * 0.2, width: SW * 0.6, height: 120, borderRadius: 60, backgroundColor: 'rgba(26,159,227,0.06)' }} pointerEvents="none"/>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            bounces={false}
          >
            {/* Close button */}
            <TouchableOpacity style={ms.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={{ color: MUTED, fontSize: 18, fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>

            {/* Avatar + name */}
            <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 20, gap: 12 }}>
              {staff.avatar_url && !imgErr ? (
                <Image
                  source={{ uri: staff.avatar_url }}
                  style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: BLUE }}
                  resizeMode="cover"
                  onError={() => setImgErr(true)}
                />
              ) : (
                <View style={{ borderWidth: 2, borderColor: BLUE, borderRadius: 44, padding: 2 }}>
                  <Avatar name={staff.display_name} size={80} bg="rgba(26,159,227,0.18)"/>
                </View>
              )}

              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: WHITE, textAlign: 'center' }}>
                  {staff.display_name}
                </Text>

                {/* Availability badge */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                  backgroundColor: isAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: isAvailable ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
                }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: isAvailable ? SUCCESS : MUTED }}/>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isAvailable ? SUCCESS : MUTED }}>
                    {isAvailable ? 'Disponible' : 'Indisponible'}
                  </Text>
                </View>
              </View>

              {/* Star rating */}
              <StarRating rating={rating} size={20}/>
            </View>

            {/* Role badges */}
            {roles.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: EDGE, marginBottom: 20 }}>
                {roles.map((r, i) => (
                  <View key={i} style={{
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                    backgroundColor: 'rgba(26,159,227,0.12)',
                    borderWidth: 1, borderColor: 'rgba(26,159,227,0.30)',
                  }}>
                    <Text style={{ color: BLUE, fontSize: 12, fontWeight: '600' }}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Stats row */}
            <View style={ms.statsRow}>
              <View style={ms.statItem}>
                <Text style={ms.statValue}>
                  {staff.hourly_rate != null ? `${staff.hourly_rate}€` : '—'}
                </Text>
                <Text style={ms.statLabel}>par heure</Text>
              </View>
              <View style={ms.statDivider}/>
              <View style={ms.statItem}>
                <Text style={ms.statValue}>
                  {staff.experience_years != null ? `${staff.experience_years} ans` : '—'}
                </Text>
                <Text style={ms.statLabel}>expérience</Text>
              </View>
              <View style={ms.statDivider}/>
              <View style={ms.statItem}>
                <Text style={ms.statValue}>
                  {staff.missions_count != null ? String(staff.missions_count) : '—'}
                </Text>
                <Text style={ms.statLabel}>missions</Text>
              </View>
            </View>

            {/* Bio */}
            {staff.bio ? (
              <View style={ms.bioBox}>
                <Text style={ms.bioLabel}>À propos</Text>
                <Text style={ms.bioText}>{staff.bio}</Text>
              </View>
            ) : null}

            {/* CTA buttons */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: EDGE, marginTop: 24 }}>
              {/* Message — outlined */}
              <TouchableOpacity
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 14, borderRadius: 14,
                  borderWidth: 1.5, borderColor: BLUE,
                  backgroundColor: 'rgba(26,159,227,0.07)',
                }}
                activeOpacity={0.8}
                onPress={onClose}
              >
                <Text style={{ fontSize: 14 }}>✉</Text>
                <Text style={{ color: BLUE, fontSize: 14, fontWeight: '700' }}>Message</Text>
              </TouchableOpacity>

              {/* Invite — filled */}
              <TouchableOpacity
                style={{
                  flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 14, borderRadius: 14,
                  backgroundColor: BLUE,
                  shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                }}
                activeOpacity={0.82}
                onPress={onClose}
              >
                <Ionicons name="calendar-outline" size={16} color={BG}/>
                <Text style={{ color: BG, fontSize: 14, fontWeight: '800' }}>Inviter à un événement</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Top border accent */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(26,159,227,0.25)' }}/>
        </View>
      </View>
    </Modal>
  );
});

const ms = StyleSheet.create({
  overlay    : { flex: 1, backgroundColor: 'rgba(5,14,27,0.85)', justifyContent: 'flex-end' },
  sheet      : { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '90%', backgroundColor: NAVY },
  closeBtn   : { position: 'absolute', top: 16, right: 18, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: FAINT, alignItems: 'center', justifyContent: 'center' },
  statsRow   : { flexDirection: 'row', marginHorizontal: EDGE, borderRadius: 16, backgroundColor: FAINT, paddingVertical: 18, borderWidth: 1, borderColor: 'rgba(26,159,227,0.10)' },
  statItem   : { flex: 1, alignItems: 'center', gap: 4 },
  statValue  : { fontSize: 20, fontWeight: '800', color: WHITE },
  statLabel  : { fontSize: 11, color: MUTED, fontWeight: '500' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  bioBox     : { marginHorizontal: EDGE, marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: FAINT, borderWidth: 1, borderColor: 'rgba(26,159,227,0.10)', gap: 8 },
  bioLabel   : { fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  bioText    : { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 20 },
});

/* ─── Staff Card (available) ─────────────────────────────────────────────── */
const StaffCard = memo(function StaffCard({ staff, index, onPress }: {
  staff: StaffRow; index: number; onPress: () => void;
}) {
  const enter  = useRef(new Animated.Value(0)).current;
  const press  = useRef(new Animated.Value(1)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const roles = Array.isArray(staff.role) ? staff.role : [];
  const isAvailable = staff.is_available !== false;

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        { scale: press },
      ],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        style={[sc.card, { backgroundColor: NAVY, borderColor: T.border }]}
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start()}
        activeOpacity={1}
      >
        <LinearGradient colors={[`${BLUE}0B`, `${BLUE}03`]} style={StyleSheet.absoluteFillObject}/>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {/* Avatar */}
          {staff.avatar_url && !imgErr ? (
            <Image
              source={{ uri: staff.avatar_url }}
              style={sc.avatar}
              resizeMode="cover"
              onError={() => setImgErr(true)}
            />
          ) : (
            <Avatar name={staff.display_name} size={52} bg="rgba(26,159,227,0.18)"/>
          )}

          <View style={{ flex: 1, gap: 4 }}>
            {/* Name + availability dot */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[sc.name, { color: WHITE }]} numberOfLines={1}>{staff.display_name}</Text>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isAvailable ? SUCCESS : MUTED }}/>
            </View>

            {/* Stars */}
            {staff.rating != null && <StarRating rating={staff.rating} size={13}/>}

            {/* Role chips */}
            {roles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, flexDirection: 'row' }}>
                {roles.slice(0, 3).map((r, i) => (
                  <View key={i} style={[sc.tag, { backgroundColor: 'rgba(26,159,227,0.12)', borderColor: T.borderHi }]}>
                    <Text style={[sc.tagTxt, { color: BLUE }]}>{r}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Meta info */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              {staff.missions_count != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="briefcase-outline" size={11} color={MUTED}/>
                  <Text style={{ fontSize: 11, color: MUTED }}>{staff.missions_count} missions</Text>
                </View>
              )}
              {staff.experience_years != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={11} color={MUTED}/>
                  <Text style={{ fontSize: 11, color: MUTED }}>{staff.experience_years} ans exp.</Text>
                </View>
              )}
              {staff.hourly_rate != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: GOLD, fontWeight: '600' }}>{staff.hourly_rate}€/h</Text>
                </View>
              )}
            </View>
          </View>

          {/* View profile button */}
          <TouchableOpacity style={sc.recruitBtn} onPress={onPress} activeOpacity={0.8}>
            <Text style={sc.recruitTxt}>Voir</Text>
          </TouchableOpacity>
        </View>

        {/* Bio preview */}
        {staff.bio ? (
          <Text style={[sc.bio, { color: T.offWhite, borderTopColor: T.border }]} numberOfLines={2}>
            {staff.bio}
          </Text>
        ) : null}

        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }}/>
      </TouchableOpacity>
    </Animated.View>
  );
});

const sc = StyleSheet.create({
  card      : { borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, overflow: 'hidden',
                shadowColor: BLUE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  avatar    : { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  name      : { fontSize: 15, fontWeight: '700', flex: 1 },
  tag       : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagTxt    : { fontSize: 10, fontWeight: '600' },
  bio       : { fontSize: 12, lineHeight: 17, borderTopWidth: 1, paddingTop: 8 },
  recruitBtn: { backgroundColor: BLUE, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                shadowColor: BLUE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  recruitTxt: { color: BG, fontSize: 11, fontWeight: '800' },
});

/* ─── Engaged Staff Card ─────────────────────────────────────────────────── */
const EngagedCard = memo(function EngagedCard({ staff, index, onPress }: {
  staff: EngagedStaff; index: number; onPress: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const missionStatus   = staff.mission_status;
  const statusColor     = missionStatus === 'paid' ? SUCCESS : missionStatus === 'pending' ? WARNING : BLUE;
  const statusLabel     = missionStatus === 'paid' ? 'Payé' : missionStatus === 'pending' ? 'En attente' : 'En cours';

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        style={[ec.card, { backgroundColor: NAVY, borderColor: T.border, overflow: 'hidden' }]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <LinearGradient colors={[`${BLUE}0B`, `${BLUE}03`]} style={StyleSheet.absoluteFillObject}/>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {staff.avatar_url && !imgErr ? (
            <Image source={{ uri: staff.avatar_url }} style={ec.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
          ) : (
            <Avatar name={staff.display_name} size={46} bg="rgba(26,159,227,0.18)"/>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[ec.name, { color: WHITE }]} numberOfLines={1}>{staff.display_name}</Text>
            <Text style={{ color: BLUE, fontSize: 11, fontWeight: '600' }}>{staff.role_title}</Text>
            <Text style={{ color: T.offWhite, fontSize: 11 }} numberOfLines={1}>{staff.event_title}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: `${statusColor}12` }}>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
            </View>
            {staff.rating != null && <StarRating rating={staff.rating} size={12}/>}
          </View>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }}/>
      </TouchableOpacity>
    </Animated.View>
  );
});

const ec = StyleSheet.create({
  card  : { borderRadius: 14, padding: 14, borderWidth: 1,
            shadowColor: BLUE, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
  name  : { fontSize: 14, fontWeight: '700' },
});

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
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <Animated.View key={i} style={{ height: 100, borderRadius: 14, backgroundColor: NAVY, opacity: op }}/>
      ))}
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function StaffScreen() {
  const router = useRouter();

  const [availableStaff, setAvailableStaff] = useState<StaffRow[]>([]);
  const [engagedStaff,   setEngagedStaff]   = useState<EngagedStaff[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [tab,            setTab]            = useState<Tab>('available');
  const [search,         setSearch]         = useState('');
  const [searchFocus,    setSearchFocus]    = useState(false);
  const [selectedStaff,  setSelectedStaff]  = useState<StaffRow | null>(null);
  const [modalVisible,   setModalVisible]   = useState(false);

  const openProfile = useCallback((staff: StaffRow) => {
    setSelectedStaff(staff);
    setModalVisible(true);
  }, []);

  const closeProfile = useCallback(() => {
    setModalVisible(false);
    // Small delay so modal slides out before clearing data
    setTimeout(() => setSelectedStaff(null), 400);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const uid = await getWorkingUid();
      if (!uid) return;

      const { data: staffData } = await supabase
        .from('staff')
        .select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio,hourly_rate,is_available')
        .order('rating', { ascending: false })
        .limit(50);
      setAvailableStaff((staffData ?? []) as StaffRow[]);

      const { data: evts } = await supabase
        .from('events')
        .select('id,title,date_start')
        .eq('organizer_id', uid);

      if (evts?.length) {
        const evtIds = evts.map((e: { id: string; title: string; date_start: string }) => e.id);
        const evtMap = Object.fromEntries(
          evts.map((e: { id: string; title: string; date_start: string }) => [e.id, e])
        );

        const { data: rolesData } = await supabase
          .from('event_roles')
          .select('id,event_id,role')
          .in('event_id', evtIds);

        const roleIds = (rolesData ?? []).map((r: { id: string; event_id: string; role: string }) => r.id);
        const roleMap = Object.fromEntries(
          (rolesData ?? []).map((r: { id: string; event_id: string; role: string }) => [r.id, r])
        );

        if (roleIds.length) {
          const { data: apps } = await supabase
            .from('applications')
            .select('id,event_role_id,staff_id,status')
            .in('event_role_id', roleIds)
            .in('status', ['accepted', 'pending']);

          if (apps?.length) {
            const staffIds = [...new Set(
              apps
                .map((a: { id: string; event_role_id: string; staff_id: string; status: string }) => a.staff_id)
                .filter((id: string | null | undefined): id is string => Boolean(id))
            )];

            const { data: staffRows } = staffIds.length
              ? await supabase
                  .from('staff')
                  .select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio,hourly_rate,is_available')
                  .in('id', staffIds)
              : { data: [] };

            const sm = Object.fromEntries(
              (staffRows ?? []).map((s: StaffRow) => [s.id, s])
            );

            const { data: missions } = await supabase
              .from('missions')
              .select('id,staff_id,event_id,payment_status')
              .in('event_id', evtIds);

            const missionsByStaff = Object.fromEntries(
              (missions ?? []).map((m: { id: string; staff_id: string; event_id: string; payment_status: string }) => [m.staff_id, m])
            );

            setEngagedStaff(
              apps.map((a: { id: string; event_role_id: string; staff_id: string; status: string }) => {
                const s  = (sm[a.staff_id] ?? {}) as Partial<StaffRow>;
                const r  = (roleMap[a.event_role_id] ?? {}) as { id: string; event_id: string; role: string };
                const ev = (evtMap[r.event_id] ?? {}) as { id: string; title: string; date_start: string };
                const missionEntry = missionsByStaff[a.staff_id] as {
                  id: string; staff_id: string; event_id: string; payment_status: string;
                } | undefined;
                return {
                  id: a.staff_id ?? a.id,
                  display_name: s.display_name ?? 'Staff',
                  avatar_url: s.avatar_url ?? null,
                  role: s.role ?? [],
                  rating: s.rating ?? null,
                  missions_count: s.missions_count ?? null,
                  experience_years: s.experience_years ?? null,
                  bio: s.bio ?? null,
                  hourly_rate: s.hourly_rate ?? null,
                  is_available: s.is_available ?? null,
                  event_title: ev.title ?? '—',
                  event_date: ev.date_start ?? '',
                  mission_status: missionEntry?.payment_status ?? a.status,
                  role_title: r.role ?? '—',
                } satisfies EngagedStaff;
              })
            );
          } else { setEngagedStaff([]); }
        } else { setEngagedStaff([]); }
      } else { setEngagedStaff([]); }
    } catch (e) { console.error('[staff]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const filteredAvailable = useMemo(() => {
    if (!search.trim()) return availableStaff;
    const q = search.toLowerCase();
    return availableStaff.filter(s =>
      s.display_name.toLowerCase().includes(q) ||
      (Array.isArray(s.role) ? s.role.some(r => r.toLowerCase().includes(q)) : false)
    );
  }, [availableStaff, search]);

  const filteredEngaged = useMemo(() => {
    if (!search.trim()) return engagedStaff;
    const q = search.toLowerCase();
    return engagedStaff.filter(s => s.display_name.toLowerCase().includes(q));
  }, [engagedStaff, search]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg/>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: WHITE }}>Staffs</Text>
              <Text style={{ fontSize: 12, color: T.offWhite, marginTop: 2 }}>
                {availableStaff.length} disponibles · {engagedStaff.length} engagés
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: BLUE,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                shadowColor: BLUE, shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
              }}
              onPress={() => router.push('/(organizer)/applications' as never)}
              activeOpacity={0.82}
            >
              <Ionicons name="mail-outline" size={16} color={BG}/>
              <Text style={{ color: BG, fontWeight: '800', fontSize: 13 }}>Candidatures</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[
            { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
            searchFocus
              ? { borderColor: T.borderHi, backgroundColor: 'rgba(26,159,227,0.07)' }
              : { borderColor: T.border, backgroundColor: T.surf },
          ]}>
            <Ionicons name="search-outline" size={16} color={searchFocus ? BLUE : MUTED}/>
            <TextInput
              style={{ flex: 1, fontSize: 14, color: WHITE, padding: 0 }}
              placeholder="Rechercher un staff..."
              placeholderTextColor={MUTED}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={MUTED}/>
              </TouchableOpacity>
            )}
          </View>

          {/* Segment tabs */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: T.surf,
            borderRadius: 10, padding: 3, gap: 3,
            borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
          }}>
            {([
              { key: 'available' as Tab, label: 'Disponibles', count: availableStaff.length },
              { key: 'engaged'   as Tab, label: 'Engagés',     count: engagedStaff.length },
            ]).map(({ key, label, count }) => (
              <TouchableOpacity
                key={key}
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
                  tab === key && {
                    backgroundColor: NAVY,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
                  },
                ]}
                onPress={() => setTab(key)}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: tab === key ? '700' : '600',
                  color: tab === key ? WHITE : MUTED,
                }}>
                  {label}
                </Text>
                {count > 0 && (
                  <View style={{
                    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
                    backgroundColor: tab === key ? 'rgba(26,159,227,0.12)' : T.surf,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tab === key ? BLUE : MUTED }}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── LIST ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={BLUE}
            />
          }
        >
          {loading ? <Skeleton/> : (
            (tab === 'available' ? filteredAvailable : filteredEngaged).length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 80, gap: 16 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: 'rgba(26,159,227,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: T.border,
                }}>
                  <Ionicons name="people-outline" size={32} color={BLUE}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: WHITE }}>
                  {search ? 'Aucun résultat' : tab === 'available' ? 'Aucun staff disponible' : 'Aucun staff engagé'}
                </Text>
                <Text style={{ color: T.offWhite, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {search
                    ? `Aucun résultat pour "${search}"`
                    : tab === 'available'
                    ? 'Les staffs inscrits apparaîtront ici.'
                    : 'Recrutez du staff depuis vos événements.'}
                </Text>
              </View>
            ) : tab === 'available'
              ? filteredAvailable.map((s, i) => (
                  <StaffCard key={s.id} staff={s} index={i} onPress={() => openProfile(s)}/>
                ))
              : filteredEngaged.map((s, i) => (
                  <EngagedCard key={`${s.id}_${i}`} staff={s} index={i} onPress={() => openProfile(s)}/>
                ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── PROFILE MODAL ── */}
      <StaffProfileModal
        staff={selectedStaff}
        visible={modalVisible}
        onClose={closeProfile}
      />
    </View>
  );
}
