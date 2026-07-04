/**
 * app/(organizer)/calendar.tsx — EVENTURE v3
 * Planning multi-événements : vue mois personnalisée
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { supabase }     from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import CenteredModal    from '@/components/CenteredModal';
import { AURA }          from '@/constants/aura-theme';
import Aura              from '@/components/Aura';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG      = AURA.bg;
const PRIMARY = AURA.primary;
const P_LIGHT = AURA.primaryGhost;
const P_GHOST = AURA.primaryGhost;
const SUCCESS = AURA.success;
const WARNING = AURA.warning;
const DANGER  = AURA.danger;
const PURPLE  = AURA.secondary;
const BLUE    = AURA.cyan;
const EDGE    = 16;

const C = {
  text:      AURA.text,
  textSub:   AURA.textSub,
  textMuted: AURA.textMuted,
  border:    AURA.border,
  surface:   AURA.surface,
  surfaceAlt:AURA.surfaceAlt,
} as const;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface CalEvent {
  id:         string;
  title:      string;
  date_start: string;
  date_end:   string | null;
  location:   string;
  status:     string;
  type:       string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: WARNING, Conférence: BLUE,
  Mariage: '#EC4899', Séminaire: PURPLE, Concert: DANGER, Sport: SUCCESS,
};
const typeColor = (t: string | null) => TYPE_COLORS[t ?? ''] ?? PRIMARY;

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS   = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/* ─── Day Cell ───────────────────────────────────────────────────────────── */
const DayCell = memo(function DayCell({
  date, isCurrentMonth, isToday, events, onPress,
}: {
  date: Date; isCurrentMonth: boolean; isToday: boolean;
  events: CalEvent[]; onPress: () => void;
}) {
  const CELL = Math.floor((SW - EDGE * 2 - 12) / 7);
  const hasEvents = events.length > 0;
  const dots = events.slice(0, 3).map(e => typeColor(e.type));

  return (
    <TouchableOpacity
      style={[
        { width: CELL, height: CELL + 8, alignItems: 'center', paddingTop: 6, borderRadius: 10 },
        isToday && { backgroundColor: PRIMARY },
        !isCurrentMonth && { opacity: 0.3 },
        hasEvents && !isToday && { backgroundColor: P_GHOST },
      ]}
      onPress={onPress}
      activeOpacity={hasEvents ? 0.7 : 1}
    >
      <Text style={[
        { fontSize: 14, fontWeight: isToday ? '800' : hasEvents ? '700' : '400',
          color: isToday ? '#FFF' : isCurrentMonth ? C.text : C.textMuted },
      ]}>
        {date.getDate()}
      </Text>
      {hasEvents && (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
          {dots.map((c, i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isToday ? 'rgba(255,255,255,0.8)' : c }}/>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

/* ─── Day Modal (centrée) ──────────────────────────────────────────────── */
const DayModal = memo(function DayModal({
  visible, date, events, onClose, onCreateEvent,
}: {
  visible: boolean; date: Date; events: CalEvent[]; onClose: () => void; onCreateEvent: () => void;
}) {
  const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <CenteredModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={dm.dateTitle}>{dayLabel}</Text>
        <TouchableOpacity onPress={onClose} style={dm.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textMuted}/>
        </TouchableOpacity>
      </View>

      {events.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
          <Text style={dm.sectionLabel}>{events.length} événement{events.length > 1 ? 's' : ''}</Text>
          <View style={{ gap: 8 }}>
            {events.map(ev => {
              const tc = typeColor(ev.type);
              return (
                <View key={ev.id} style={[dm.evtRow, { borderLeftColor: tc }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={dm.evtTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={dm.evtMeta} numberOfLines={1}>{ev.location}</Text>
                    {ev.type && <Text style={[dm.evtType, { color: tc }]}>{ev.type}</Text>}
                  </View>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                                 backgroundColor: ev.status === 'published' ? AURA.successGhost : C.surfaceAlt }}>
                    <Text style={{ fontSize: 10, fontWeight: '700',
                                   color: ev.status === 'published' ? SUCCESS : C.textMuted }}>
                      {ev.status === 'published' ? 'Actif' : ev.status === 'draft' ? 'Brouillon' : 'Terminé'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar-outline" size={26} color={PRIMARY}/>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Aucun événement</Text>
          <Text style={{ color: C.textSub, fontSize: 12, textAlign: 'center' }}>Ce jour est libre.</Text>
        </View>
      )}

      <Aura color={AURA.primaryGlow} radius={12} onPress={onCreateEvent}>
        <View style={dm.createBtn}>
          <Ionicons name="add" size={18} color="#FFF"/>
          <Text style={dm.createTxt}>Créer un événement ce jour</Text>
        </View>
      </Aura>
    </CenteredModal>
  );
});
const dm = StyleSheet.create({
  dateTitle:   { fontSize: 17, fontWeight: '800', color: C.text, textTransform: 'capitalize' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  sectionLabel:{ fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  evtRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceAlt,
                 borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  evtTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  evtMeta:     { fontSize: 12, color: C.textSub },
  evtType:     { fontSize: 11, fontWeight: '600' },
  createBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  createTxt:   { color: '#FFF', fontWeight: '800', fontSize: 15 },
});

/* ─── Month Legend ───────────────────────────────────────────────────────── */
const MonthLegend = memo(({ events }: { events: CalEvent[] }) => {
  const types = [...new Set(events.map(e => e.type).filter(Boolean))] as string[];
  if (!types.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
      {types.map(t => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColor(t) }}/>
          <Text style={{ fontSize: 11, color: C.textSub, fontWeight: '600' }}>{t}</Text>
        </View>
      ))}
    </ScrollView>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function CalendarScreen() {
  const router = useRouter();

  const [events,     setEvents]     = useState<CalEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [month,      setMonth]      = useState(new Date().getMonth());
  const [selectedDay,setSelectedDay]= useState<Date | null>(null);
  const [modalVisible,setModalVisible]=useState(false);

  const load = useCallback(async () => {
    try {
      const uid = await getCurrentOrganizerId();
      if (!uid) return;
      const { data } = await supabase
        .from('events')
        .select('id,title,date_start,date_end,location,status,type')
        .eq('organizer_id', uid)
        .order('date_start', { ascending: true });
      setEvents((data ?? []) as CalEvent[]);
    } catch (e) { console.error('[calendar]', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    // Start from Monday
    const startDay = (first.getDay() + 6) % 7;
    const days: Date[] = [];
    // Previous month fill
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }
    // Current month
    for (let i = 1; i <= last.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    // Next month fill (to make complete weeks)
    while (days.length % 7 !== 0) {
      days.push(new Date(year, month + 1, days.length - last.getDate() - startDay + 1));
    }
    return days;
  }, [year, month]);

  const eventsOnDay = useCallback((date: Date) =>
    events.filter(ev => {
      const evDate = new Date(ev.date_start);
      if (isSameDay(evDate, date)) return true;
      if (ev.date_end) {
        const endDate = new Date(ev.date_end);
        return date >= evDate && date <= endDate;
      }
      return false;
    }), [events]);

  const today   = new Date();
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0);  } else setMonth(m => m + 1); };

  const monthEvents = useMemo(() =>
    events.filter(ev => {
      const d = new Date(ev.date_start);
      return d.getFullYear() === year && d.getMonth() === month;
    }), [events, year, month]);

  const openDay = (date: Date) => {
    setSelectedDay(date);
    setModalVisible(true);
  };

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    headerAnim.setValue(0);
    Animated.timing(headerAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [month, year]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Calendrier</Text>
            <Aura color={AURA.primaryGlow} radius={12} onPress={() => router.push('/(organizer)/create-event' as any)}>
              <View style={{ backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
                <Ionicons name="add" size={16} color="#FFF"/>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Créer</Text>
              </View>
            </Aura>
          </View>

          {/* Month navigation */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }}
              onPress={prevMonth} activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={C.text}/>
            </TouchableOpacity>

            <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
              <TouchableOpacity onPress={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' }}>
                  {MONTHS[month]} {year}
                </Text>
                <Text style={{ fontSize: 11, color: C.textSub, textAlign: 'center', marginTop: 2 }}>
                  {monthEvents.length} événement{monthEvents.length !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }}
              onPress={nextMonth} activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={C.text}/>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, gap: 16 }}>

          {/* ── CALENDAR GRID ── */}
          <View style={cal.grid}>
            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DAYS.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: i >= 5 ? PRIMARY : C.textMuted }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            {Array.from({ length: calendarDays.length / 7 }, (_, weekIdx) => (
              <View key={weekIdx} style={{ flexDirection: 'row', gap: 2, marginBottom: 2 }}>
                {calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((date, dayIdx) => {
                  const isCurrentMonth = date.getMonth() === month;
                  const isToday = isSameDay(date, today);
                  const dayEvts = eventsOnDay(date);
                  return (
                    <DayCell
                      key={dayIdx}
                      date={date}
                      isCurrentMonth={isCurrentMonth}
                      isToday={isToday}
                      events={dayEvts}
                      onPress={() => openDay(date)}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* ── LEGEND ── */}
          {monthEvents.length > 0 && <MonthLegend events={monthEvents}/>}

          {/* ── THIS MONTH'S EVENTS ── */}
          {monthEvents.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
                Ce mois · {monthEvents.length} événement{monthEvents.length !== 1 ? 's' : ''}
              </Text>
              {monthEvents.map(ev => {
                const tc   = typeColor(ev.type);
                const days = Math.ceil((new Date(ev.date_start).getTime() - Date.now()) / 86400000);
                const isPast = days < 0;
                return (
                  <Aura key={ev.id} color={`${tc}55`} radius={12}
                    onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: ev.id } } as any)}>
                    <View style={[cal.evtCard, { borderLeftColor: tc }]}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={cal.evtTitle} numberOfLines={1}>{ev.title}</Text>
                        <Text style={cal.evtDate}>
                          {new Date(ev.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {ev.date_end ? ` → ${new Date(ev.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                        </Text>
                        <Text style={cal.evtLoc} numberOfLines={1}>{ev.location}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        {!isPast && (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                                         backgroundColor: days <= 3 ? AURA.dangerGhost : days <= 7 ? AURA.warningGhost : P_GHOST }}>
                            <Text style={{ fontSize: 10, fontWeight: '700',
                                           color: days <= 3 ? DANGER : days <= 7 ? WARNING : PRIMARY }}>
                              {days === 0 ? "Auj." : `J-${days}`}
                            </Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={14} color={C.textMuted}/>
                      </View>
                    </View>
                  </Aura>
                );
              })}
            </View>
          )}

          {monthEvents.length === 0 && !loading && (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={28} color={PRIMARY}/>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Aucun événement ce mois</Text>
              <Text style={{ color: C.textSub, fontSize: 12, textAlign: 'center' }}>
                Naviguez vers un autre mois ou créez un événement.
              </Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* ── DAY MODAL ── */}
      <DayModal
        visible={modalVisible}
        date={selectedDay ?? today}
        events={selectedDay ? eventsOnDay(selectedDay) : []}
        onClose={() => setModalVisible(false)}
        onCreateEvent={() => { setModalVisible(false); router.push('/(organizer)/create-event' as any); }}
      />
    </View>
  );
}

const cal = StyleSheet.create({
  grid:     { backgroundColor: C.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border },
  evtCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 12,
              padding: 14, borderLeftWidth: 3, borderWidth: 1, borderColor: C.border },
  evtTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  evtDate:  { fontSize: 12, color: C.textSub },
  evtLoc:   { fontSize: 11, color: C.textMuted },
});
