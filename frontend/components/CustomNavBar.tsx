/**
 * components/CustomNavBar.tsx — EVENTURE v3
 * 5-tab bottom navigation : Dashboard · Événements · Staffs · Missions · Calendrier
 * Active state détecté via usePathname()
 * Badge candidatures en attente sur l'onglet "Staffs"
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import { supabase }  from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import { AURA } from '@/constants/aura-theme';

let _useRouter: (() => { push: (p: any) => void }) | null = null;
let _usePathname: (() => string) | null = null;
try {
  const er = require('expo-router');
  _useRouter   = er.useRouter;
  _usePathname = er.usePathname;
} catch {}

const PRIMARY  = AURA.primary;
const INACTIVE = AURA.textMuted;

interface TabDef {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconActive: React.ComponentProps<typeof Ionicons>['name'];
  route: string;
  match: string[];
}

const TABS: TabDef[] = [
  {
    key: 'dashboard',
    label: 'Hub',
    icon: 'home-outline',
    iconActive: 'home',
    route: '/(organizer)/dashboard',
    match: ['/dashboard', 'dashboard'],
  },
  {
    key: 'events',
    label: 'Événements',
    icon: 'calendar-outline',
    iconActive: 'calendar',
    route: '/(organizer)/events',
    match: ['/events', 'events'],
  },
  {
    key: 'staff',
    label: 'Staffs',
    icon: 'people-outline',
    iconActive: 'people',
    route: '/(organizer)/staff',
    match: ['/staff', 'staff'],
  },
  {
    key: 'missions',
    label: 'Missions',
    icon: 'clipboard-outline',
    iconActive: 'clipboard',
    route: '/(organizer)/missions',
    match: ['/missions', 'missions'],
  },
  {
    key: 'calendar',
    label: 'Calendrier',
    icon: 'calendar-number-outline',
    iconActive: 'calendar-number',
    route: '/(organizer)/calendar',
    match: ['/calendar', 'calendar'],
  },
];

/* ─── Tab Item ─────────────────────────────────────────────────────────────── */
const TabItem = memo(function TabItem({
  tab, active, badge, onPress,
}: { tab: TabDef; active: boolean; badge?: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

  return (
    <TouchableOpacity
      style={ns.tab}
      onPress={() => { onPressIn(); setTimeout(() => { onPressOut(); onPress(); }, 60); }}
      activeOpacity={1}
    >
      <Animated.View style={[ns.tabInner, { transform: [{ scale }] }]}>
        {/* Active indicator dot */}
        {active && <View style={ns.activeDot}/>}

        {/* Icon container */}
        <View style={active ? ns.iconWrapActive : ns.iconWrap}>
          <Ionicons
            name={active ? tab.iconActive : tab.icon}
            size={22}
            color={active ? PRIMARY : INACTIVE}
          />
          {/* Badge */}
          {(badge ?? 0) > 0 && (
            <View style={ns.badge}>
              <Text style={ns.badgeTxt}>{(badge ?? 0) > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>

        {/* Label */}
        <Text style={[ns.label, active && ns.labelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Inner (needs hooks) ───────────────────────────────────────────────────── */
function CustomNavBarInner() {
  const router   = _useRouter!();
  const pathname = _usePathname ? _usePathname() : '';

  const [pendingN, setPendingN] = useState(0);
  const [uid, setUid]           = useState<string | null>(null);

  const loadPending = useCallback(async (userId: string) => {
    try {
      const { data: evts } = await supabase
        .from('events').select('id')
        .eq('organizer_id', userId).eq('status', 'published');
      if (!evts?.length) { setPendingN(0); return; }
      const evtIds = evts.map((e: any) => e.id);
      const { data: roles } = await supabase
        .from('event_roles').select('id').in('event_id', evtIds);
      if (!roles?.length) { setPendingN(0); return; }
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .in('event_role_id', roles.map((r: any) => r.id))
        .eq('status', 'pending');
      setPendingN(count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    getCurrentOrganizerId().then(organizerId => {
      if (!alive || !organizerId) return;
      setUid(organizerId);
      loadPending(organizerId);
    });
    return () => { alive = false; };
  }, [loadPending]);

  // Realtime: new applications
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`navapp_${Date.now()}_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' },
        () => loadPending(uid))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, loadPending]);

  const go = useCallback((path: string) => {
    try { router.push(path as any); } catch {}
  }, [router]);

  const isActive = (tab: TabDef) =>
    tab.match.some(m => pathname.includes(m));

  return (
    <View style={ns.bar}>
      <BlurView intensity={Platform.OS === 'ios' ? 60 : 25} tint="dark" style={ns.blur}>
        {TABS.map(tab => (
          <TabItem
            key={tab.key}
            tab={tab}
            active={isActive(tab)}
            badge={tab.key === 'staff' ? pendingN : undefined}
            onPress={() => go(tab.route)}
          />
        ))}
      </BlurView>
    </View>
  );
}

/* ─── Export — monté après 1 tick ─────────────────────────────────────────── */
function CustomNavBar() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready || !_useRouter) return null;
  return <CustomNavBarInner/>;
}

export default memo(CustomNavBar);

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ns = StyleSheet.create({
  bar: {
    position:     'absolute',
    bottom:        0,
    left:          0,
    right:         0,
    height:        Platform.OS === 'ios' ? 82 : 66,
    overflow:     'hidden',
    borderTopWidth: 1,
    borderTopColor: AURA.border,
  },
  blur: {
    flex:             1,
    flexDirection:   'row',
    justifyContent:  'space-around',
    alignItems:      'flex-start',
    paddingTop:       8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(10,12,16,0.88)',
  },
  tab: {
    flex:    1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    gap:         2,
    paddingTop:  2,
  },
  activeDot: {
    position:       'absolute',
    top:            -8,
    width:           24,
    height:          3,
    borderRadius:    2,
    backgroundColor: PRIMARY,
  },
  iconWrap: {
    width:          40,
    height:         36,
    alignItems:    'center',
    justifyContent:'center',
    borderRadius:  10,
    position:      'relative',
  },
  iconWrapActive: {
    width:          40,
    height:         36,
    alignItems:    'center',
    justifyContent:'center',
    borderRadius:  10,
    backgroundColor: AURA.primaryGhost,
    position:      'relative',
  },
  label: {
    fontSize:      10,
    fontWeight:   '500',
    color:         INACTIVE,
    letterSpacing: 0.1,
  },
  labelActive: {
    color:      PRIMARY,
    fontWeight:'700',
  },
  badge: {
    position:        'absolute',
    top:              0,
    right:            0,
    minWidth:         15,
    height:           15,
    borderRadius:     8,
    backgroundColor: AURA.danger,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    borderWidth:      1.5,
    borderColor:      AURA.bg,
  },
  badgeTxt: {
    color:      '#FFFFFF',
    fontSize:    8,
    fontWeight: '800',
  },
});
