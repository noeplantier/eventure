/**
 * notifications.tsx — Real-time notification center
 * In-app notifications + availability events, unified feed.
 * Put.in Coffee, Sanur Bali
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
const GLASS  = 'rgba(255,255,255,0.07)';
const BORDER = 'rgba(255,255,255,0.12)';
const DIM    = 'rgba(255,255,255,0.45)';
const GREEN  = '#10B981';
const RED    = '#EF4444';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface InAppNotif {
  id         : string;
  staff_id   : string | null;
  event_id   : string | null;
  mission_id : string | null;
  type       : string;
  title      : string;
  body       : string;
  data       : Record<string, any> | null;
  read       : boolean;
  created_at : string;
}

interface AvailEvent {
  id          : string;
  staff_id    : string;
  is_available: boolean;
  date        : string;
  time_start? : string | null;
  time_end?   : string | null;
  created_at  : string;
  staff_name? : string;
  staff?      : { display_name: string } | null;
}

type FilterType = 'all' | 'missions' | 'invitations' | 'disponibilites';

interface UnifiedItem {
  id          : string;
  type        : string;
  title       : string;
  body        : string;
  read        : boolean;
  data?       : Record<string, any> | null;
  is_available?: boolean;
  _source     : 'notif' | 'avail';
  _time       : string;
  _staffName  : string;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const timeAgo = (iso: string): string => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "A l'instant";
  if (s < 3600)  return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}j`;
};

/* ── typeConfig ─────────────────────────────────────────────────────────────── */
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TypeCfg { icon: IoniconName; color: string }

function getTypeCfg(item: UnifiedItem): TypeCfg {
  const map: Record<string, TypeCfg> = {
    mission_assigned: { icon: 'briefcase-outline',      color: WHITE },
    invitation:       { icon: 'person-add-outline',     color: WHITE },
    payroll_approved: { icon: 'cash-outline',           color: GREEN },
    email_sent:       { icon: 'mail-outline',           color: WHITE },
    system:           { icon: 'notifications-outline',  color: WHITE },
  };
  if (item.type === 'availability') {
    return {
      icon : item.is_available ? 'checkmark-circle-outline' : 'close-circle-outline',
      color: item.is_available ? GREEN : RED,
    };
  }
  return map[item.type] ?? map.system;
}

/* ── NotifItem ──────────────────────────────────────────────────────────────── */
function NotifItem({ item }: { item: UnifiedItem }) {
  const cfg = getTypeCfg(item);

  return (
    <BlurView
      intensity={14}
      tint="systemUltraThinMaterialDark"
      style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 10 }}
    >
      <View style={[
        styles.card,
        { backgroundColor: item.read ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)' },
        { borderColor: item.read ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)' },
      ]}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.itemTime}>
              {timeAgo(item._time)}
            </Text>
          </View>
          {!!item.body && (
            <Text style={styles.itemBody} numberOfLines={2}>
              {item.body}
            </Text>
          )}
        </View>

        {/* Unread dot */}
        {!item.read && (
          <View style={styles.unreadDot} />
        )}
      </View>
    </BlurView>
  );
}

/* ── FilterTabs ─────────────────────────────────────────────────────────────── */
function FilterTabs({ active, onChange }: { active: FilterType; onChange: (f: FilterType) => void }) {
  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all',            label: 'Tous' },
    { key: 'missions',       label: 'Missions' },
    { key: 'invitations',    label: 'Invitations' },
    { key: 'disponibilites', label: 'Disponibilités' },
  ];

  return (
    <View style={styles.filterRow}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.filterPill, isActive ? styles.filterPillActive : styles.filterPillInactive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, isActive ? styles.filterTextActive : styles.filterTextInactive]}>
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
      <Text style={styles.emptyTitle}>Aucune notification</Text>
      <Text style={styles.emptySubtitle}>
        Les notifications apparaissent ici en temps réel.
      </Text>
    </View>
  );
}

