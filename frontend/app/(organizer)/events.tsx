/**
 * app/(organizer)/events.tsx — EVENTURE v3 · Liste des Événements
 * Dark futuristic theme — gradient covers, filter chips, stats row, map view
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, FlatList, Image, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }            from 'expo-linear-gradient';
import { Ionicons }                  from '@expo/vector-icons';
import { useSafeAreaInsets }         from 'react-native-safe-area-context';
import { useRouter }                 from 'expo-router';
// react-native-maps is native-only — lazy require prevents web bundle crash
const RNMaps = Platform.OS !== 'web' ? require('react-native-maps') : null;
const MapView: any         = RNMaps?.default ?? View;
const Marker: any          = RNMaps?.Marker ?? (() => null);
const PROVIDER_DEFAULT: any = RNMaps?.PROVIDER_DEFAULT ?? null;
import * as Location from 'expo-location';
import { supabase }                  from '@/lib/supabase';
import { getWorkingOrganizerId }     from '@/lib/mockUser';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const BG    = '#020818';
const NAVY  = 'rgba(255,255,255,0.06)';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.40)';
const FAINT = 'rgba(255,255,255,0.06)';
const EDGE  = 18;

/* ─── Map style ──────────────────────────────────────────────────────────── */
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A1628' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8BAFC9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#030B1E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0C2A4A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A1628' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#030B1E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/* ─── Event-type colours (gradient covers) — navy + white only ─────────── */
const TYPE_COLORS: Record<string, [string, string]> = {
  'Techno':     ['#010610', '#020818'],
  'House':      ['#020818', 'rgba(255,255,255,0.12)'],
  'Rock':       ['#010610', 'rgba(255,255,255,0.08)'],
  'Festival':   ['#020818', 'rgba(255,255,255,0.15)'],
  'Gala':       ['#010610', 'rgba(255,255,255,0.10)'],
  'Conférence': ['#020818', 'rgba(255,255,255,0.10)'],
  'Bar Night':  ['#010610', 'rgba(255,255,255,0.12)'],
};
const DEFAULT_COLORS: [string, string] = ['#010610', '#020818'];

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Techno':     'flash-outline',
  'House':      'musical-notes-outline',
  'Rock':       'musical-note-outline',
  'Festival':   'ribbon-outline',
  'Gala':       'sparkles-outline',
  'Conférence': 'mic-outline',
};

/* ─── Status badge config (blanc + bleu uniquement) ─────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  published : { label: 'PUBLIÉ',    color: WHITE,                    bg: 'rgba(255,255,255,0.07)' },
  draft     : { label: 'BROUILLON', color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.07)' },
  ongoing   : { label: 'EN COURS',  color: WHITE,                    bg: 'rgba(255,255,255,0.06)' },
  completed : { label: 'TERMINÉ',   color: 'rgba(255,255,255,0.60)', bg: 'rgba(255,255,255,0.08)' },
  cancelled : { label: 'ANNULÉ',    color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.05)' },
};

/* ─── Filter chips ───────────────────────────────────────────────────────── */
const FILTERS = ['Tous', 'Bar Night', 'Techno', 'House', 'Rock', 'Festival', 'Gala', 'Conférence', 'Publié', 'Brouillon'];

/* ─── Types ──────────────────────────────────────────────────────────────── */
type EventStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';

interface Event {
  id: string;
  organizer_id: string;
  title: string;
  type: string;
  date_start: string;
  date_end: string;
  location: string;
  budget: number;
  description: string;
  status: EventStatus;
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

/* ─── Region helper ──────────────────────────────────────────────────────── */
function computeRegionFromEvents(events: Event[]): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  const valid = events.filter(e => e.latitude != null && e.longitude != null);
  if (valid.length === 0) return null;
  if (valid.length === 1) return { latitude: valid[0].latitude!, longitude: valid[0].longitude!, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const lats = valid.map(e => e.latitude!);
  const lngs = valid.map(e => e.longitude!);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padding = 1.4;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.05),
  };
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
    const date = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(d);
    const time = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
    const capDay = day.charAt(0).toUpperCase() + day.slice(1).replace('.', '');
    return `${capDay} ${date}, ${time.replace(':', 'h')}`;
  } catch {
    return iso;
  }
}

