// app/(staff)/dashboard.tsx — Accueil staff : uniquement les missions du jour + actions rapides.
// Volontairement minimaliste : pas de flux, pas de filtres — juste ce qui compte aujourd'hui.
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMyMissions } from '@/hooks/useMyMissions';
import MissionPriorityCard from '@/components/staffing/MissionPriorityCard';

const VIOLET = '#A78BFA';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function fmtToday(): string {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function StaffDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { todayMissions, loading, staffId, refresh, checkIn, checkOut } = useMyMissions();

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!staffId) { setUnread(0); return; }
    supabase.from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId).eq('read', false)
      .then(
        ({ count }) => { if (alive) setUnread(count ?? 0); },
        () => {},
      );
    return () => { alive = false; };
  }, [staffId]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleCheckIn = async (id: string) => { setBusyId(id); await checkIn(id); setBusyId(null); };
  const handleCheckOut = async (id: string) => { setBusyId(id); await checkOut(id); setBusyId(null); };

  const noStaffLink = !loading && !staffId;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35', '#070C17']} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting()}{user?.display_name ? `, ${user.display_name}` : ''}</Text>
            <Text style={s.date}>{fmtToday()}</Text>
          </View>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/(shared)/notifications' as any)}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unread > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(staff)/profile' as any)}>
            <Image source={{ uri: user?.avatar_url || 'https://i.pravatar.cc/72' }} style={s.avatar} contentFit="cover" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={VIOLET} />}
        >
          <Text style={s.sectionTitle}>Mes missions aujourd'hui</Text>

          {noStaffLink && (
            <View style={s.warnCard}>
              <Ionicons name="link-outline" size={22} color="#F59E0B" />
              <Text style={s.warnTxt}>
                Cet appareil n'est lié à aucun profil staff. Connecte-toi pour voir tes missions du jour.
              </Text>
            </View>
          )}

          {!noStaffLink && !loading && todayMissions.length === 0 && (
            <View style={s.emptyCard}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#10B981" />
              <Text style={s.emptyTitle}>Rien de prévu aujourd'hui</Text>
              <Text style={s.emptySub}>Tu n'as aucune mission planifiée pour le moment.</Text>
            </View>
          )}

          {todayMissions.map(m => (
            <MissionPriorityCard
              key={m.id}
              mission={m}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              busy={busyId === m.id}
            />
          ))}

          <TouchableOpacity style={s.browseLink} onPress={() => router.push('/(staff)/feed' as any)} activeOpacity={0.8}>
            <Ionicons name="search-outline" size={16} color={VIOLET} />
            <Text style={s.browseLinkTxt}>Voir les missions disponibles</Text>
            <Ionicons name="chevron-forward" size={16} color={VIOLET} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  greeting: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  date: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  bellBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  bellBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#0D1A35' },
  bellBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  avatarBtn: { padding: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(167,139,250,0.5)' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.65, marginBottom: 2 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)', borderRadius: 16, padding: 16 },
  warnTxt: { color: '#F59E0B', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 40, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptySub: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  browseLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 4 },
  browseLinkTxt: { color: VIOLET, fontSize: 13, fontWeight: '700' },
});
