import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { BlurView }     from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }     from '@expo/vector-icons';
import { supabase }     from '@/lib/supabase';
import { getWorkingUid } from '@/lib/mockUser';

let _useRouter: (() => { push: (p: any) => void }) | null = null;
let _usePathname: (() => string) | null = null;
try {
  const er = require('expo-router');
  _useRouter   = er.useRouter;
  _usePathname = er.usePathname;
} catch {}

/* ── Design tokens ── */
const BG      = '#050E1B';
const BLUE    = '#1A9FE3';
const INACTIVE = 'rgba(255,255,255,0.38)';
const GLASS_BG = 'rgba(5,14,27,0.78)';
const GLASS_BORDER = 'rgba(255,255,255,0.16)';
const GLASS_SHEEN  = ['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.02)', 'transparent'] as const;

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
    key: 'dashboard', label: 'Hub',
    icon: 'home-outline', iconActive: 'home',
    route: '/(organizer)/dashboard', match: ['/dashboard','dashboard'],
  },
  {
    key: 'events', label: 'Events',
    icon: 'calendar-outline', iconActive: 'calendar',
    route: '/(organizer)/events', match: ['/events','events'],
  },
  {
    key: 'staff', label: 'Staff',
    icon: 'people-outline', iconActive: 'people',
    route: '/(organizer)/staff', match: ['/staff','staff'],
  },
  {
    key: 'missions', label: 'Missions',
    icon: 'flash-outline', iconActive: 'flash',
    route: '/(organizer)/missions', match: ['/missions','missions'],
  },
  {
    key: 'calendar', label: 'Agenda',
    icon: 'grid-outline', iconActive: 'grid',
    route: '/(organizer)/calendar', match: ['/calendar','calendar'],
  },
];

/* ── Tab item with liquid-glass active pill ── */
const TabItem = memo(function TabItem({
  tab, active, badge, onPress,
}: {
  tab: TabDef; active: boolean; badge?: number; onPress: () => void;
}) {
  const scale  = useRef(new Animated.Value(1)).current;
  const glow   = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: active ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [active]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 400, friction: 6 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 280, friction: 7 }),
    ]).start();
    if (Platform.OS !== 'web') {
      try {
        const H = require('expo-haptics');
        H.impactAsync(H.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    }
    onPress();
  };

  return (
    <TouchableOpacity style={styles.tab} activeOpacity={1} onPress={handlePress}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {/* Liquid glass active pill */}
        <View style={styles.iconWrap}>
          {active && (
            <View style={StyleSheet.absoluteFill}>
              <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
              <LinearGradient
                colors={['rgba(26,159,227,0.45)', 'rgba(255,255,255,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
              />
              <View style={[StyleSheet.absoluteFill, {
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(26,159,227,0.55)',
              }]} />
              {/* Top sheen line */}
              <View style={{
                position: 'absolute', top: 1, left: 6, right: 6, height: 1,
                backgroundColor: 'rgba(255,255,255,0.35)',
                borderRadius: 1,
              }} />
            </View>
          )}
          <Animated.View style={{ opacity: glow.interpolate({ inputRange:[0,1], outputRange:[0,1] }) }}>
          </Animated.View>
          <Ionicons
            name={active ? tab.iconActive : tab.icon}
            size={active ? 22 : 20}
            color={active ? '#FFFFFF' : INACTIVE}
            style={{ zIndex: 1 }}
          />
        
      
        
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
      
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ── Main navbar ── */
function CustomNavBarInner() {
  const router   = _useRouter!();
  const pathname = _usePathname ? _usePathname() : '';
  const [pendingN, setPendingN] = useState(0);
  const [uid, setUid]           = useState<string | null>(null);

  const loadPending = useCallback(async (userId: string) => {
    try {
      const { data: evts } = await supabase.from('events').select('id').eq('organizer_id', userId);
      if (!evts?.length) return setPendingN(0);
      const { data: roles } = await supabase.from('event_roles').select('id').in('event_id', evts.map((e: any) => e.id));
      if (!roles?.length) return setPendingN(0);
      const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true })
        .in('event_role_id', roles.map((r: any) => r.id)).eq('status', 'pending');
      setPendingN(count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    getWorkingUid().then(uid => {
      if (!alive || !uid) return;
      setUid(uid);
      loadPending(uid);
    });
    return () => { alive = false; };
  }, [loadPending]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`navbar_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => loadPending(uid))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, loadPending]);

  const go = useCallback((route: string) => {
    try { router.push(route as any); } catch {}
  }, [router]);

  const isActive = (tab: TabDef) => tab.match.some(m => pathname.includes(m));

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.bar}>
        {/* Dark glass base */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_BG, borderRadius: 36 }]} />
        {/* Blur layer */}
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 36 }]} />
        {/* Glass gradient sheen */}
        <LinearGradient
          colors={GLASS_SHEEN}
          locations={[0, 0.4, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: 36 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Border ring */}
        <View style={[StyleSheet.absoluteFill, {
          borderRadius: 36, borderWidth: 1,
          borderColor: GLASS_BORDER,
        }]} />
        {/* Top highlight line */}
        <View style={{
          position: 'absolute', top: 0, left: 24, right: 24, height: 1,
          backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1,
        }} />
        {/* Blue bottom glow */}
        <View style={{
          position: 'absolute', bottom: -8, left: '20%', right: '20%', height: 16,
          backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8,
          shadowColor: BLUE, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
        }} />
        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => (
            <TabItem
              key={tab.key}
              tab={tab}
              active={isActive(tab)}
              onPress={() => go(tab.route)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function CustomNavBar() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready || !_useRouter) return null;
  return <CustomNavBarInner />;
}

export default memo(CustomNavBar);

const BAR_H = 74;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', pointerEvents: 'box-none',
  },
  bar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    width: '90%',
    height: BAR_H,
    borderRadius: 36,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 24,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: BAR_H,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: BAR_H,
  },
  tabInner: {
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    marginTop: 2, fontSize: 9.5, fontWeight: '600',
    color: INACTIVE, letterSpacing: 0.2,
  },
  labelActive: {
    color: '#FFFFFF', fontWeight: '800',
  },

 
  badgeTxt: {
    color: '#FFFFFF', fontSize: 8.5, fontWeight: '900',
  },
});
