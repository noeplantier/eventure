/**
 * Staff Management Hub
 * - Affichage du staff recruté par mission
 * - Check-in/Check-out
 * - Paiement
 * - Évaluations
 * - Documents de staff
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image,
  Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/theme';
import { triggerHapticFeedback, createScaleAnimation } from '@/lib/animations';

const { width: SW } = Dimensions.get('window');
const BG = COLORS.background;
const GREEN = COLORS.primary;
const GOLD = COLORS.gold;

interface StaffAssignment {
  id: string;
  staff_id: string;
  mission_id: string;
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'completed';
  check_in_time: string | null;
  check_out_time: string | null;
  staff_name: string;
  staff_avatar: string | null;
  staff_rating: number;
  hourly_rate: number;
  mission_title: string;
  mission_date: string;
}

const T = {
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.50)',
  faint: 'rgba(255,255,255,0.18)',
  navy: '#0A2218',
  success: COLORS.success,
  warning: COLORS.amber,
  error: COLORS.red,
};

// ─── Staff Card with Check-in ──
const StaffCard = memo(function StaffCard({
  staff,
  onCheckIn,
  onCheckOut,
  onRate,
}: {
  staff: StaffAssignment;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onRate: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const scaleRef = useRef(new Animated.Value(1)).current;

  const handlePress = (action: () => void) => {
    triggerHapticFeedback();
    createScaleAnimation(scaleRef, 0.95);
    setTimeout(() => {
      createScaleAnimation(scaleRef, 1);
      action();
    }, 150);
  };

  const statusConfig = {
    scheduled: { label: 'Planifié', color: T.muted, icon: 'calendar-outline' },
    checked_in: { label: 'Arrivé', color: GREEN, icon: 'log-in-outline' },
    checked_out: { label: 'Parti', color: T.warning, icon: 'log-out-outline' },
    completed: { label: 'Terminé', color: T.success, icon: 'checkmark-circle-outline' },
  };

  const cfg = statusConfig[staff.status] || statusConfig.scheduled;
  const init = staff.staff_name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <Animated.View style={{ transform: [{ scale: scaleRef }], marginBottom: 12 }}>
      <View style={{
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: T.navy,
        borderWidth: 1,
        borderColor: `${cfg.color}20`,
        padding: 14,
      }}>
        <LinearGradient
          colors={[`${cfg.color}08`, `${cfg.color}02`]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {staff.staff_avatar && !imgErr ? (
            <Image
              source={{ uri: staff.staff_avatar }}
              style={{ width: 48, height: 48, borderRadius: 12 }}
              onError={() => setImgErr(true)}
            />
          ) : (
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: 'rgba(0,217,126,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: GREEN, fontSize: 16, fontWeight: '900' }}>{init}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: T.white, fontSize: 14, fontWeight: '900' }}>
              {staff.staff_name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="star" size={12} color={GOLD} />
              <Text style={{ color: T.white, fontSize: 12, fontWeight: '700' }}>
                {staff.staff_rating.toFixed(1)}
              </Text>
              <Text style={{ color: T.faint, fontSize: 11 }}>
                · {staff.hourly_rate}€/h
              </Text>
            </View>
          </View>

          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: `${cfg.color}15`,
          }}>
            <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '800' }}>
              {cfg.label}
            </Text>
          </View>
        </View>

        {/* Mission Info */}
        <View style={{
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
          marginBottom: 12,
        }}>
          <Text style={{ color: T.muted, fontSize: 11 }}>
            {staff.mission_title} · {new Date(staff.mission_date).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Check-in/out times */}
        {staff.check_in_time && (
          <View style={{ marginBottom: 12, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="log-in-outline" size={12} color={GREEN} />
              <Text style={{ color: T.white, fontSize: 12 }}>
                Arrivée: {new Date(staff.check_in_time).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {staff.check_out_time && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="log-out-outline" size={12} color={T.warning} />
                <Text style={{ color: T.white, fontSize: 12 }}>
                  Départ: {new Date(staff.check_out_time).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {staff.status === 'scheduled' && (
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: `${GREEN}20`,
              }}
              onPress={() => handlePress(onCheckIn)}
            >
              <Ionicons name="log-in-outline" size={14} color={GREEN} />
              <Text style={{ color: GREEN, fontSize: 12, fontWeight: '800' }}>Check-in</Text>
            </TouchableOpacity>
          )}

          {staff.status === 'checked_in' && (
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: `${T.warning}20`,
              }}
              onPress={() => handlePress(onCheckOut)}
            >
              <Ionicons name="log-out-outline" size={14} color={T.warning} />
              <Text style={{ color: T.warning, fontSize: 12, fontWeight: '800' }}>Check-out</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
            onPress={() => handlePress(onRate)}
          >
            <Ionicons name="star-outline" size={14} color={T.muted} />
            <Text style={{ color: T.white, fontSize: 12, fontWeight: '700' }}>Évaluer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Main Screen ──
export default function StaffManagementScreen() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'checked_in' | 'completed'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch staff assignments
      const { data } = await supabase
        .from('staff_assignments')
        .select(`
          id,
          staff_id,
          mission_id,
          status,
          check_in_time,
          check_out_time,
          staff:staff_id(display_name, avatar_url, rating, hourly_rate),
          mission:mission_id(title, date_start)
        `)
        .order('created_at', { ascending: false });

      if (data) {
        setStaffList(
          (data as any[]).map(item => ({
            id: item.id,
            staff_id: item.staff_id,
            mission_id: item.mission_id,
            status: item.status,
            check_in_time: item.check_in_time,
            check_out_time: item.check_out_time,
            staff_name: item.staff?.display_name || 'Staff',
            staff_avatar: item.staff?.avatar_url,
            staff_rating: item.staff?.rating || 0,
            hourly_rate: item.staff?.hourly_rate || 0,
            mission_title: item.mission?.title || 'Mission',
            mission_date: item.mission?.date_start || new Date().toISOString(),
          }))
        );
      }
    } catch (e) {
      console.error('[staff-management]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const filtered = staffList.filter(s =>
    filter === 'all' ? true : s.status === filter
  );

  const handleCheckIn = async (staffId: string) => {
    try {
      await supabase
        .from('staff_assignments')
        .update({ status: 'checked_in', check_in_time: new Date().toISOString() })
        .eq('staff_id', staffId);
      load(true);
    } catch (e) {
      console.error('[check-in]', e);
    }
  };

  const handleCheckOut = async (staffId: string) => {
    try {
      await supabase
        .from('staff_assignments')
        .update({ status: 'checked_out', check_out_time: new Date().toISOString() })
        .eq('staff_id', staffId);
      load(true);
    } catch (e) {
      console.error('[check-out]', e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: SPACING.screenEdge, paddingVertical: 12 }}>
          <Text style={{ color: T.white, fontSize: 24, fontWeight: '900' }}>
            Gestion du Staff
          </Text>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8, paddingBottom: 12 }}
        >
          {(['all', 'scheduled', 'checked_in', 'completed'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: filter === status ? GREEN : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: filter === status ? GREEN : 'rgba(255,255,255,0.12)',
              }}
              onPress={() => setFilter(status)}
            >
              <Text
                style={{
                  color: filter === status ? BG : T.white,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {status === 'all' ? 'Tous' : status === 'scheduled' ? 'Planifiés' : status === 'checked_in' ? 'Arrivés' : 'Terminés'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              load();
            }} tintColor={GREEN} />
          }
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="people-outline" size={48} color="rgba(0,217,126,0.3)" />
              <Text style={{ color: T.white, fontSize: 16, fontWeight: '900' }}>
                Aucun staff
              </Text>
              <Text style={{ color: T.muted, fontSize: 12, textAlign: 'center' }}>
                Les staffers assignés apparaîtront ici
              </Text>
            </View>
          ) : (
            filtered.map(staff => (
              <StaffCard
                key={staff.id}
                staff={staff}
                onCheckIn={() => handleCheckIn(staff.staff_id)}
                onCheckOut={() => handleCheckOut(staff.staff_id)}
                onRate={() => router.push(`/(organizer)/rate-staff/${staff.staff_id}` as any)}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}