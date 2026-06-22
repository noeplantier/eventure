/**
 * CustomNavBar — Apple iOS 26 Liquid Glass floating tab bar
 * 5 tabs: Hub / Events / Staff / Missions / Planning
 * Full-width, pinned to bottom, BlurView glass, safe-area aware.
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }            from 'expo-blur';
import { Ionicons }            from '@expo/vector-icons';
import { useSafeAreaInsets }   from 'react-native-safe-area-context';
import { supabase }            from '@/lib/supabase';
import { getWorkingUid }       from '@/lib/mockUser';

/* ── Lazy expo-router (avoids crash outside router context) ─────────────── */
let _useRouter  : (() => { replace: (p: any) => void; push: (p: any) => void }) | null = null;
let _usePathname: (() => string) | null = null;
try {
  const er      = require('expo-router');
  _useRouter    = er.useRouter;
  _usePathname  = er.usePathname;
} catch {}

/* ── Design tokens ──────────────────────────────────────────────────────── */
const WHITE     = '#FFFFFF';

/* ── Tab definitions ────────────────────────────────────────────────────── */
interface TabDef {
  name       : string;
  label      : string;
  icon       : React.ComponentProps<typeof Ionicons>['name'];
  iconActive : React.ComponentProps<typeof Ionicons>['name'];
  route      : string;
  match      : string[];
}

const TABS: TabDef[] = [
  {
    name: 'dashboard', label: 'Hub',
    icon: 'grid-outline', iconActive: 'grid',
    route: '/(organizer)/dashboard', match: ['dashboard'],
  },
  {
    name: 'events', label: 'Events',
    icon: 'calendar-outline', iconActive: 'calendar',
    route: '/(organizer)/events', match: ['events'],
  },
  {
    name: 'staff', label: 'Staff',
    icon: 'people-outline', iconActive: 'people',
    route: '/(organizer)/staff', match: ['staff'],
  },
  {
    name: 'payroll', label: 'Paie',
    icon: 'cash-outline', iconActive: 'cash',
    route: '/(organizer)/payroll', match: ['payroll'],
  },
  {
    name: 'calendar', label: 'Planning',
    icon: 'time-outline', iconActive: 'time',
    route: '/(organizer)/calendar', match: ['calendar'],
  },
] as const;

/* ── TabItem ────────────────────────────────────────────────────────────── */
const TabItem = memo(function TabItem({
  tab,
  active,
  onPress,
}: {
  tab    : TabDef;
  active : boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev  = useRef(active);

  useEffect(() => {
    if (active && !prev.current) {
      // spring pop on activation
      Animated.spring(scale, {
        toValue        : 1.15,
        useNativeDriver: true,
        damping        : 10,
        stiffness      : 200,
      }).start(() =>
        Animated.spring(scale, {
          toValue        : 1,
          useNativeDriver: true,
          damping        : 10,
          stiffness      : 200,
        }).start()
      );
    }
    prev.current = active;
  }, [active]);

  const handlePress = () => {
    if (!active) {
      // small bounce on any tap
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, damping: 8, stiffness: 300 }),
        Animated.spring(scale, { toValue: 1,   useNativeDriver: true, damping: 8, stiffness: 300 }),
      ]).start();
    }
    if (Platform.OS !== 'web') {
      try {
        const H = require('expo-haptics');
        H.impactAsync(H.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.tab}
      activeOpacity={1}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.tabInner,
          active && styles.tabInnerActive,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={(active ? tab.iconActive : tab.icon) as any}
          size={22}
          color={WHITE}
        />
        <Text style={[styles.label, active && styles.labelActive]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ── Main navbar inner (needs router context) ───────────────────────────── */
function CustomNavBarInner() {
  const router   = _useRouter!();
  const pathname = _usePathname ? _usePathname() : '';
  const insets   = useSafeAreaInsets();

  const [uid,      setUid]      = useState<string | null>(null);
  // (badge state kept for future use — not rendered to keep design clean)
  const [_pending, setPending]  = useState(0);

  const loadPending = useCallback(async (userId: string) => {
    try {
      const { data: evts } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', userId);
      if (!evts?.length) return setPending(0);

      const { data: roles } = await supabase
        .from('event_roles')
        .select('id')
        .in('event_id', evts.map((e: any) => e.id));
      if (!roles?.length) return setPending(0);

      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .in('event_role_id', roles.map((r: any) => r.id))
        .eq('status', 'pending');
      setPending(count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    getWorkingUid().then(u => {
      if (!alive || !u) return;
      setUid(u);
      loadPending(u);
    });
    return () => { alive = false; };
  }, [loadPending]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`navbar_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => loadPending(uid))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, loadPending]);

  const isActive = (tab: TabDef) => tab.match.some(m => pathname.includes(m));

  const go = useCallback((route: string) => {
    try { router.replace(route as any); } catch {
      try { router.push(route as any); } catch {}
    }
  }, [router]);

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <BlurView
        intensity={50}
        tint="systemUltraThinMaterialDark"
        style={styles.blur}
      >
        <View
          style={[
            styles.tabRow,
            {
              paddingBottom   : insets.bottom + 8,
              borderTopWidth  : StyleSheet.hairlineWidth,
              borderTopColor  : 'rgba(255,255,255,0.15)',
            },
          ]}
        >
          {TABS.map(tab => (
            <TabItem
              key={tab.name}
              tab={tab}
              active={isActive(tab)}
              onPress={() => go(tab.route)}
            />
          ))}
        </View>
      </BlurView>
    </View>
  );
}

/* ── Public component (deferred mount until router is ready) ────────────── */
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

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  wrapper: {
    position : 'absolute',
    bottom   : 0,
    left     : 0,
    right    : 0,
    zIndex   : 100,
  },
  blur: {
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection  : 'row',
    paddingTop     : 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex           : 1,
    alignItems     : 'center',
    justifyContent : 'center',
  },
  tabInner: {
    alignItems     : 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius   : 14,
    backgroundColor: 'transparent',
  },
  tabInnerActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    color     : WHITE,
    fontSize  : 10,
    fontWeight: '500',
    marginTop : 3,
  },
  labelActive: {
    color     : WHITE,
    fontWeight: '700',
  },
});
