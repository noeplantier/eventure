/**
 * app/(organizer)/events.tsx — EVENTURE v3
 * Gestion multi-événements : liste, search, filter, card actions
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG      = '#F8FAFC';
const PRIMARY = '#6366F1';
const P_LIGHT = '#EEF2FF';
const P_GHOST = 'rgba(99,102,241,0.08)';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER  = '#EF4444';
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
interface EventRow {
  id:         string;
  title:      string;
  date_start: string;
  date_end:   string | null;
  location:   string;
  status:     string;
  type:       string | null;
  budget:     number | null;
}

type FilterTab = 'all' | 'published' | 'draft' | 'done';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: 'Actif',     color: SUCCESS, bg: 'rgba(16,185,129,0.10)' },
  draft:     { label: 'Brouillon', color: WARNING, bg: 'rgba(245,158,11,0.10)' },
  done:      { label: 'Terminé',   color: C.textMuted, bg: C.surfaceAlt },
  cancelled: { label: 'Annulé',    color: DANGER,  bg: 'rgba(239,68,68,0.10)' },
};
const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: '#F59E0B', Conférence: BLUE,
  Mariage: '#EC4899', Séminaire: '#8B5CF6', Concert: DANGER, Sport: SUCCESS,
};

/* ─── Event Card ─────────────────────────────────────────────────────────── */
const EvtCard = memo(function EvtCard({
  evt, index, onPress, onMissions, onStaff,
}: { evt: EventRow; index: number; onPress: () => void; onMissions: () => void; onStaff: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 320,
      delay: Math.min(index * 50, 250),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const onPI = () => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPO = () => Animated.spring(press, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start();

  const cfg  = STATUS_CFG[evt.status] ?? STATUS_CFG.draft;
  const tc   = TYPE_COLORS[evt.type ?? ''] ?? PRIMARY;
  const days = daysUntil(evt.date_start);
  const isPast = days < 0;

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        { scale: press },
      ],
      marginBottom: 12,
    }}>
      <TouchableOpacity
        style={cd.card}
        onPress={onPress} onPressIn={onPI} onPressOut={onPO}
        activeOpacity={1}
      >
        {/* Color bar + gradient */}
        <LinearGradient colors={[`${tc}10`, `${tc}02`]} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}/>
        <View style={[cd.colorBar, { backgroundColor: tc }]}/>

        {/* Header */}
        <View style={cd.row}>
          <View style={[cd.typeIconWrap, { backgroundColor: `${tc}15` }]}>
            <Ionicons name="calendar-outline" size={16} color={tc}/>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={cd.title} numberOfLines={1}>{evt.title}</Text>
            {evt.type && <Text style={[cd.type, { color: tc }]}>{evt.type}</Text>}
          </View>
          <View style={[cd.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[cd.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Meta info */}
        <View style={{ gap: 6 }}>
          <View style={cd.metaRow}>
            <Ionicons name="time-outline" size={13} color={C.textMuted}/>
            <Text style={cd.meta}>
              {fmtDate(evt.date_start)}
              {evt.date_end ? ` → ${fmtDate(evt.date_end)}` : ''}
            </Text>
            {!isPast && (
              <View style={[cd.daysBadge, { backgroundColor: days <= 3 ? 'rgba(239,68,68,0.08)' : days <= 7 ? 'rgba(245,158,11,0.08)' : P_GHOST }]}>
                <Text style={[cd.daysTxt, { color: days <= 3 ? DANGER : days <= 7 ? WARNING : PRIMARY }]}>
                  {days === 0 ? "Auj." : `J-${days}`}
                </Text>
              </View>
            )}
          </View>
          <View style={cd.metaRow}>
            <Ionicons name="location-outline" size={13} color={C.textMuted}/>
            <Text style={cd.meta} numberOfLines={1}>{evt.location}</Text>
          </View>
          {evt.budget != null && evt.budget > 0 && (
            <View style={cd.metaRow}>
              <Ionicons name="cash-outline" size={13} color={C.textMuted}/>
              <Text style={cd.meta}>{evt.budget.toLocaleString('fr-FR')} €</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={cd.divider}/>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[cd.action, cd.actionPrimary]} onPress={onPress} activeOpacity={0.8}>
            <Ionicons name="eye-outline" size={14} color={PRIMARY}/>
            <Text style={[cd.actionTxt, { color: PRIMARY }]}>Détails</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cd.action, cd.actionSecondary]} onPress={onMissions} activeOpacity={0.8}>
            <Ionicons name="clipboard-outline" size={14} color={C.textSub}/>
            <Text style={[cd.actionTxt, { color: C.textSub }]}>Missions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cd.action, cd.actionSecondary]} onPress={onStaff} activeOpacity={0.8}>
            <Ionicons name="people-outline" size={14} color={C.textSub}/>
            <Text style={[cd.actionTxt, { color: C.textSub }]}>Staff</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
