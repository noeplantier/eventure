/**
 * notifications.tsx — Real-time notification center
 * Shows staff availability changes live for Arik (Put.in Coffee, Sanur Bali)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }          from 'expo-blur';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import { useRouter }         from 'expo-router';
import { supabase }          from '@/lib/supabase';
import AppHeader             from '@/components/AppHeader';

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const BG     = '#020818';
const NAVY   = '#030B1E';
const WHITE  = '#FFFFFF';
const GLASS  = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.10)';
const DIM    = 'rgba(255,255,255,0.35)';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface AvailEvent {
  id          : string;
  staff_id    : string;
  is_available: boolean;
  date        : string;
  time_start? : string | null;
  time_end?   : string | null;
  created_at  : string;
  staff?      : { display_name: string } | null;
}

type FilterType = 'all' | 'available' | 'unavailable';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return 'À l\'instant';
  if (s < 3600)  return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}j`;
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long',
    });
  } catch {
    return iso;
  }
};

/* ── NotificationItem ───────────────────────────────────────────────────────── */
function NotificationItem({ item }: { item: AvailEvent }) {
  const staffName = item.staff?.display_name ?? 'Inconnu';

  return (
    <View style={styles.card}>
      {/* Avatar initials */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{staffName[0]?.toUpperCase() ?? '?'}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.name}>{staffName}</Text>
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.statusText}>
          {item.is_available ? 'Disponible' : 'Indisponible'} · {fmtDate(item.date)}
        </Text>
        {item.time_start ? (
          <Text style={styles.timeRange}>{item.time_start} → {item.time_end}</Text>
        ) : null}
      </View>

      {/* Status dot */}
      <View style={[
        styles.statusDot,
        { backgroundColor: item.is_available ? WHITE : 'rgba(255,255,255,0.25)' },
      ]} />
    </View>
  );
}

/* ── FilterTabs ─────────────────────────────────────────────────────────────── */
function FilterTabs({
  active,
  onChange,
}: {
  active  : FilterType;
  onChange: (f: FilterType) => void;
}) {
  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all',         label: 'Tous' },
    { key: 'available',   label: 'Disponible' },
    { key: 'unavailable', label: 'Indisponible' },
  ];

  return (
    <View style={styles.filterRow}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              styles.filterPill,
              isActive ? styles.filterPillActive : styles.filterPillInactive,
            ]}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.filterText,
              isActive ? styles.filterTextActive : styles.filterTextInactive,
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.20)" />
      <Text style={styles.emptyTitle}>Aucune activité</Text>
      <Text style={styles.emptySubtitle}>
        Les mises à jour de disponibilité apparaissent ici en temps réel.
      </Text>
    </View>
  );
}

/* ── Main Screen ────────────────────────────────────────────────────────────── */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState<FilterType>('all');
  const [notifs, setNotifs] = useState<AvailEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('availability_events')
        .select('*, staff:staff_id(display_name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'available')   query = query.eq('is_available', true);
      if (filter === 'unavailable') query = query.eq('is_available', false);

      const { data } = await query;
      if (data) setNotifs(data as AvailEvent[]);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('notifs_page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'availability_events' },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[BG, NAVY, BG]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <AppHeader
        title="Notifications"
        subtitle="Temps réel · Put.in Coffee"
        showBack={true}
      />

      {/* Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={WHITE} size="small" />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            notifs.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <NotificationItem item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  /* Filter tabs */
  filterRow: {
    flexDirection   : 'row',
    gap             : 8,
    paddingHorizontal: 16,
    paddingVertical : 14,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical  : 8,
    borderRadius     : 20,
    borderWidth      : 1,
  },
  filterPillActive: {
    backgroundColor: WHITE,
    borderColor    : WHITE,
  },
  filterPillInactive: {
    backgroundColor: GLASS,
    borderColor    : BORDER,
  },
  filterText: {
    fontSize  : 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: BG,
  },
  filterTextInactive: {
    color: WHITE,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom    : 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  /* Card */
  card: {
    flexDirection  : 'row',
    gap            : 14,
    padding        : 16,
    backgroundColor: GLASS,
    borderRadius   : 16,
    borderWidth    : 1,
    borderColor    : BORDER,
    alignItems     : 'flex-start',
  },

  /* Avatar */
  avatar: {
    width          : 44,
    height         : 44,
    borderRadius   : 22,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems     : 'center',
    justifyContent : 'center',
    borderWidth    : 1,
    borderColor    : BORDER,
  },
  avatarText: {
    color     : WHITE,
    fontSize  : 16,
    fontWeight: '800',
  },

  /* Content */
  name: {
    color     : WHITE,
    fontSize  : 15,
    fontWeight: '700',
  },
  timeAgo: {
    color   : DIM,
    fontSize: 11,
  },
  statusText: {
    color    : WHITE,
    fontSize : 13,
    marginTop: 2,
  },
  timeRange: {
    color    : DIM,
    fontSize : 12,
    marginTop: 2,
  },

  /* Status dot */
  statusDot: {
    width       : 10,
    height      : 10,
    borderRadius: 5,
    marginTop   : 4,
  },

  /* Loader */
  loaderContainer: {
    flex          : 1,
    alignItems    : 'center',
    justifyContent: 'center',
  },

  /* Empty state */
  emptyContainer: {
    flex          : 1,
    alignItems    : 'center',
    justifyContent: 'center',
    gap           : 16,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color     : WHITE,
    fontSize  : 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color    : DIM,
    fontSize : 14,
    textAlign: 'center',
  },
});
