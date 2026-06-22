/**
 * app/(organizer)/calendar.tsx — EVENTURE v3 · Put.in Coffee
 *
 * Two tabs:
 *   1. Agenda  — react-native-calendars Calendar + day events
 *   2. Disponibilités — staff availability grid + quick-add form
 *
 * Permission system:
 *   - Arik (organizer) can edit ALL staff availability
 *   - Oka / Redo (staff) can ONLY edit their own
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, Image, Modal,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }            from 'expo-linear-gradient';
import { BlurView }                  from 'expo-blur';
import { Ionicons }                  from '@expo/vector-icons';
import { Calendar }                  from 'react-native-calendars';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter }                 from 'expo-router';
import AsyncStorage                  from '@react-native-async-storage/async-storage';
import { supabase }                  from '@/lib/supabase';
import { AppUser, AUTH_STORAGE_KEY } from '@/lib/putInCoffeeUsers';

/* ─── Palette ────────────────────────────────────────────────────────────── */
const BG   = '#020818';
const EDGE = 16;

/* ─── Calendar theme — navy + white ONLY ────────────────────────────────── */
const CAL_THEME = {
  calendarBackground            : BG,
  backgroundColor               : BG,
  textSectionTitleColor         : '#FFFFFF',
  selectedDayBackgroundColor    : '#FFFFFF',
  selectedDayTextColor          : '#020818',
  todayTextColor                : '#FFFFFF',
  dayTextColor                  : '#FFFFFF',
  textDisabledColor             : 'rgba(255,255,255,0.20)',
  dotColor                      : '#FFFFFF',
  selectedDotColor              : '#020818',
  arrowColor                    : '#FFFFFF',
  monthTextColor                : '#FFFFFF',
  indicatorColor                : '#FFFFFF',
  textDayFontWeight             : '600' as const,
  textMonthFontWeight           : '800' as const,
  textDayHeaderFontWeight       : '600' as const,
  todayBackgroundColor          : 'rgba(255,255,255,0.12)',
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string; title: string; date_start: string; date_end: string | null;
  location: string; status: string; type: string | null;
}
interface StaffMember {
  id: string; display_name: string; avatar_url: string | null;
  role: string[] | null; hourly_rate: number | null; is_available: boolean;
}
interface AvailRow {
  id: string; staff_id: string; date: string;
  is_available: boolean; time_start: string | null; time_end: string | null; note: string | null;
}

/* ─── Particle Background ────────────────────────────────────────────────── */
const _NUM_P = 28;
const _PCOLS = [
  '#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610',
];
const _PARTS = Array.from({ length: _NUM_P }, (_, i) => ({
  x:   (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
  y:   (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
  sz:  i % 7 === 0 ? 3 : i % 4 === 0 ? 2 : 1.4,
  col: _PCOLS[i % _PCOLS.length],
  dur: 2400 + (i % 7) * 600,
  del: (i % 9) * 220,
}));

function ParticleBg() {
  const anims = useRef(_PARTS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(_PARTS[i].del),
        Animated.timing(anim, { toValue: 1, duration: _PARTS[i].dur / 2, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: _PARTS[i].dur / 2, useNativeDriver: true }),
      ]))
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      {_PARTS.map((p, i) => {
        const opacity = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.35] });
        const scale   = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
        return (
          <Animated.View key={i} style={{
            position: 'absolute', left: `${p.x}%` as any, top: `${p.y}%` as any,
            width: p.sz, height: p.sz, borderRadius: p.sz / 2,
            backgroundColor: 'rgba(255,255,255,0.25)',
            opacity, transform: [{ scale }],
          }}/>
        );
      })}
    </View>
  );
}

