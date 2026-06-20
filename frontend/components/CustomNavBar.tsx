
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

let _useRouter: (() => { push: (p: any) => void }) | null = null;
let _usePathname: (() => string) | null = null;

try {
  const er = require('expo-router');
  _useRouter = er.useRouter;
  _usePathname = er.usePathname;
} catch {}

const PRIMARY = '#1A9FE3';
const INACTIVE = '#9CA3AF';

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
    label: 'Profil',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
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

const TabItem = memo(function TabItem({
  tab,
  active,
  badge,
  onPress,
}: {
  tab: TabDef;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.92,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
    ]).start();
  };

  return (
    <TouchableOpacity
      style={styles.tab}
      activeOpacity={1}
      onPress={() => {
        animatePress();
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.tabInner,
          {
            transform: [{ scale }],
          },
        ]}
      >
       

        <View style={active ? styles.iconWrapActive : styles.iconWrap}>
          <Ionicons
            name={active ? tab.iconActive : tab.icon}
            size={active ? 24 : 22}
            color={active ? PRIMARY : INACTIVE}
          />

          {(badge ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>
                {(badge ?? 0) > 9 ? '9+' : badge}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.label,
            active && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

function CustomNavBarInner() {
  const router = _useRouter!();
  const pathname = _usePathname ? _usePathname() : '';

  const [pendingN, setPendingN] = useState(0);
  const [uid, setUid] = useState<string | null>(null);

  const loadPending = useCallback(async (userId: string) => {
    try {
      const { data: evts } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', userId)
        .eq('status', 'published');

      if (!evts?.length) {
        setPendingN(0);
        return;
      }

      const { data: roles } = await supabase
        .from('event_roles')
        .select('id')
        .in(
          'event_id',
          evts.map((e: any) => e.id)
        );

      if (!roles?.length) {
        setPendingN(0);
        return;
      }

      const { count } = await supabase
        .from('applications')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .in(
          'event_role_id',
          roles.map((r: any) => r.id)
        )
        .eq('status', 'pending');

      setPendingN(count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;

      const userId = session?.user?.id;

      if (userId) {
        setUid(userId);
        loadPending(userId);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      const userId = session?.user?.id;

      if (userId) {
        setUid(userId);
        loadPending(userId);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [loadPending]);

  useEffect(() => {
    if (!uid) return;

    const channel = supabase
      .channel(`navbar_${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        () => loadPending(uid)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, loadPending]);

  const go = useCallback(
    (route: string) => {
      try {
        router.push(route as any);
      } catch {}
    },
    [router]
  );

  const isActive = (tab: TabDef) =>
    tab.match.some((m) => pathname.includes(m));

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.bar}>
        <View style={styles.glassOverlay} />

        <BlurView
          intensity={100}
          tint="light"
          style={styles.blur}
        >
          {TABS.map((tab) => (
            <TabItem
              key={tab.key}
              tab={tab}
              active={isActive(tab)}
              badge={
                tab.key === 'staff'
                  ? pendingN
                  : undefined
              }
              onPress={() => go(tab.route)}
            />
          ))}
        </BlurView>
      </View>
    </View>
  );
}

function CustomNavBar() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (!ready || !_useRouter) return null;

  return <CustomNavBarInner />;
}

export default memo(CustomNavBar);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },

  bar: {
    position: 'absolute',

    bottom: Platform.OS === 'ios' ? 26 : 18,

    width: '92%',

    height: 78,

    borderRadius: 30,

    overflow: 'hidden',

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 10,
    },

    shadowOpacity: 0.18,

    shadowRadius: 25,

    elevation: 20,
  },


  blur: {
    flex: 1,

    flexDirection: 'row',

    justifyContent: 'space-around',

    alignItems: 'center',

    borderRadius: 30,

    overflow: 'hidden',

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.18)',

   

    paddingHorizontal: 8,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeDot: {
    position: 'absolute',

    top: -12,

    width: 30,

    height: 4,

    borderRadius: 30,

    backgroundColor: PRIMARY,

    shadowColor: PRIMARY,

    shadowOpacity: 0.8,

    shadowRadius: 12,
  },

  iconWrap: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  iconWrapActive: {
    width: 50,
    height: 50,

    borderRadius: 25,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',

    backgroundColor: 'rgba(26,159,227,0.18)',

    borderWidth: 1,

    borderColor: 'rgba(26,159,227,0.35)',

    shadowColor: PRIMARY,

    shadowOpacity: 0.35,

    shadowRadius: 15,

    elevation: 8,
  },

  label: {
    marginTop: 3,

    fontSize: 10,

    fontWeight: '600',

    color: INACTIVE,

    letterSpacing: 0.3,
  },

  labelActive: {
    color: PRIMARY,
    fontWeight: '800',
  },

  badge: {
    position: 'absolute',

    top: -2,
    right: -4,

    minWidth: 18,
    height: 18,

    borderRadius: 20,

    backgroundColor: '#EF4444',

    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: 4,

    borderWidth: 2,

    borderColor: 'rgba(255,255,255,0.95)',
  },

  badgeTxt: {
    color: '#FFFFFF',

    fontSize: 9,

    fontWeight: '900',
  },
});