/* ── Quick Actions ──────────────────────────────────────────────────────────── */
function QuickActions() {
  const openWhatsApp = async () => {
    const msg      = encodeURIComponent("Bonjour l'équipe ! Message de Put.in Coffee.");
    const url      = `whatsapp://send?phone=33666167788&text=${msg}`;
    const fallback = `https://wa.me/33666167788?text=${msg}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : fallback);
    } catch {
      await Linking.openURL(fallback);
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent(`Eventure — Résumé ${new Date().toLocaleDateString('fr-FR')}`);
    const body    = encodeURIComponent('Bonjour,\n\nVoici le résumé de Put.in Coffee.\n\nCordialement,\nEventure');
    Linking.openURL(`mailto:plantiernoe50@gmail.com?subject=${subject}&body=${body}`);
  };

  return (
    <View style={styles.actionsWrap}>
      <Text style={styles.actionsLabel}>ACTIONS RAPIDES</Text>

      {/* WhatsApp broadcast */}
      <TouchableOpacity onPress={openWhatsApp} style={styles.actionRow} activeOpacity={0.8}>
        <View style={styles.actionIcon}>
          <Ionicons name="logo-whatsapp" size={20} color={WHITE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>WhatsApp équipe</Text>
          <Text style={styles.actionSubtitle}>Ouvre WhatsApp vers +33 6 66 16 77 88</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
      </TouchableOpacity>

      {/* Email summary */}
      <TouchableOpacity onPress={openEmail} style={styles.actionRow} activeOpacity={0.8}>
        <View style={styles.actionIcon}>
          <Ionicons name="mail-outline" size={20} color={WHITE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Email résumé</Text>
          <Text style={styles.actionSubtitle}>Ouvre Mail vers plantiernoe50@gmail.com</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
      </TouchableOpacity>
    </View>
  );
}

/* ── Main Screen ────────────────────────────────────────────────────────────── */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notifs, setNotifs]         = useState<InAppNotif[]>([]);
  const [availEvents, setAvailEvents] = useState<AvailEvent[]>([]);
  const [filter, setFilter]         = useState<FilterType>('all');
  const [loading, setLoading]       = useState(true);
  const [unread, setUnread]         = useState(0);

  /* Mark all as read on mount */
  useEffect(() => {
    supabase
      .from('in_app_notifications')
      .update({ read: true })
      .eq('read', false)
      .then(() => {});
  }, []);

  /* Load in_app_notifications */
  const loadNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('in_app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) {
      setNotifs(data as InAppNotif[]);
      setUnread((data as InAppNotif[]).filter(n => !n.read).length);
    }
  }, []);

  /* Load availability_events */
  const loadAvail = useCallback(async () => {
    const { data } = await supabase
      .from('availability_events')
      .select('*, staff:staff_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(40);
    if (data) setAvailEvents(data as AvailEvent[]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadNotifs(), loadAvail()]);
    setLoading(false);
  }, [loadNotifs, loadAvail]);

  /* Initial load + realtime subscriptions */
  useEffect(() => {
    loadAll();

    const ch = supabase
      .channel('notifications_page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'in_app_notifications' },
        () => loadNotifs(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'availability_events' },
        () => loadAvail(),
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadAll, loadNotifs, loadAvail]);

  /* Merge + filter */
  const merged = useMemo<UnifiedItem[]>(() => {
    const fromNotifs: UnifiedItem[] = notifs.map(n => ({
      id        : n.id,
      type      : n.type,
      title     : n.title,
      body      : n.body ?? '',
      read      : n.read,
      data      : n.data,
      _source   : 'notif' as const,
      _time     : n.created_at,
      _staffName: (n.data as any)?.staff_name ?? 'Équipe',
    }));

    const fromAvail: UnifiedItem[] = availEvents.map(a => {
      const name = (a.staff as any)?.display_name ?? a.staff_name ?? 'Staff';
      const dateStr = new Date(a.date).toLocaleDateString('fr-FR');
      const timeStr = [a.time_start, a.time_end ? `→ ${a.time_end}` : ''].filter(Boolean).join(' ');
      return {
        id          : a.id,
        type        : 'availability',
        title       : `${name} — ${a.is_available ? 'Disponible' : 'Indisponible'}`,
        body        : `Le ${dateStr}${timeStr ? ` · ${timeStr}` : ''}`.trim(),
        read        : false,
        is_available: a.is_available,
        _source     : 'avail' as const,
        _time       : a.created_at,
        _staffName  : name,
      };
    });

    const all = [...fromNotifs, ...fromAvail].sort(
      (a, b) => new Date(b._time).getTime() - new Date(a._time).getTime()
    );

    if (filter === 'missions')       return all.filter(n => n.type === 'mission_assigned');
    if (filter === 'invitations')    return all.filter(n => n.type === 'invitation');
    if (filter === 'disponibilites') return all.filter(n => n.type === 'availability');
    return all;
  }, [notifs, availEvents, filter]);

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
        subtitle={unread > 0 ? `${unread} non lu${unread > 1 ? 'es' : 'e'}` : 'Put.in Coffee'}
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
          data={merged}
          keyExtractor={item => `${item._source}-${item.id}`}
          contentContainerStyle={[
            styles.listContent,
            merged.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <NotifItem item={item} />}
          ListFooterComponent={<QuickActions />}
        />
      )}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex           : 1,
    backgroundColor: BG,
  },

  /* Filter */
  filterRow: {
    flexDirection    : 'row',
    gap              : 8,
    paddingHorizontal: 16,
    paddingVertical  : 14,
  },
  filterPill: {
    paddingHorizontal: 14,
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
    paddingBottom    : 32,
  },
  listContentEmpty: {
    flex: 1,
  },

  /* Card */
  card: {
    borderRadius  : 18,
    borderWidth   : StyleSheet.hairlineWidth,
    padding       : 16,
    flexDirection : 'row',
    gap           : 14,
    alignItems    : 'flex-start',
  },

  /* Icon */
  iconWrap: {
    width          : 44,
    height         : 44,
    borderRadius   : 22,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems     : 'center',
    justifyContent : 'center',
    borderWidth    : 1,
    borderColor    : 'rgba(255,255,255,0.15)',
    flexShrink     : 0,
  },

  /* Item text */
  itemTitle: {
    color     : WHITE,
    fontSize  : 14,
    fontWeight: '700',
    flex      : 1,
  },
  itemTime: {
    color      : 'rgba(255,255,255,0.40)',
    fontSize   : 11,
    marginLeft : 8,
    flexShrink : 0,
  },
  itemBody: {
    color     : 'rgba(255,255,255,0.55)',
    fontSize  : 12,
    lineHeight: 17,
  },

  /* Unread dot */
  unreadDot: {
    width          : 8,
    height         : 8,
    borderRadius   : 4,
    backgroundColor: WHITE,
    marginTop      : 4,
    flexShrink     : 0,
  },

  /* Loader */
  loaderContainer: {
    flex          : 1,
    alignItems    : 'center',
    justifyContent: 'center',
  },

  /* Empty state */
  emptyContainer: {
    flex             : 1,
    alignItems       : 'center',
    justifyContent   : 'center',
    gap              : 16,
    paddingHorizontal: 32,
    paddingTop       : 80,
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

  /* Quick actions */
  actionsWrap: {
    paddingHorizontal: 0,
    marginTop        : 8,
    gap              : 10,
    paddingBottom    : 60,
  },
  actionsLabel: {
    color        : DIM,
    fontSize     : 10,
    fontWeight   : '700',
    letterSpacing: 1,
    marginBottom : 4,
  },
  actionRow: {
    flexDirection  : 'row',
    gap            : 12,
    backgroundColor: GLASS,
    borderRadius   : 16,
    padding        : 16,
    alignItems     : 'center',
    borderWidth    : StyleSheet.hairlineWidth,
    borderColor    : BORDER,
  },
  actionIcon: {
    width          : 40,
    height         : 40,
    borderRadius   : 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems     : 'center',
    justifyContent : 'center',
  },
  actionTitle: {
    color     : WHITE,
    fontSize  : 14,
    fontWeight: '700',
  },
  actionSubtitle: {
    color    : DIM,
    fontSize : 12,
    marginTop: 1,
  },
});