/* ─── DayModal ───────────────────────────────────────────────────────────── */
const DayModal = memo(function DayModal({ visible, dateStr, events, onClose, onCreateEvent }: {
  visible: boolean; dateStr: string; events: CalEvent[]; onClose: () => void; onCreateEvent: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(bgAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const label = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(2,8,24,0.88)', justifyContent: 'flex-end', opacity: bgAnim }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}/>
        <Animated.View style={[dm.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0.06)', BG]} style={StyleSheet.absoluteFillObject}/>
          <View style={[dm.handle, { backgroundColor: 'rgba(255,255,255,0.18)' }]}/>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF', textTransform: 'capitalize' }}>{label}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.40)"/>
            </TouchableOpacity>
          </View>
          {events.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {events.length} événement{events.length > 1 ? 's' : ''}
              </Text>
              <View style={{ gap: 8 }}>
                {events.map(ev => (
                  <View key={ev.id} style={[dm.evtRow, {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderLeftColor: '#FFFFFF',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(255,255,255,0.10)',
                  }]}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>{ev.title}</Text>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }} numberOfLines={1}>{ev.location}</Text>
                      {!!ev.type && (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF' }}>{ev.type}</Text>
                      )}
                    </View>
                    <View style={{
                      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)',
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                        {ev.status === 'published' ? 'Actif' : ev.status === 'draft' ? 'Brouillon' : 'Terminé'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.04)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
              }}>
                <Ionicons name="calendar-outline" size={26} color="#FFFFFF"/>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Aucun événement</Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, textAlign: 'center' }}>Ce jour est libre.</Text>
            </View>
          )}
          <TouchableOpacity style={dm.createBtn} onPress={onCreateEvent} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']} style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="add" size={18} color="#FFFFFF"/>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Créer un événement ce jour</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const dm = StyleSheet.create({
  sheet    : { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
               padding: 20, paddingTop: 12, backgroundColor: BG,
               borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  handle   : { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  evtRow   : { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
               borderRadius: 14, paddingVertical: 14, marginTop: 16, overflow: 'hidden',
               backgroundColor: 'rgba(255,255,255,0.06)',
               borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
});

/* ─── StaffPill ──────────────────────────────────────────────────────────── */
function StaffPill({ staff, selected, onPress }: {
  staff: StaffMember; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ alignItems: 'center', marginRight: 12, opacity: selected ? 1 : 0.55 }}>
      {staff.avatar_url ? (
        <Image source={{ uri: staff.avatar_url }} style={{
          width: 44, height: 44, borderRadius: 22,
          borderWidth: 2, borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
        }}/>
      ) : (
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
        }}>
          <Text style={{ color: selected ? '#020818' : '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
            {staff.display_name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700', marginTop: 4, maxWidth: 44, textAlign: 'center' }} numberOfLines={1}>
        {staff.display_name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* ── Current user (permission system) ── */
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY).then(raw => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  const canEditStaff = useCallback((targetStaffId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'organizer') return true;
    return currentUser.staffId === targetStaffId;
  }, [currentUser]);

  /* ── Global state ── */
  const [tab, setTab]             = useState<'agenda' | 'dispo'>('agenda');
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [availData, setAvailData] = useState<AvailRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lockMsg, setLockMsg]     = useState<string | null>(null);

  /* ── Agenda tab state ── */
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);

  /* ── Dispo quick-add form ── */
  const [formStaffId, setFormStaffId] = useState<string>('');
  const [formDate, setFormDate]       = useState<string>('');
  const [formAvail, setFormAvail]     = useState<boolean>(true);
  const [formNote, setFormNote]       = useState<string>('');
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* ── DAYS for availability grid (next 7 days) ── */
  const DAYS_7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return {
      dateStr:  d.toISOString().split('T')[0],
      shortDay: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3).toUpperCase(),
      dayNum:   String(d.getDate()),
    };
  }), []);

  /* ── Availability map ── */
  const availMap = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    availData.forEach(row => {
      if (!map[row.staff_id]) map[row.staff_id] = {};
      map[row.staff_id][row.date] = row.is_available;
    });
    return map;
  }, [availData]);

  /* ── Staff list filtered to Put.in Coffee team ── */
  const teamStaff = useMemo(() =>
    staffList.filter(s => ['Arik', 'Oka', 'Redo'].includes(s.display_name)),
  [staffList]);

  /* ── Staff the current user can edit in the quick-add form ── */
  const editableStaff = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'organizer') return teamStaff;
    return teamStaff.filter(s => s.id === currentUser.staffId);
  }, [currentUser, teamStaff]);

  /* ── Fetch all data ── */
  const fetchAll = useCallback(async () => {
    try {
      const today       = new Date().toISOString().split('T')[0];
      const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const [eventsRes, staffRes, availRes] = await Promise.all([
        supabase.from('events').select('id,title,date_start,date_end,location,status,type')
          .order('date_start', { ascending: true }),
        supabase.from('staff').select('*')
          .in('display_name', ['Arik', 'Oka', 'Redo'])
          .order('display_name', { ascending: true }),
        supabase.from('staff_availability').select('*')
          .gte('date', today).lte('date', inSevenDays),
      ]);

      if (eventsRes.data) setEvents(eventsRes.data as CalEvent[]);
      if (staffRes.data)  setStaffList(staffRes.data as StaffMember[]);
      if (availRes.data)  setAvailData(availRes.data as AvailRow[]);
    } catch (e) {
      console.error('[calendar] fetchAll', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    const today       = new Date().toISOString().split('T')[0];
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const { data } = await supabase.from('staff_availability').select('*')
      .gte('date', today).lte('date', inSevenDays);
    if (data) setAvailData(data as AvailRow[]);
  }, []);

  useEffect(() => { fetchAll(); }, []);

  /* ── Toggle availability from grid ── */
  const handleToggle = useCallback(async (staffId: string, date: string, current?: boolean) => {
    if (!canEditStaff(staffId)) {
      const member = teamStaff.find(s => s.id === staffId);
      const name   = member?.display_name ?? 'ce membre';
      setLockMsg(`Seul ${name} peut modifier ses disponibilités`);
      setTimeout(() => setLockMsg(null), 2500);
      return;
    }
    const newVal = current === true ? false : true;
    await supabase.from('staff_availability').upsert(
      { staff_id: staffId, date, is_available: newVal, time_start: '16:00', time_end: '02:00' },
      { onConflict: 'staff_id,date' },
    );
    fetchAvailability();
  }, [canEditStaff, teamStaff, fetchAvailability]);

  /* ── Save quick-add form ── */
  const handleSave = useCallback(async () => {
    if (!formStaffId || !formDate) return;
    setSaving(true);
    try {
      await supabase.from('staff_availability').upsert(
        {
          staff_id: formStaffId, date: formDate,
          is_available: formAvail,
          time_start: '16:00', time_end: '02:00',
          note: formNote || null,
        },
        { onConflict: 'staff_id,date' },
      );
      setSaveSuccess(true);
      setFormNote('');
      setTimeout(() => setSaveSuccess(false), 1800);
      await fetchAvailability();
    } catch (e) {
      console.error('[calendar] save', e);
    } finally {
      setSaving(false);
    }
  }, [formStaffId, formDate, formAvail, formNote, fetchAvailability]);

  /* ── Calendar helpers ── */
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    events.forEach(ev => {
      const key = ev.date_start?.split('T')[0] ?? ev.date_start?.split(' ')[0];
      if (key) marks[key] = { marked: true, dotColor: '#FFFFFF' };
    });
    if (selectedDate) {
      marks[selectedDate] = { ...(marks[selectedDate] ?? {}), selected: true, selectedColor: '#FFFFFF' };
    }
    return marks;
  }, [events, selectedDate]);

  const selectedDateEvents = useMemo(() =>
    selectedDate
      ? events.filter(ev => (ev.date_start?.split('T')[0] ?? ev.date_start?.split(' ')[0]) === selectedDate)
      : [],
  [events, selectedDate]);

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg/>

      {/* ── HEADER ── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: EDGE, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>Planning</Text>
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, marginTop: 2 }}>Put.in Coffee · Sanur</Text>
          </View>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
              backgroundColor: '#FFFFFF',
            }}
            onPress={() => router.push('/(organizer)/create-event' as any)}
            activeOpacity={0.82}
          >
            <Ionicons name="add" size={16} color="#020818"/>
            <Text style={{ color: '#020818', fontWeight: '700', fontSize: 13 }}>Créer</Text>
          </TouchableOpacity>
        </View>

        {/* ── TAB SWITCHER ── */}
        <View style={{
          flexDirection: 'row', marginTop: 14,
          backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 3,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
        }}>
          {(['agenda', 'dispo'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center',
                backgroundColor: tab === t ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
              }}
            >
              <Text style={{ color: tab === t ? '#020818' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                {t === 'agenda' ? 'Agenda' : 'Disponibilités'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ══════════════════ TAB 1 — AGENDA ══════════════════ */}
      {tab === 'agenda' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: BG }}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, gap: 16 }}
        >
          {/* react-native-calendars */}
          <View style={{
            borderRadius: 20, overflow: 'hidden',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}/>
            <Calendar
              theme={CAL_THEME}
              markedDates={markedDates}
              onDayPress={day => {
                setSelectedDate(day.dateString);
                setModalVisible(true);
              }}
              style={{ backgroundColor: 'transparent' }}
            />
          </View>

          {/* Events for selected date (inline, below calendar) */}
          {selectedDate.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {selectedDate} · {selectedDateEvents.length} événement{selectedDateEvents.length !== 1 ? 's' : ''}
              </Text>
              {selectedDateEvents.length === 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13 }}>Aucun événement ce jour.</Text>
              ) : (
                selectedDateEvents.map(ev => (
                  <TouchableOpacity
                    key={ev.id}
                    style={[s.evtCard, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderLeftColor: '#FFFFFF' }]}
                    onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: ev.id } } as any)}
                    activeOpacity={0.82}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>{ev.title}</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }} numberOfLines={1}>{ev.location}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.40)"/>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════════ TAB 2 — DISPONIBILITÉS ══════════════════ */}
      {tab === 'dispo' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: BG }}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, gap: 20 }}
        >
          {/* ── Permission banner for staff users ── */}
          {currentUser && currentUser.role === 'staff' && (
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
              padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.40)"/>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, flex: 1 }}>
                Vous pouvez uniquement modifier vos propres disponibilités.
              </Text>
            </View>
          )}

          {/* ── Section A: Team availability grid ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            padding: 16, overflow: 'hidden',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Ionicons name="people-outline" size={18} color="#FFFFFF"/>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Mon équipe — Disponibilités</Text>
            </View>

            {loading ? (
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>Chargement…</Text>
            ) : teamStaff.length === 0 ? (
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>Aucun membre trouvé.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Day headers */}
                  <View style={{ flexDirection: 'row', marginLeft: 110, marginBottom: 8 }}>
                    {DAYS_7.map(d => (
                      <View key={d.dateStr} style={{ width: 44, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 9, fontWeight: '700' }}>{d.shortDay}</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>{d.dayNum}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Staff rows */}
                  {teamStaff.map(staff => {
                    const canEdit = canEditStaff(staff.id);
                    return (
                      <View key={staff.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        {/* Avatar + name (110px) */}
                        <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          {staff.avatar_url ? (
                            <Image source={{ uri: staff.avatar_url }} style={{ width: 28, height: 28, borderRadius: 14 }}/>
                          ) : (
                            <View style={{
                              width: 28, height: 28, borderRadius: 14,
                              backgroundColor: 'rgba(255,255,255,0.15)',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                                {staff.display_name[0]?.toUpperCase() ?? '?'}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
                              {staff.display_name.split(' ')[0]}
                            </Text>
                            {!canEdit && (
                              <Ionicons name="lock-closed-outline" size={9} color="rgba(255,255,255,0.30)" style={{ marginTop: 2 }}/>
                            )}
                          </View>
                        </View>

                        {/* Availability cells */}
                        {DAYS_7.map(d => {
                          const avail = availMap[staff.id]?.[d.dateStr];
                          return (
                            <TouchableOpacity
                              key={d.dateStr}
                              style={{ width: 44, alignItems: 'center' }}
                              onPress={() => handleToggle(staff.id, d.dateStr, avail)}
                              activeOpacity={0.7}
                            >
                              <View style={{
                                width: 36, height: 36, borderRadius: 18,
                                alignItems: 'center', justifyContent: 'center',
                                backgroundColor:
                                  avail === true  ? '#FFFFFF' :
                                  avail === false ? 'transparent' :
                                  'transparent',
                                borderWidth: avail === undefined ? 0 : 1,
                                borderColor:
                                  avail === true  ? 'transparent' :
                                  avail === false ? 'rgba(255,255,255,0.30)' :
                                  'transparent',
                              }}>
                                {avail === true  && <Ionicons name="checkmark" size={16} color="#020818"/>}
                                {avail === false && <Ionicons name="close"     size={16} color="rgba(255,255,255,0.50)"/>}
                                {avail === undefined && (
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}/>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { bg: '#FFFFFF', label: 'Disponible' },
                { bg: 'transparent', bordered: true, label: 'Indisponible' },
                { bg: 'rgba(255,255,255,0.15)', small: true, label: 'Non défini' },
              ].map(item => (
                <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.small ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.bg }}/>
                  ) : (
                    <View style={{
                      width: 12, height: 12, borderRadius: 6,
                      backgroundColor: item.bg,
                      borderWidth: item.bordered ? 1 : 0,
                      borderColor: 'rgba(255,255,255,0.30)',
                    }}/>
                  )}
                  <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 10, fontWeight: '600' }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Section B: Quick-add form ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            padding: 16, overflow: 'hidden',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF"/>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Ajouter une disponibilité</Text>
            </View>

            {/* Staff picker — only show editable staff */}
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Membre
            </Text>
            <FlatList
              data={editableStaff}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <StaffPill
                  staff={item}
                  selected={formStaffId === item.id}
                  onPress={() => setFormStaffId(item.id)}
                />
              )}
              style={{ marginBottom: 16 }}
            />

            {/* Date picker — next 7 days chips */}
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Date
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DAYS_7.map(d => {
                  const isSelected = formDate === d.dateStr;
                  return (
                    <TouchableOpacity
                      key={d.dateStr}
                      onPress={() => setFormDate(d.dateStr)}
                      activeOpacity={0.75}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                        backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                        borderWidth: 1, borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                        alignItems: 'center', minWidth: 52,
                      }}
                    >
                      <Text style={{ color: isSelected ? '#020818' : 'rgba(255,255,255,0.40)', fontSize: 9, fontWeight: '700' }}>{d.shortDay}</Text>
                      <Text style={{ color: isSelected ? '#020818' : '#FFFFFF', fontSize: 14, fontWeight: '900' }}>{d.dayNum}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Available / Not available toggle */}
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Statut
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setFormAvail(true)}
                activeOpacity={0.75}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 10, borderRadius: 12,
                  backgroundColor: formAvail ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: formAvail ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={formAvail ? '#020818' : '#FFFFFF'}/>
                <Text style={{ color: formAvail ? '#020818' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Disponible</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFormAvail(false)}
                activeOpacity={0.75}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 10, borderRadius: 12,
                  backgroundColor: !formAvail ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: !formAvail ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                }}
              >
                <Ionicons name="close-circle-outline" size={16} color={!formAvail ? '#020818' : '#FFFFFF'}/>
                <Text style={{ color: !formAvail ? '#020818' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Indisponible</Text>
              </TouchableOpacity>
            </View>

            {/* Note (optional) */}
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Note (optionnel)
            </Text>
            <TextInput
              value={formNote}
              onChangeText={setFormNote}
              placeholder="Ex : disponible seulement le soir…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                color: '#FFFFFF', fontSize: 13, paddingHorizontal: 14, paddingVertical: 10,
                marginBottom: 16,
              }}
            />

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.82}
              disabled={saving || !formStaffId || !formDate}
              style={{
                borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                backgroundColor: saveSuccess ? '#FFFFFF' : (!formStaffId || !formDate) ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
                opacity: saving ? 0.7 : (!formStaffId || !formDate) ? 0.5 : 1,
              }}
            >
              {saveSuccess ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#020818"/>
                  <Text style={{ color: '#020818', fontWeight: '800', fontSize: 15 }}>Enregistré</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="save-outline" size={18} color={(!formStaffId || !formDate) ? 'rgba(255,255,255,0.40)' : '#020818'}/>
                  <Text style={{ color: (!formStaffId || !formDate) ? 'rgba(255,255,255,0.40)' : '#020818', fontWeight: '800', fontSize: 15 }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {(!formStaffId || !formDate) && (
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                {!formStaffId ? 'Sélectionne un membre' : 'Sélectionne une date'}
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Lock message toast ── */}
      {lockMsg && (
        <View style={{
          position: 'absolute', bottom: insets.bottom + 100, left: EDGE, right: EDGE,
          backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          shadowColor: '#FFFFFF', shadowOpacity: 0.15, shadowRadius: 20,
          shadowOffset: { width: 0, height: 4 },
        }}>
          <Ionicons name="lock-closed" size={16} color="#020818"/>
          <Text style={{ color: '#020818', fontSize: 13, fontWeight: '700', flex: 1 }}>{lockMsg}</Text>
        </View>
      )}

      {/* Day modal (Agenda tab) */}
      <DayModal
        visible={modalVisible}
        dateStr={selectedDate}
        events={selectedDateEvents}
        onClose={() => setModalVisible(false)}
        onCreateEvent={() => { setModalVisible(false); router.push('/(organizer)/create-event' as any); }}
      />
    </View>
  );
}

/* ─── Shared styles ──────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  evtCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14, borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden',
  },
});
