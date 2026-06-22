import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { AppUser, AUTH_STORAGE_KEY } from '@/lib/putInCoffeeUsers';

const { width: SW } = Dimensions.get('window');

// ── helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getWeekDays(offsetDays = 0): { label: string; abbr: string; dateStr: string }[] {
  const days: { label: string; abbr: string; dateStr: string }[] = [];
  const ABBRS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const base = new Date();
  base.setDate(base.getDate() + offsetDays);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const dayNum = d.getDate();
    days.push({ label: `${ABBRS[d.getDay()]} ${dayNum}`, abbr: ABBRS[d.getDay()], dateStr: iso });
  }
  return days;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── main component ────────────────────────────────────────────────────────────

export default function StaffFeed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [todayAvail, setTodayAvail] = useState<boolean | null>(null);
  const [weekAvail, setWeekAvail] = useState<Record<string, boolean | null>>({});
  const [nextWeekAvail, setNextWeekAvail] = useState<Record<string, boolean | null>>({});
  const [missions, setMissions] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const thisWeek = getWeekDays(0);
  const nextWeek = getWeekDays(7);

  // ── load user from AsyncStorage ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY).then(raw => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  // ── fetch all data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!currentUser?.staffId) return;
    const staffId = currentUser.staffId;
    const today = todayStr();

    // today availability
    const { data: todayData } = await supabase
      .from('staff_availability')
      .select('is_available')
      .eq('staff_id', staffId)
      .eq('date', today)
      .maybeSingle();
    setTodayAvail(todayData ? todayData.is_available : null);

    // week + next week availability (14 days)
    const allDates = [...thisWeek, ...nextWeek].map(d => d.dateStr);
    const { data: availRows } = await supabase
      .from('staff_availability')
      .select('date, is_available')
      .eq('staff_id', staffId)
      .in('date', allDates);

    const map: Record<string, boolean | null> = {};
    if (availRows) {
      availRows.forEach(r => { map[r.date] = r.is_available; });
    }
    const thisMap: Record<string, boolean | null> = {};
    const nextMap: Record<string, boolean | null> = {};
    thisWeek.forEach(d => { thisMap[d.dateStr] = map[d.dateStr] ?? null; });
    nextWeek.forEach(d => { nextMap[d.dateStr] = map[d.dateStr] ?? null; });
    setWeekAvail(thisMap);
    setNextWeekAvail(nextMap);

    // missions (upcoming)
    const { data: missionRows } = await supabase
      .from('missions')
      .select('*, events(*)')
      .eq('staff_id', staffId)
      .gte('date_start', today)
      .order('date_start')
      .limit(5);
    setMissions(missionRows ?? []);

    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.staffId) fetchData();
  }, [currentUser, fetchData]);

  // ── realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.staffId) return;
    const ch = supabase
      .channel('staff_feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_availability',
          filter: `staff_id=eq.${currentUser.staffId}`,
        },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser, fetchData]);

  // ── toggle today availability ─────────────────────────────────────────────
  const toggleToday = async () => {
    if (!currentUser?.staffId || toggling) return;
    setToggling(true);
    const newVal = todayAvail === true ? false : true;
    const today = todayStr();
    await supabase.from('staff_availability').upsert(
      {
        staff_id: currentUser.staffId,
        date: today,
        is_available: newVal,
        time_start: '16:00',
        time_end: '02:00',
      },
      { onConflict: 'staff_id,date' }
    );
    setTodayAvail(newVal);
    setToggling(false);
  };

  // ── toggle week/next-week day ─────────────────────────────────────────────
  const toggleDay = async (dateStr: string, currentVal: boolean | null) => {
    if (!currentUser?.staffId) return;
    const newVal = currentVal === true ? false : true;
    await supabase.from('staff_availability').upsert(
      {
        staff_id: currentUser.staffId,
        date: dateStr,
        is_available: newVal,
        time_start: '16:00',
        time_end: '02:00',
      },
      { onConflict: 'staff_id,date' }
    );
    // optimistic update
    if (thisWeek.find(d => d.dateStr === dateStr)) {
      setWeekAvail(prev => ({ ...prev, [dateStr]: newVal }));
    } else {
      setNextWeekAvail(prev => ({ ...prev, [dateStr]: newVal }));
    }
  };

  // ── day chip color ────────────────────────────────────────────────────────
  function chipBg(val: boolean | null) {
    if (val === true) return '#FFFFFF';
    if (val === false) return 'rgba(255,255,255,0.06)';
    return 'rgba(255,255,255,0.06)';
  }
  function chipBorder(val: boolean | null) {
    if (val === true) return '#FFFFFF';
    if (val === false) return 'rgba(255,255,255,0.30)';
    return 'rgba(255,255,255,0.15)';
  }
  function chipTextColor(val: boolean | null) {
    if (val === true) return '#020818';
    if (val === false) return 'rgba(255,255,255,0.55)';
    return '#FFFFFF';
  }

  // ── mission status badge ──────────────────────────────────────────────────
  function statusColor(status: string) {
    if (status === 'confirmed') return '#FFFFFF';
    return 'rgba(255,255,255,0.65)';
  }
  function statusLabel(status: string) {
    if (status === 'confirmed') return 'Confirmé';
    return 'En attente';
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading && !currentUser) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* particle background */}
      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image
              source={{ uri: currentUser?.avatarUrl ?? 'https://ui-avatars.com/api/?name=Staff&background=6366F1&color=fff' }}
              style={s.avatar}
            />
            <View style={s.headerText}>
              <Text style={s.greeting}>Bonjour {currentUser?.name ?? 'Staff'} !</Text>
              <Text style={s.venueLine}>Put.in Coffee · Sanur, Bali</Text>
            </View>
          </View>
          <TouchableOpacity style={s.bellBtn} activeOpacity={0.75}>
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── TODAY AVAILABILITY TOGGLE ── */}
        <View style={s.section}>
          <BlurView intensity={18} tint="dark" style={s.glassCard}>
            <View style={s.todayRow}>
              <View style={s.todayLeft}>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                <Text style={s.todayLabel}>Ma disponibilité aujourd'hui</Text>
              </View>
              <TouchableOpacity
                style={[
                  s.togglePill,
                  todayAvail === true && s.togglePillGreen,
                  todayAvail === false && s.togglePillRed,
                ]}
                onPress={toggleToday}
                activeOpacity={0.8}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={todayAvail === true ? 'checkmark-circle' : todayAvail === false ? 'close-circle' : 'help-circle-outline'}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={s.togglePillTxt}>
                      {todayAvail === true ? 'Disponible' : todayAvail === false ? 'Indisponible' : 'Non défini'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        {/* ── MA SEMAINE — availability grid ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Ma semaine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {thisWeek.map(day => {
              const val = weekAvail[day.dateStr] ?? null;
              const isToday = day.dateStr === todayStr();
              return (
                <TouchableOpacity
                  key={day.dateStr}
                  style={[s.dayChip, { backgroundColor: chipBg(val), borderColor: chipBorder(val) }, isToday && s.dayChipToday]}
                  onPress={() => toggleDay(day.dateStr, val)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.dayChipTxt, { color: chipTextColor(val) }, isToday && s.dayChipTxtToday]}>
                    {day.label}
                  </Text>
                  {val === true && <Ionicons name="checkmark" size={11} color="#020818" style={{ marginTop: 2 }} />}
                  {val === false && <Ionicons name="close" size={11} color="rgba(255,255,255,0.55)" style={{ marginTop: 2 }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── MES PROCHAINS SHIFTS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mes prochains shifts</Text>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: 16 }} />
          ) : missions.length === 0 ? (
            <BlurView intensity={18} tint="dark" style={[s.glassCard, s.emptyCard]}>
              <Ionicons name="calendar-outline" size={36} color="rgba(255,255,255,0.25)" />
              <Text style={s.emptyTxt}>Aucun shift prévu</Text>
              <Text style={s.emptySubTxt}>Tes missions à venir apparaîtront ici</Text>
            </BlurView>
          ) : (
            missions.map(m => (
              <BlurView key={m.id} intensity={18} tint="dark" style={[s.glassCard, s.missionCard]}>
                <View style={s.missionRow}>
                  <View style={s.missionInfo}>
                    <Text style={s.missionTitle} numberOfLines={1}>{m.events?.title ?? 'Mission'}</Text>
                    <View style={s.missionMeta}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.50)" />
                      <Text style={s.missionMetaTxt}>{fmtDateTime(m.date_start)}</Text>
                    </View>
                    <View style={s.missionMeta}>
                      <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.50)" />
                      <Text style={s.missionMetaTxt}>{m.role ?? currentUser?.title}</Text>
                    </View>
                  </View>
                  <View style={s.missionRight}>
                    <View style={[s.statusBadge, { backgroundColor: `${statusColor(m.status)}22`, borderColor: statusColor(m.status) }]}>
                      <Text style={[s.statusTxt, { color: statusColor(m.status) }]}>{statusLabel(m.status)}</Text>
                    </View>
                    {m.hourly_rate && (
                      <Text style={s.rateTxt}>{m.hourly_rate} €/h</Text>
                    )}
                  </View>
                </View>
              </BlurView>
            ))
          )}
        </View>

        {/* ── DISPONIBILITÉ RAPIDE — semaine suivante ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Semaine suivante</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {nextWeek.map(day => {
              const val = nextWeekAvail[day.dateStr] ?? null;
              return (
                <TouchableOpacity
                  key={day.dateStr}
                  style={[s.dayChip, { backgroundColor: chipBg(val), borderColor: chipBorder(val) }]}
                  onPress={() => toggleDay(day.dateStr, val)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.dayChipTxt, { color: chipTextColor(val) }]}>{day.label}</Text>
                  {val === true && <Ionicons name="checkmark" size={11} color="#020818" style={{ marginTop: 2 }} />}
                  {val === false && <Ionicons name="close" size={11} color="rgba(255,255,255,0.55)" style={{ marginTop: 2 }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── PUT.IN COFFEE SECTION ── */}
        <View style={s.section}>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.venueCard]}>
            <View style={s.venueHeader}>
              <View style={s.venueLogo}>
                <Ionicons name="cafe-outline" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text style={s.venueName}>Put.in Coffee</Text>
                <Text style={s.venueLocation}>Sanur · Bali</Text>
              </View>
            </View>
            <View style={s.venueDivider} />
            <View style={s.venueInfoRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.55)" />
              <Text style={s.venueInfoTxt}>Jl. Danau Tamblingan, Sanur</Text>
            </View>
            <View style={s.venueInfoRow}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.55)" />
              <Text style={s.venueInfoTxt}>Service : 16:00 → 02:00</Text>
            </View>
            <View style={s.venueInfoRow}>
              <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.55)" />
              <Text style={s.venueInfoTxt}>Équipe : Oka, Redo, Arik</Text>
            </View>
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020818',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#020818',
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 20,
    gap: 8,
  },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  venueLine: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // section
  section: {
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // glass card
  glassCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
  },

  // today toggle
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  togglePillGreen: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: '#FFFFFF',
  },
  togglePillRed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  togglePillTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // day chips
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 62,
  },
  dayChipToday: {
    borderWidth: 2,
  },
  dayChipTxt: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dayChipTxtToday: {
    color: '#FFFFFF',
  },

  // mission cards
  missionCard: {
    marginBottom: 8,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  missionInfo: {
    flex: 1,
    gap: 5,
  },
  missionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  missionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  missionMetaTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.75,
  },
  missionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  rateTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // empty state
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  emptyTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.5,
    textAlign: 'center',
  },

  // venue card
  venueCard: {
    gap: 10,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  venueLocation: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
  },
  venueDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  venueInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venueInfoTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
});
