import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { AppUser, AUTH_STORAGE_KEY } from '@/lib/putInCoffeeUsers';

const { width: SW } = Dimensions.get('window');

// ── helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_ABBRS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

function getMondayOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(offsetWeeks: number): { dayName: string; abbr: string; dateStr: string; dateNum: number }[] {
  const monday = getMondayOfWeek(offsetWeeks);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    days.push({
      dayName: DAY_NAMES_FR[d.getDay()],
      abbr: DAY_ABBRS_FR[d.getDay()],
      dateStr: iso,
      dateNum: d.getDate(),
    });
  }
  return days;
}

function fmtWeekRange(offsetWeeks: number) {
  const monday = getMondayOfWeek(offsetWeeks);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('fr-FR', opts)} – ${sunday.toLocaleDateString('fr-FR', opts)}`;
}

interface AvailRow {
  id?: string;
  is_available: boolean;
  time_start?: string;
  time_end?: string;
  note?: string;
}

interface EditState {
  dateStr: string;
  dayName: string;
  current: AvailRow | null;
  isAvail: boolean;
  timeStart: string;
  timeEnd: string;
  note: string;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Planning() {
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [availMap, setAvailMap] = useState<Record<string, AvailRow | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const weekDays = getWeekDays(weekOffset);

  // ── load user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY).then(raw => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  // ── fetch availability for this week ─────────────────────────────────────
  const fetchAvail = useCallback(async () => {
    if (!currentUser?.staffId) return;
    setLoading(true);
    const dates = weekDays.map(d => d.dateStr);
    const { data } = await supabase
      .from('staff_availability')
      .select('date, is_available, time_start, time_end, note')
      .eq('staff_id', currentUser.staffId)
      .in('date', dates);

    const map: Record<string, AvailRow | null> = {};
    weekDays.forEach(d => { map[d.dateStr] = null; });
    if (data) {
      data.forEach(r => {
        map[r.date] = {
          is_available: r.is_available,
          time_start: r.time_start,
          time_end: r.time_end,
          note: r.note,
        };
      });
    }
    setAvailMap(map);
    setLoading(false);
  }, [currentUser, weekOffset]);

  useEffect(() => {
    if (currentUser?.staffId) fetchAvail();
  }, [currentUser, weekOffset, fetchAvail]);

  // ── realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.staffId) return;
    const ch = supabase
      .channel('planning_feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_availability',
          filter: `staff_id=eq.${currentUser.staffId}`,
        },
        () => fetchAvail()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser, fetchAvail]);

  // ── stats ─────────────────────────────────────────────────────────────────
  const stats = weekDays.reduce(
    (acc, d) => {
      const r = availMap[d.dateStr];
      if (r === null) acc.unknown++;
      else if (r.is_available) acc.available++;
      else acc.unavailable++;
      return acc;
    },
    { available: 0, unavailable: 0, unknown: 0 }
  );

  // ── open edit sheet ───────────────────────────────────────────────────────
  const openEdit = (day: typeof weekDays[0]) => {
    const current = availMap[day.dateStr] ?? null;
    setEditState({
      dateStr: day.dateStr,
      dayName: day.dayName,
      current,
      isAvail: current?.is_available ?? true,
      timeStart: current?.time_start ?? '16:00',
      timeEnd: current?.time_end ?? '02:00',
      note: current?.note ?? '',
    });
    setModalVisible(true);
  };

  // ── save availability ────────────────────────────────────────────────────
  const saveAvail = async () => {
    if (!currentUser?.staffId || !editState) return;
    setSaving(true);
    await supabase.from('staff_availability').upsert(
      {
        staff_id: currentUser.staffId,
        date: editState.dateStr,
        is_available: editState.isAvail,
        time_start: editState.isAvail ? editState.timeStart : null,
        time_end: editState.isAvail ? editState.timeEnd : null,
        note: editState.note || null,
      },
      { onConflict: 'staff_id,date' }
    );
    // optimistic update
    setAvailMap(prev => ({
      ...prev,
      [editState.dateStr]: {
        is_available: editState.isAvail,
        time_start: editState.timeStart,
        time_end: editState.timeEnd,
        note: editState.note,
      },
    }));
    setSaving(false);
    setModalVisible(false);
    setEditState(null);
  };

  // ── status helpers ────────────────────────────────────────────────────────
  function statusColor(r: AvailRow | null) {
    if (r === null) return 'rgba(255,255,255,0.40)';
    return r.is_available ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
  }
  function statusLabel(r: AvailRow | null) {
    if (r === null) return 'Non renseigné';
    return r.is_available ? 'Disponible' : 'Indisponible';
  }
  function statusBg(r: AvailRow | null) {
    if (r === null) return 'rgba(255,255,255,0.06)';
    return r.is_available ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
  }
  function statusBorder(r: AvailRow | null) {
    if (r === null) return 'rgba(255,255,255,0.12)';
    return r.is_available ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.15)';
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Mon Planning</Text>
          <Text style={s.headerSub}>{currentUser?.name ?? 'Staff'} · Put.in Coffee</Text>
        </View>

        {/* ── WEEK NAVIGATOR ── */}
        <BlurView intensity={18} tint="dark" style={[s.glassCard, s.weekNav]}>
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => setWeekOffset(o => o - 1)}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={s.weekLabel}>
            <Text style={s.weekLabelTxt}>
              {weekOffset === 0 ? 'Cette semaine' : weekOffset === 1 ? 'Semaine prochaine' : weekOffset < 0 ? `Il y a ${Math.abs(weekOffset)} sem.` : `+${weekOffset} sem.`}
            </Text>
            <Text style={s.weekRange}>{fmtWeekRange(weekOffset)}</Text>
          </View>
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => setWeekOffset(o => o + 1)}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </BlurView>

        {/* ── SUMMARY STATS ── */}
        <View style={s.statsRow}>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={s.statNum}>{stats.available}</Text>
            <Text style={s.statLbl}>Disponible{stats.available > 1 ? 's' : ''}</Text>
          </BlurView>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="close-circle-outline" size={18} color="rgba(255,255,255,0.40)" />
            <Text style={s.statNum}>{stats.unavailable}</Text>
            <Text style={s.statLbl}>Indisponible{stats.unavailable > 1 ? 's' : ''}</Text>
          </BlurView>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="help-circle-outline" size={18} color="rgba(255,255,255,0.40)" />
            <Text style={s.statNum}>{stats.unknown}</Text>
            <Text style={s.statLbl}>Non renseigné{stats.unknown > 1 ? 's' : ''}</Text>
          </BlurView>
        </View>

        {/* ── DAY ROWS ── */}
        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 32 }} />
        ) : (
          <View style={s.dayList}>
            {weekDays.map(day => {
              const r = availMap[day.dateStr] ?? null;
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];
              return (
                <TouchableOpacity
                  key={day.dateStr}
                  activeOpacity={0.82}
                  onPress={() => openEdit(day)}
                >
                  <BlurView intensity={18} tint="dark" style={[s.glassCard, s.dayRow, isToday && s.dayRowToday]}>
                    <View style={s.dayLeft}>
                      <Text style={[s.dayName, isToday && s.dayNameToday]}>{day.dayName}</Text>
                      <Text style={s.dayDate}>{day.dateNum}</Text>
                    </View>
                    <View style={s.dayMiddle}>
                      <View style={[s.statusPill, { backgroundColor: statusBg(r), borderColor: statusBorder(r) }]}>
                        <Text style={[s.statusPillTxt, { color: statusColor(r) }]}>{statusLabel(r)}</Text>
                      </View>
                      {r?.is_available && r.time_start && (
                        <Text style={s.timeSlotTxt}>{r.time_start} → {r.time_end}</Text>
                      )}
                    </View>
                    <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.35)" />
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── EDIT MODAL (slide-up sheet) ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={['#030B1E', '#020818']}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.sheetHandle} />

            {editState && (
              <>
                <Text style={s.sheetTitle}>{editState.dayName}</Text>
                <Text style={s.sheetDate}>{editState.dateStr}</Text>

                {/* Dispo toggle */}
                <View style={s.sheetToggleRow}>
                  <TouchableOpacity
                    style={[s.sheetToggleBtn, editState.isAvail && s.sheetToggleActive, editState.isAvail && { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.15)' }]}
                    onPress={() => setEditState(prev => prev ? { ...prev, isAvail: true } : prev)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={editState.isAvail ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
                    <Text style={[s.sheetToggleTxt, { color: '#FFFFFF' }]}>Disponible</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.sheetToggleBtn, !editState.isAvail && s.sheetToggleActive, !editState.isAvail && { borderColor: 'rgba(255,255,255,0.30)', backgroundColor: 'rgba(255,255,255,0.06)' }]}
                    onPress={() => setEditState(prev => prev ? { ...prev, isAvail: false } : prev)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={!editState.isAvail ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)'} />
                    <Text style={[s.sheetToggleTxt, { color: '#FFFFFF' }]}>Indisponible</Text>
                  </TouchableOpacity>
                </View>

                {/* Times (only if available) */}
                {editState.isAvail && (
                  <View style={s.sheetTimeRow}>
                    <View style={s.sheetTimeField}>
                      <Text style={s.sheetFieldLabel}>Début</Text>
                      <TextInput
                        style={s.sheetInput}
                        value={editState.timeStart}
                        onChangeText={v => setEditState(prev => prev ? { ...prev, timeStart: v } : prev)}
                        placeholder="16:00"
                        placeholderTextColor="rgba(255,255,255,0.30)"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                    <View style={s.sheetArrow}>
                      <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.30)" />
                    </View>
                    <View style={s.sheetTimeField}>
                      <Text style={s.sheetFieldLabel}>Fin</Text>
                      <TextInput
                        style={s.sheetInput}
                        value={editState.timeEnd}
                        onChangeText={v => setEditState(prev => prev ? { ...prev, timeEnd: v } : prev)}
                        placeholder="02:00"
                        placeholderTextColor="rgba(255,255,255,0.30)"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                  </View>
                )}

                {/* Note */}
                <View style={s.sheetNoteField}>
                  <Text style={s.sheetFieldLabel}>Note (optionnel)</Text>
                  <TextInput
                    style={[s.sheetInput, s.sheetNoteInput]}
                    value={editState.note}
                    onChangeText={v => setEditState(prev => prev ? { ...prev, note: v } : prev)}
                    placeholder="Ex: Je peux partir plus tôt si besoin"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Save button */}
                <TouchableOpacity
                  style={s.saveBtn}
                  onPress={saveAvail}
                  activeOpacity={0.82}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', '#FFFFFF']}
                    style={s.saveBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#020818" />
                        <Text style={[s.saveBtnTxt, { color: '#020818' }]}>Enregistrer</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 12,
  },

  // header
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.55,
    marginTop: 2,
  },

  // glass card
  glassCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  weekLabel: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabelTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  weekRange: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.55,
    marginTop: 2,
  },

  // stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.55,
    textAlign: 'center',
  },

  // day list
  dayList: {
    gap: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dayRowToday: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1.5,
  },
  dayLeft: {
    width: 56,
  },
  dayName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dayNameToday: {
    color: '#FFFFFF',
  },
  dayDate: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    opacity: 0.55,
  },
  dayMiddle: {
    flex: 1,
    gap: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeSlotTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.60,
  },

  // modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    padding: 24,
    paddingBottom: 48,
    gap: 16,
    backgroundColor: '#020818',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.50,
    marginTop: -10,
  },
  sheetToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sheetToggleActive: {},
  sheetToggleTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  sheetTimeField: {
    flex: 1,
    gap: 6,
  },
  sheetArrow: {
    paddingBottom: 12,
  },
  sheetFieldLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.55,
    marginBottom: 2,
  },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  sheetNoteField: {
    gap: 6,
  },
  sheetNoteInput: {
    minHeight: 64,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  saveBtnTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
