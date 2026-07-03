/**
 * app/(organizer)/staff.tsx — EVENTURE v3
 * Gestion du staff : disponibles · engagés · inviter
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const BG      = '#F8FAFC';
const PRIMARY = '#6366F1';
const P_LIGHT = '#EEF2FF';
const P_GHOST = 'rgba(99,102,241,0.08)';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER  = '#EF4444';
const PURPLE  = '#8B5CF6';
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
interface StaffRow {
  id:               string;
  display_name:     string;
  avatar_url:       string | null;
  role:             string[];
  rating:           number | null;
  missions_count:   number | null;
  experience_years: number | null;
  bio:              string | null;
}
interface EngagedStaff extends StaffRow {
  event_title: string;
  event_date:  string;
  mission_status: string;
  role_title:  string;
}

type Tab = 'available' | 'engaged';

/* ─── Star Rating ────────────────────────────────────────────────────────── */
const StarRating = memo(({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= full ? 'star' : 'star-outline'} size={11} color={i <= full ? WARNING : C.textMuted}/>
      ))}
      <Text style={{ color: C.textSub, fontSize: 11, marginLeft: 3 }}>{rating.toFixed(1)}</Text>
    </View>
  );
});

/* ─── Staff Card (available) ─────────────────────────────────────────────── */
const StaffCard = memo(function StaffCard({
  staff, index, onPress,
}: { staff: StaffRow; index: number; onPress: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const init  = staff.display_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roles = Array.isArray(staff.role) ? staff.role : [];

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: press }],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        style={sc.card}
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start()}
        activeOpacity={1}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {/* Avatar */}
          {staff.avatar_url && !imgErr
            ? <Image source={{ uri: staff.avatar_url }} style={sc.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[sc.avatar, sc.avatarFb]}><Text style={sc.init}>{init}</Text></View>
          }

          {/* Info */}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={sc.name} numberOfLines={1}>{staff.display_name}</Text>
            {staff.rating != null && <StarRating rating={staff.rating}/>}
            {/* Role tags */}
            {roles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, flexDirection: 'row' }}>
                {roles.slice(0, 3).map((r, i) => (
                  <View key={i} style={sc.tag}>
                    <Text style={sc.tagTxt}>{r}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              {staff.missions_count != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="briefcase-outline" size={11} color={C.textMuted}/>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{staff.missions_count} missions</Text>
                </View>
              )}
              {staff.experience_years != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={11} color={C.textMuted}/>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{staff.experience_years}ans exp.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Action */}
          <TouchableOpacity
            style={sc.recruitBtn}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={sc.recruitTxt}>Recruter</Text>
          </TouchableOpacity>
        </View>

        {staff.bio ? (
          <Text style={sc.bio} numberOfLines={2}>{staff.bio}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
});
const sc = StyleSheet.create({
  card:      { backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 10,
               borderWidth: 1, borderColor: C.border,
               shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  avatar:    { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  avatarFb:  { backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  init:      { color: PRIMARY, fontSize: 18, fontWeight: '800' },
  name:      { fontSize: 15, fontWeight: '700', color: C.text },
  tag:       { backgroundColor: P_GHOST, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  tagTxt:    { fontSize: 10, fontWeight: '600', color: PRIMARY },
  bio:       { fontSize: 12, color: C.textSub, lineHeight: 17, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  recruitBtn:{ backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
               shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  recruitTxt:{ color: '#FFF', fontSize: 11, fontWeight: '700' },
});

/* ─── Engaged Staff Card ─────────────────────────────────────────────────── */
const EngagedCard = memo(function EngagedCard({ staff, index }: { staff: EngagedStaff; index: number }) {
  const enter = useRef(new Animated.Value(0)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const init = staff.display_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const ms   = staff.mission_status;
  const statusColor = ms === 'paid' ? SUCCESS : ms === 'pending' ? WARNING : PRIMARY;
  const statusLabel = ms === 'paid' ? 'Payé' : ms === 'pending' ? 'En attente' : 'En cours';

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      marginBottom: 10,
    }}>
      <View style={ec2.card}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {staff.avatar_url && !imgErr
            ? <Image source={{ uri: staff.avatar_url }} style={ec2.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[ec2.avatar, ec2.avatarFb]}><Text style={ec2.init}>{init}</Text></View>
          }
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ec2.name} numberOfLines={1}>{staff.display_name}</Text>
            <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '600' }}>{staff.role_title}</Text>
            <Text style={{ color: C.textSub, fontSize: 11 }} numberOfLines={1}>{staff.event_title}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: `${statusColor}12` }}>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
            </View>
            {staff.rating != null && <StarRating rating={staff.rating}/>}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});
const ec2 = StyleSheet.create({
  card:    { backgroundColor: C.surface, borderRadius: 14, padding: 14,
             borderWidth: 1, borderColor: C.border,
             shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  avatar:  { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
  avatarFb:{ backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  init:    { color: PRIMARY, fontSize: 16, fontWeight: '800' },
  name:    { fontSize: 14, fontWeight: '700', color: C.text },
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
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <Animated.View key={i} style={{ height: 100, borderRadius: 14, backgroundColor: '#E5E7EB', opacity: op }}/>
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const uid = await getCurrentOrganizerId();

      // Get all staff (available pool) — not organizer-scoped, loads regardless
      const { data: staffData } = await supabase
        .from('staff')
        .select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio')
        .order('rating', { ascending: false })
        .limit(50);
      setAvailableStaff((staffData ?? []) as StaffRow[]);

      if (!uid) { setEngagedStaff([]); return; }

      // Get engaged staff (accepted applications for my events)
      const { data: evts } = await supabase
        .from('events').select('id,title,date_start').eq('organizer_id', uid);
      if (evts?.length) {
        const evtIds = evts.map((e: any) => e.id);
        const evtMap = Object.fromEntries(evts.map((e: any) => [e.id, e]));

        const { data: roles } = await supabase
          .from('event_roles').select('id,event_id,role').in('event_id', evtIds);
        const roleIds = (roles ?? []).map((r: any) => r.id);
        const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.id, r]));

        if (roleIds.length) {
          const { data: apps } = await supabase
            .from('applications')
            .select('id,event_role_id,staff_id,status')
            .in('event_role_id', roleIds)
            .in('status', ['accepted', 'pending']);

          if (apps?.length) {
            const staffIds = [...new Set(apps.map((a: any) => a.staff_id).filter(Boolean))];
            const { data: staffRows } = staffIds.length
              ? await supabase.from('staff').select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio').in('id', staffIds)
              : { data: [] };
            const sm = Object.fromEntries((staffRows ?? []).map((s: any) => [s.id, s]));

            // Get missions for status
            const { data: missions } = await supabase
              .from('missions').select('id,staff_id,event_id,payment_status').in('event_id', evtIds);
            const missionsByStaff = Object.fromEntries((missions ?? []).map((m: any) => [m.staff_id, m]));

            setEngagedStaff(apps.map((a: any) => {
              const s   = sm[a.staff_id] ?? {};
              const r   = roleMap[a.event_role_id] ?? {};
              const ev  = evtMap[r.event_id] ?? {};
              const ms  = missionsByStaff[a.staff_id];
              return {
                ...s, id: a.staff_id ?? a.id,
                display_name: s.display_name ?? 'Staff',
                event_title:  ev.title ?? '—',
                event_date:   ev.date_start ?? '',
                mission_status: ms?.payment_status ?? a.status,
                role_title:   r.role ?? '—',
              };
            }));
          } else {
            setEngagedStaff([]);
          }
        } else {
          setEngagedStaff([]);
        }
      } else {
        setEngagedStaff([]);
      }
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

  const current = tab === 'available' ? filteredAvailable : filteredEngaged;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Staffs</Text>
              <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
                {availableStaff.length} disponibles · {engagedStaff.length} engagés
              </Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                       shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
              onPress={() => router.push('/(organizer)/applications' as any)}
              activeOpacity={0.82}
            >
              <Ionicons name="mail-outline" size={16} color="#FFF"/>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Candidatures</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[sh.searchWrap, searchFocus && sh.searchFocused]}>
            <Ionicons name="search-outline" size={16} color={searchFocus ? PRIMARY : C.textMuted}/>
            <TextInput
              style={sh.searchInput}
              placeholder="Rechercher un staff..."
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={C.textMuted}/>
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 3, gap: 3 }}>
            {([
              { key: 'available' as Tab, label: 'Disponibles', count: availableStaff.length },
              { key: 'engaged'   as Tab, label: 'Engagés',     count: engagedStaff.length },
            ]).map(({ key, label, count }) => (
              <TouchableOpacity
                key={key}
                style={[sh.segBtn, tab === key && sh.segBtnActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.8}
              >
                <Text style={[sh.segTxt, tab === key && sh.segTxtActive]}>{label}</Text>
                {count > 0 && (
                  <View style={[sh.segBadge, tab === key && sh.segBadgeActive]}>
                    <Text style={[sh.segBadgeTxt, tab === key && { color: PRIMARY }]}>{count}</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY}/>}
        >
          {loading ? <Skeleton/> : (
            current.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 80, gap: 16 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people-outline" size={32} color={PRIMARY}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
                  {search ? 'Aucun résultat' : tab === 'available' ? 'Aucun staff disponible' : 'Aucun staff engagé'}
                </Text>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {search
                    ? `Aucun résultat pour "${search}"`
                    : tab === 'available'
                    ? 'Les staffs inscrits apparaîtront ici.'
                    : 'Recrutez du staff depuis vos événements.'}
                </Text>
              </View>
            ) : tab === 'available'
              ? filteredAvailable.map((s, i) => (
                  <StaffCard key={s.id} staff={s} index={i} onPress={() => router.push('/(organizer)/applications' as any)}/>
                ))
              : filteredEngaged.map((s, i) => (
                  <EngagedCard key={`${s.id}_${i}`} staff={s} index={i}/>
                ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const sh = StyleSheet.create({
  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface,
                   borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchFocused: { borderColor: PRIMARY, backgroundColor: P_GHOST },
  searchInput:   { flex: 1, fontSize: 14, color: C.text, padding: 0 },
  segBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  segBtnActive:  { backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segTxt:        { fontSize: 13, fontWeight: '600', color: C.textMuted },
  segTxtActive:  { color: C.text, fontWeight: '700' },
  segBadge:      { backgroundColor: C.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  segBadgeActive:{ backgroundColor: P_LIGHT },
  segBadgeTxt:   { fontSize: 10, fontWeight: '700', color: C.textMuted },
});
