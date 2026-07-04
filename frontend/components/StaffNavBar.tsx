/**
 * components/StaffNavBar.tsx — EVENTURE staff
 * 4 sections max, thème sombre (cohérent avec les écrans staff) :
 * Accueil · Plannings · Alertes · Profil
 * Badge rouge = notifications non lues (in_app_notifications, staff_id).
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentStaffId } from '@/services/api';
import { AURA } from '@/constants/aura-theme';

const ACTIVE   = AURA.secondary;
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
  { key: 'dashboard', label: 'Accueil',   icon: 'home-outline',          iconActive: 'home',          route: '/(staff)/dashboard', match: ['/dashboard'] },
  { key: 'planning',  label: 'Plannings', icon: 'calendar-outline',      iconActive: 'calendar',      route: '/(staff)/planning',  match: ['/planning']  },
  { key: 'alerts',    label: 'Alertes',   icon: 'notifications-outline', iconActive: 'notifications', route: '/(shared)/notifications', match: ['/notifications'] },
  { key: 'profile',   label: 'Profil',    icon: 'person-outline',        iconActive: 'person',        route: '/(staff)/profile',   match: ['/profile']    },
];

const TabItem = memo(function TabItem({
  tab, active, badge, onPress,
}: { tab: TabDef; active: boolean; badge?: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start();

  return (
    <TouchableOpacity style={ns.tab} activeOpacity={1}
      onPress={() => { onPressIn(); setTimeout(() => { onPressOut(); onPress(); }, 60); }}>
      <Animated.View style={[ns.tabInner, { transform: [{ scale }] }]}>
        {active && <View style={ns.activeDot} />}
        <View style={active ? ns.iconWrapActive : ns.iconWrap}>
          <Ionicons name={active ? tab.iconActive : tab.icon} size={22} color={active ? ACTIVE : INACTIVE} />
          {(badge ?? 0) > 0 && (
            <View style={ns.badge}>
              <Text style={ns.badgeTxt}>{(badge ?? 0) > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[ns.label, active && ns.labelActive]} numberOfLines={1}>{tab.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

function StaffNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [staffId, setStaffId] = useState<string | null>(null);

  const loadUnread = useCallback(async (id: string) => {
    try {
      const { count } = await supabase
        .from('in_app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', id).eq('read', false);
      setUnread(count ?? 0);
    } catch { setUnread(0); }
  }, []);

  useEffect(() => {
    let alive = true;
    getCurrentStaffId().then(id => {
      if (!alive) return;
      setStaffId(id);
      if (id) loadUnread(id);
    });
    return () => { alive = false; };
  }, [loadUnread]);

  useEffect(() => {
    if (!staffId) return;
    const ch = supabase
      .channel(`staffnav_${staffId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'in_app_notifications', filter: `staff_id=eq.${staffId}` },
        () => loadUnread(staffId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [staffId, loadUnread]);

  const go = useCallback((path: string) => { try { router.push(path as any); } catch {} }, [router]);
  const isActive = (tab: TabDef) => tab.match.some(m => pathname.includes(m));

  return (
    <View style={ns.bar}>
      <BlurView intensity={Platform.OS === 'ios' ? 50 : 25} tint="dark" style={ns.blur}>
        {TABS.map(tab => (
          <TabItem
            key={tab.key}
            tab={tab}
            active={isActive(tab)}
            badge={tab.key === 'alerts' ? unread : undefined}
            onPress={() => go(tab.route)}
          />
        ))}
      </BlurView>
    </View>
  );
}

export default memo(StaffNavBar);

const ns = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 82 : 66,
    overflow: 'hidden', borderTopWidth: 1, borderTopColor: AURA.border,
  },
  blur: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start',
    paddingTop: 8, paddingHorizontal: 4, backgroundColor: 'rgba(10,12,16,0.88)',
  },
  tab: { flex: 1, alignItems: 'center' },
  tabInner: { alignItems: 'center', gap: 2, paddingTop: 2 },
  activeDot: { position: 'absolute', top: -8, width: 24, height: 3, borderRadius: 2, backgroundColor: ACTIVE },
  iconWrap: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, position: 'relative' },
  iconWrapActive: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: AURA.secondaryGhost, position: 'relative' },
  label: { fontSize: 10, fontWeight: '500', color: INACTIVE, letterSpacing: 0.1 },
  labelActive: { color: ACTIVE, fontWeight: '700' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: AURA.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: AURA.bg },
  badgeTxt: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
});