const cd = StyleSheet.create({
  card:        { backgroundColor: C.surface, borderRadius: 14, padding: 16, paddingLeft: 20, gap: 12,
                 borderWidth: 1, borderColor: C.border, overflow: 'hidden',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  colorBar:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeIconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:       { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
  type:        { fontSize: 11, fontWeight: '600' },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  badgeTxt:    { fontSize: 10, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta:        { fontSize: 12, color: C.textSub, flex: 1 },
  daysBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  daysTxt:     { fontSize: 10, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: C.border },
  action:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8 },
  actionPrimary:  { backgroundColor: P_GHOST },
  actionSecondary:{ backgroundColor: C.surfaceAlt },
  actionTxt:   { fontSize: 12, fontWeight: '700' },
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
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map(i => (
        <Animated.View key={i} style={{ height: 180, borderRadius: 14, backgroundColor: '#E5E7EB', opacity: op }}/>
      ))}
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function EventsScreen() {
  const router = useRouter();

  const [events,    setEvents]    = useState<EventRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [tab,       setTab]       = useState<FilterTab>('all');
  const [search,    setSearch]    = useState('');
  const [searchFocus,setSearchFocus]=useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const { data } = await supabase
        .from('events')
        .select('id,title,date_start,date_end,location,status,type,budget')
        .eq('organizer_id', uid)
        .order('date_start', { ascending: false });
      setEvents((data ?? []) as EventRow[]);
    } catch (e) { console.error('[events]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // Realtime
  useEffect(() => {
    let alive = true;
    const ch = supabase.channel(`evts_rt_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { if (alive) load(true); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? events : events.filter(e => e.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return list;
  }, [events, tab, search]);

  const counts: Record<FilterTab, number> = {
    all:       events.length,
    published: events.filter(e => e.status === 'published').length,
    draft:     events.filter(e => e.status === 'draft').length,
    done:      events.filter(e => e.status === 'done').length,
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'Tous' },
    { key: 'published', label: 'Actifs' },
    { key: 'draft',     label: 'Brouillons' },
    { key: 'done',      label: 'Terminés' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Événements</Text>
              <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{counts.all} événements</Text>
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

          {/* Search */}
          <View style={[hs.searchWrap, searchFocus && hs.searchFocused]}>
            <Ionicons name="search-outline" size={16} color={searchFocus ? PRIMARY : C.textMuted}/>
            <TextInput
              style={hs.searchInput}
              placeholder="Rechercher un événement..."
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

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[hs.chip, tab === key && hs.chipActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.75}
              >
                <Text style={[hs.chipTxt, tab === key && hs.chipTxtActive]}>{label}</Text>
                {counts[key] > 0 && (
                  <View style={[hs.chipBadge, tab === key && hs.chipBadgeActive]}>
                    <Text style={[hs.chipBadgeTxt, tab === key && { color: PRIMARY }]}>{counts[key]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── LIST ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY}/>}
        >
          {loading ? <Skeleton/> : (
            filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 80, gap: 16 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={32} color={PRIMARY}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
                  {search ? 'Aucun résultat' : 'Aucun événement'}
                </Text>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {search ? `Aucun résultat pour "${search}"` : 'Créez votre premier événement pour démarrer.'}
                </Text>
                {!search && (
                  <TouchableOpacity
                    style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
                             shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    onPress={() => router.push('/(organizer)/create-event' as any)}
                    activeOpacity={0.82}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>+ Créer un événement</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filtered.map((evt, i) => (
                <EvtCard
                  key={evt.id}
                  evt={evt}
                  index={i}
                  onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: evt.id } } as any)}
                  onMissions={() => router.push('/(organizer)/missions' as any)}
                  onStaff={() => router.push('/(organizer)/staff' as any)}
                />
              ))
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const hs = StyleSheet.create({
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface,
                  borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchFocused:{ borderColor: PRIMARY, backgroundColor: P_GHOST },
  searchInput:  { flex: 1, fontSize: 14, color: C.text, padding: 0 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7,
                  borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:   { backgroundColor: P_LIGHT, borderColor: PRIMARY },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTxtActive:{ color: PRIMARY, fontWeight: '700' },
  chipBadge:    { backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  chipBadgeActive:{ backgroundColor: P_LIGHT },
  chipBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.textMuted },
});