function formatBudget(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' €';
}

/* ─── Particle Background ────────────────────────────────────────────────── */
const NUM_P = 28;
const PARTS = Array.from({ length: NUM_P }, (_, i) => ({
  x: (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
  y: (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
  s: 1.5 + (i % 5) * 0.6,
  d: 2000 + (i % 7) * 800,
}));

const ParticleBg = memo(function ParticleBg() {
  const op = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.35, duration: 2800, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.15, duration: 2800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      {PARTS.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%` as any,
            top:  `${p.y}%` as any,
            width: p.s, height: p.s, borderRadius: p.s / 2,
            backgroundColor: 'rgba(255,255,255,0.30)',
            opacity: op,
          }}
        />
      ))}
    </View>
  );
});

/* ─── Skeleton Card ──────────────────────────────────────────────────────── */
const SkeletonCard = memo(function SkeletonCard() {
  const a = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.6, duration: 750, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[sk.card, { opacity: a }]}>
      <View style={sk.banner}/>
      <View style={sk.body}>
        <View style={sk.line1}/>
        <View style={sk.line2}/>
        <View style={sk.line3}/>
      </View>
    </Animated.View>
  );
});
const sk = StyleSheet.create({
  card  : { marginHorizontal: EDGE, marginBottom: 16, borderRadius: 20, overflow: 'hidden',
             backgroundColor: 'rgba(255,255,255,0.06)',
             borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', height: 200 },
  banner: { height: 100, backgroundColor: 'rgba(255,255,255,0.07)' },
  body  : { padding: 14, gap: 10 },
  line1 : { height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', width: '70%' },
  line2 : { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', width: '50%' },
  line3 : { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', width: '40%' },
});

/* ─── Event Card ─────────────────────────────────────────────────────────── */
interface EventCardProps {
  event: Event;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}
const EventCard = memo(function EventCard({ event, onEdit, onView }: EventCardProps) {
  const colors     = TYPE_COLORS[event.type] ?? DEFAULT_COLORS;
  const iconName   = TYPE_ICONS[event.type]  ?? 'calendar-outline';
  const status     = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft;

  return (
    <View style={ec.card}>
      {/* ── Banner ── */}
      <View style={ec.banner}>
        {event.cover_url ? (
          <Image
            source={{ uri: event.cover_url }}
            style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Type icon — only when no cover image */}
        {!event.cover_url && (
          <Ionicons name={iconName} size={40} color="white" style={ec.typeIcon}/>
        )}
        {/* Status badge */}
        <View style={[ec.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[ec.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {/* Type label */}
        <View style={ec.typeLabel}>
          <Text style={ec.typeLabelText}>{event.type || 'Événement'}</Text>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={ec.content}>
        <Text style={ec.title} numberOfLines={1}>{event.title}</Text>

        <View style={ec.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={MUTED}/>
          <Text style={ec.metaText}>{formatEventDate(event.date_start)}</Text>
        </View>

        <View style={ec.metaRow}>
          <Ionicons name="location-outline" size={12} color={MUTED}/>
          <Text style={ec.metaText} numberOfLines={1}>{event.location || '—'}</Text>
        </View>

        <View style={ec.footer}>
          <Text style={ec.budget}>{formatBudget(event.budget ?? 0)}</Text>
          <View style={ec.actions}>
            <TouchableOpacity
              style={[ec.actionBtn, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' }]}
              onPress={() => onEdit(event.id)}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={12} color={WHITE}/>
              <Text style={[ec.actionText, { color: WHITE }]}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ec.actionBtn, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' }]}
              onPress={() => onView(event.id)}
              activeOpacity={0.75}
            >
              <Ionicons name="eye-outline" size={12} color={WHITE}/>
              <Text style={[ec.actionText, { color: WHITE }]}>Voir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
});
const ec = StyleSheet.create({
  card      : { marginHorizontal: EDGE, marginBottom: 16, borderRadius: 20, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  banner    : { height: 100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  typeIcon  : { textAlign: 'center' },
  statusBadge: { position: 'absolute', top: 10, left: 10,
                 paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeLabel : { position: 'absolute', top: 10, right: 10,
                backgroundColor: 'rgba(0,0,0,0.35)',
                paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  typeLabelText: { fontSize: 10, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },
  content   : { padding: 14, gap: 6 },
  title     : { fontSize: 17, fontWeight: '800', color: WHITE, letterSpacing: -0.3, marginBottom: 2 },
  metaRow   : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText  : { fontSize: 12, color: WHITE, fontWeight: '500', flex: 1 },
  footer    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  budget    : { fontSize: 15, fontWeight: '900', color: WHITE },
  actions   : { flexDirection: 'row', gap: 8 },
  actionBtn : { flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  actionText: { fontSize: 11, fontWeight: '700' },
});

/* ─── Empty state ────────────────────────────────────────────────────────── */
interface EmptyStateProps { onCreate: () => void }
const EmptyState = memo(function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <View style={es.wrap}>
      <Ionicons name="calendar-outline" size={64} color={WHITE}/>
      <Text style={es.title}>Aucun événement</Text>
      <Text style={es.sub}>Créez votre premier événement</Text>
      <TouchableOpacity style={es.btn} onPress={onCreate} activeOpacity={0.8}>
        <LinearGradient
          colors={['#FFFFFF', 'rgba(255,255,255,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[es.btnText, { color: '#020818' }]}>+ Créer</Text>
      </TouchableOpacity>
    </View>
  );
});
const es = StyleSheet.create({
  wrap  : { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  title : { fontSize: 22, fontWeight: '900', color: WHITE },
  sub   : { fontSize: 14, color: WHITE, fontWeight: '500' },
  btn   : { marginTop: 12, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
             overflow: 'hidden',
             shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 4 },
             shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  btnText: { color: WHITE, fontWeight: '800', fontSize: 15 },
});

/* ─── Stats Row ──────────────────────────────────────────────────────────── */
interface StatsRowProps {
  totalBudget: number;
  upcomingCount: number;
  totalSlots: number;
}
const StatsRow = memo(function StatsRow({ totalBudget, upcomingCount, totalSlots }: StatsRowProps) {
  const chips = [
    { iconName: 'wallet-outline' as const,   value: formatBudget(totalBudget), label: 'Budget total', color: WHITE },
    { iconName: 'calendar-outline' as const, value: String(upcomingCount),     label: 'À venir',      color: WHITE },
    { iconName: 'people-outline' as const,   value: String(totalSlots),        label: 'Postes',       color: WHITE },
  ];
  return (
    <View style={str.row}>
      {chips.map(c => (
        <View key={c.label} style={[str.chip, { borderColor: `${c.color}28` }]}>
          <LinearGradient
            colors={[`${c.color}14`, `${c.color}05`]}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name={c.iconName} size={18} color={c.color} style={{ marginBottom: 2 }}/>
          <Text style={[str.chipValue, { color: c.color }]} numberOfLines={1}>{c.value}</Text>
          <Text style={str.chipLabel}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
});
const str = StyleSheet.create({
  row      : { flexDirection: 'row', gap: 10, paddingHorizontal: EDGE, marginBottom: 14 },
  chip     : { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 3,
               alignItems: 'center', overflow: 'hidden',
               backgroundColor: 'rgba(255,255,255,0.06)' },
  chipValue: { fontSize: 12, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' },
  chipLabel: { fontSize: 9, fontWeight: '600', color: WHITE, textAlign: 'center' },
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function EventsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [events,        setEvents]        = useState<Event[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState('Tous');
  const [totalSlots,    setTotalSlots]    = useState(0);
  const [viewMode,      setViewMode]      = useState<'list' | 'map'>('list');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const PUTINCOFFEE_REGION = {
    latitude: -8.71674, longitude: 115.26249,
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  };
  const [userRegion,    setUserRegion]    = useState(PUTINCOFFEE_REGION);

  /* ── Location permission — only used as fallback when no event has coords ── */
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then(loc => {
          // Only fall back to user GPS when there are no events with coordinates
          setUserRegion(prev => {
            const hasEventRegion = computeRegionFromEvents(events) !== null;
            if (hasEventRegion) return prev;
            return {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
          });
        }).catch(() => {});
      }
    });
  }, [events]);

  /* ── Fetch ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const orgId = await getWorkingOrganizerId();
      if (!orgId) return;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', orgId)
        .order('date_start', { ascending: true });

      if (error) { console.error('[events] fetch', error); }
      else {
        setEvents((data ?? []) as Event[]);
        const region = computeRegionFromEvents((data ?? []) as Event[]);
        // Fall back to Put.in Coffee Sanur when no events have coordinates
        setUserRegion(region ?? {
          latitude: -8.71674, longitude: 115.26249,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        });
      }

      /* Fetch total slots from event_roles */
      if (data && data.length > 0) {
        const evtIds = data.map((e: any) => e.id);
        const { data: roles } = await supabase
          .from('event_roles')
          .select('slots_available')
          .in('event_id', evtIds);
        const slots = (roles ?? []).reduce((s: number, r: any) => s + (Number(r.slots_available) || 0), 0);
        setTotalSlots(slots);
      }
    } catch (e) {
      console.error('[events]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('events_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_roles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived stats ── */
  const totalBudget   = events.reduce((s, e) => s + (Number(e.budget) || 0), 0);
  const upcomingCount = events.filter(e => e.status === 'published').length;

  /* ── Filter ── */
  const filtered = events.filter(e => {
    if (filter === 'Tous')      return true;
    if (filter === 'Publié')    return e.status === 'published';
    if (filter === 'Brouillon') return e.status === 'draft';
    if (filter === 'Bar Night') return e.type === 'Bar Night' || (e as any).venue_type === 'bar';
    return e.type === filter;
  });

  /* ── Handlers ── */
  const handleCreate = useCallback(() => {
    router.push('/(organizer)/create-event' as any);
  }, [router]);

  const handleEdit = useCallback((id: string) => {
    router.push({ pathname: '/(organizer)/create-event' as any, params: { eventId: id } });
  }, [router]);

  const handleView = useCallback((id: string) => {
    router.push({ pathname: '/(organizer)/event/[id]', params: { id } } as any);
  }, [router]);

  /* ── View mode toggle ── */
  const ViewToggle = (
    <View style={{
      flexDirection: 'row', marginHorizontal: EDGE, marginBottom: 12,
      backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 3, gap: 0,
    }}>
      {(['list', 'map'] as const).map(mode => (
        <TouchableOpacity
          key={mode}
          onPress={() => setViewMode(mode)}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 8, borderRadius: 12, gap: 6,
            backgroundColor: viewMode === mode ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={mode === 'list' ? 'list-outline' : 'map-outline'}
            size={15}
            color={viewMode === mode ? '#020818' : 'rgba(255,255,255,0.45)'}
          />
          <Text style={{
            color: viewMode === mode ? '#020818' : WHITE,
            fontSize: 13, fontWeight: '600',
          }}>
            {mode === 'list' ? 'Liste' : 'Carte'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /* ── List header (view toggle + filter chips + stats) ── */
  const ListHeader = (
    <>
      {/* View mode toggle */}
      {ViewToggle}

      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ backgroundColor: BG, flexGrow: 1, paddingHorizontal: EDGE, gap: 8, paddingBottom: 14 }}
        style={{ backgroundColor: BG, marginBottom: 4 }}
      >
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                fc.chip,
                active
                  ? { backgroundColor: '#FFFFFF' }
                  : { backgroundColor: FAINT },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[fc.chipText, { color: active ? '#020818' : WHITE }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stats row */}
      <StatsRow
        totalBudget={totalBudget}
        upcomingCount={upcomingCount}
        totalSlots={totalSlots}
      />
    </>
  );

  /* ── Map header (view toggle + filter chips only, no stats) ── */
  const MapHeader = (
    <>
      {/* View mode toggle */}
      {ViewToggle}

      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ backgroundColor: BG, flexGrow: 1, paddingHorizontal: EDGE, gap: 8, paddingBottom: 14 }}
        style={{ backgroundColor: BG, marginBottom: 4 }}
      >
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                fc.chip,
                active
                  ? { backgroundColor: '#FFFFFF' }
                  : { backgroundColor: FAINT },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[fc.chipText, { color: active ? '#020818' : WHITE }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG}/>
      <ParticleBg/>

      {/* ── Top bar ── */}
      <View style={[ds.topBar, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={ds.pageTitle}>Mes Événements</Text>
          <Text style={ds.subtitle}>
            {loading ? '…' : `${filtered.length} événement${filtered.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity style={ds.addBtn} onPress={handleCreate} activeOpacity={0.8}>
          <LinearGradient
            colors={['#FFFFFF', 'rgba(255,255,255,0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="add" size={24} color="#020818"/>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={{ paddingTop: 16 }}>
          <View style={{ paddingTop: 14 }}>
            {ViewToggle}
          </View>
          {[0, 1, 2].map(i => <SkeletonCard key={i}/>)}
        </View>
      ) : viewMode === 'map' ? (
        <View style={{ flex: 1, backgroundColor: BG }}>
          {/* Map header controls */}
          <View style={{ paddingTop: 14, backgroundColor: BG }}>
            {MapHeader}
          </View>

          {/* Map */}
          <View style={{ flex: 1, backgroundColor: BG }}>
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_DEFAULT}
              initialRegion={userRegion}
              region={userRegion}
              userInterfaceStyle="dark"
              customMapStyle={mapStyle}
              showsUserLocation
              showsCompass={false}
              showsScale={false}
            >
              {filtered.filter(e => e.latitude && e.longitude).map(event => {
                const isBar    = event.type === 'Bar Night' || (event as any).venue_type === 'bar';
                const markerIcon = isBar ? 'wine-outline' : event.type === 'Festival' ? 'ribbon-outline' : event.type === 'Gala' ? 'sparkles-outline' : 'musical-notes-outline';
                return (
                  <Marker
                    key={event.id}
                    coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}
                    onPress={() => setSelectedEvent(event)}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2, borderColor: 'rgba(2,8,24,0.85)',
                        shadowColor: '#FFFFFF', shadowOpacity: 0.4, shadowRadius: 8,
                        shadowOffset: { width: 0, height: 0 },
                      }}>
                        <Ionicons name={markerIcon as any} size={18} color="#020818"/>
                      </View>
                      <View style={{
                        backgroundColor: 'rgba(2,8,24,0.85)', borderRadius: 6,
                        paddingHorizontal: 6, paddingVertical: 2, marginTop: 3,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                      }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }} numberOfLines={1}>
                          {event.title.length > 14 ? event.title.slice(0, 13) + '…' : event.title}
                        </Text>
                      </View>
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* Selected event bottom sheet */}
            {selectedEvent && (
              <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(5,14,27,0.95)',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                padding: 20, paddingBottom: insets.bottom + 24,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: WHITE, fontSize: 18, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {selectedEvent.title}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                    <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: WHITE, fontSize: 13, marginBottom: 4 }}>
                  {selectedEvent.location}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '600' }}>
                  {new Date(selectedEvent.date_start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: selectedEvent.id } } as any)}
                  style={{
                    marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 14,
                    padding: 14, alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#020818', fontWeight: '700', fontSize: 15 }}>Voir les détails</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onEdit={handleEdit} onView={handleView}/>
          )}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<EmptyState onCreate={handleCreate}/>}
          contentContainerStyle={{
            backgroundColor: BG,
            paddingTop: 14,
            paddingBottom: insets.bottom + 120,
            flexGrow: 1,
          }}
          style={{ flex: 1, backgroundColor: BG }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={WHITE}
            />
          }
        />
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ds = StyleSheet.create({
  topBar   : { paddingHorizontal: EDGE, paddingBottom: 14,
               borderBottomWidth: StyleSheet.hairlineWidth,
               borderBottomColor: 'rgba(255,255,255,0.05)',
               flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               zIndex: 10 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: WHITE, letterSpacing: -0.5 },
  subtitle : { fontSize: 12, color: WHITE, fontWeight: '500', marginTop: 2 },
  addBtn   : { width: 42, height: 42, borderRadius: 13, alignItems: 'center',
               justifyContent: 'center', overflow: 'hidden',
               shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 3 },
               shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
});

const fc = StyleSheet.create({
  chip    : { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
