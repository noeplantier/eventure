/**
 * app/(organizer)/calendar.tsx — EVENTURE v3 · Dark Green
 *
 * Palette : #020A06 bg · #00D97E primary · #F5C842 gold
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useRouter }       from 'expo-router';
import { supabase }        from '@/lib/supabase';
import { getWorkingUid }   from '@/lib/mockUser';
import { useInteractiveBg } from '@/components/InteractiveBg';

/* ─── Palette — Dark Green ───────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG    = '#050E1B';
const BLUE = '#1A9FE3';
const GOLD  = '#FFFFFF';
const EDGE  = 16;

const T = {
  white   : '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.18)',
  surf    : 'rgba(255,255,255,0.045)',
  surfHi  : 'rgba(255,255,255,0.09)',
  border  : 'rgba(26,159,227,0.12)',
  borderHi: 'rgba(26,159,227,0.30)',
  navy    : '#0C1A30',
  amber   : 'rgba(255,255,255,0.65)',
  red     : 'rgba(255,255,255,0.45)',
  green   : '#1A9FE3',
  blue    : '#1A9FE3',
  purple  : '#1A9FE3',
} as const;

const SUCCESS = '#1A9FE3';
const WARNING = 'rgba(255,255,255,0.65)';
const DANGER  = 'rgba(255,255,255,0.45)';
const PURPLE  = '#1A9FE3';

const TYPE_COLORS: Record<string, string> = {
  Festival: SUCCESS, Gala: WARNING, Conférence: BLUE,
  Mariage: '#1A9FE3', Séminaire: PURPLE, Concert: DANGER, Sport: SUCCESS,
};
const typeColor = (t: string | null) => TYPE_COLORS[t ?? ''] ?? BLUE;

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS   = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();


/* ─── Types ──────────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string; title: string; date_start: string; date_end: string | null;
  location: string; status: string; type: string | null;
}

/* ─── Day Cell ───────────────────────────────────────────────────────────── */
const DayCell = memo(function DayCell({ date, isCurrentMonth, isToday, events, onPress }: {
  date: Date; isCurrentMonth: boolean; isToday: boolean; events: CalEvent[]; onPress: () => void;
}) {
  const CELL      = Math.floor((SW - EDGE * 2 - 12) / 7);
  const hasEvents = events.length > 0;
  const dots      = events.slice(0, 3).map(e => typeColor(e.type));

  return (
    <TouchableOpacity
      style={[
        { width: CELL, height: CELL + 8, alignItems: 'center', paddingTop: 6, borderRadius: 10 },
        isToday && { backgroundColor: BLUE },
        !isCurrentMonth && { opacity: 0.3 },
        hasEvents && !isToday && { backgroundColor: 'rgba(26,159,227,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
      ]}
      onPress={onPress}
      activeOpacity={hasEvents ? 0.7 : 1}
    >
      <Text style={{
        fontSize: 14,
        fontWeight: isToday ? '800' : hasEvents ? '700' : '400',
        color: isToday ? '#000' : isCurrentMonth ? T.white : T.muted,
      }}>
        {date.getDate()}
      </Text>
      {hasEvents && (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
          {dots.map((c, i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isToday ? 'rgba(0,0,0,0.6)' : c }}/>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

/* ─── Day Modal ──────────────────────────────────────────────────────────── */
const DayModal = memo(function DayModal({ visible, date, events, onClose, onCreateEvent }: {
  visible: boolean; date: Date; events: CalEvent[]; onClose: () => void; onCreateEvent: () => void;
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

  const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(2,10,6,0.82)', justifyContent: 'flex-end', opacity: bgAnim }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}/>
        <Animated.View style={[dm.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={['#0C1A30', BG]} style={StyleSheet.absoluteFillObject}/>

          <View style={[dm.handle, { backgroundColor: T.faint }]}/>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={[dm.dateTitle, { color: T.white }]}>{dayLabel}</Text>
            <TouchableOpacity onPress={onClose}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }}
              activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={T.muted}/>
            </TouchableOpacity>
          </View>

          {events.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              <Text style={[dm.sectionLabel, { color: T.muted }]}>{events.length} événement{events.length > 1 ? 's' : ''}</Text>
              <View style={{ gap: 8 }}>
                {events.map(ev => {
                  const tc = typeColor(ev.type);
                  return (
                    <View key={ev.id} style={[dm.evtRow, { backgroundColor: T.surf, borderLeftColor: tc,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }]}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[dm.evtTitle, { color: T.white }]} numberOfLines={1}>{ev.title}</Text>
                        <Text style={[dm.evtMeta, { color: T.offWhite }]} numberOfLines={1}>{ev.location}</Text>
                        {!!ev.type && <Text style={[dm.evtType, { color: tc }]}>{ev.type}</Text>}
                      </View>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: ev.status === 'published' ? 'rgba(26,159,227,0.12)' : T.surf,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: ev.status === 'published' ? T.borderHi : T.border }}>
                        <Text style={{ fontSize: 10, fontWeight: '700',
                          color: ev.status === 'published' ? BLUE : T.muted }}>
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
              <View style={{ width: 56, height: 56, borderRadius: 28,
                backgroundColor: 'rgba(26,159,227,0.10)', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: T.borderHi }}>
                <Ionicons name="calendar-outline" size={26} color={BLUE}/>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.white }}>Aucun événement</Text>
              <Text style={{ color: T.offWhite, fontSize: 12, textAlign: 'center' }}>Ce jour est libre.</Text>
            </View>
          )}

          <TouchableOpacity style={dm.createBtn} onPress={onCreateEvent} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(26,159,227,0.30)','rgba(26,159,227,0.14)']} style={StyleSheet.absoluteFillObject}/>
            <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:14,borderWidth:1,borderColor:T.borderHi}}/>
            <Ionicons name="add" size={18} color={BLUE}/>
            <Text style={dm.createTxt}>Créer un événement ce jour</Text>
          </TouchableOpacity>

          <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,
            borderTopLeftRadius:24,borderTopRightRadius:24,
            borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});
const dm = StyleSheet.create({
  sheet      : { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
    padding: 20, paddingTop: 12, backgroundColor: '#0C1A30' },
  handle     : { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  dateTitle  : { fontSize: 17, fontWeight: '800', textTransform: 'capitalize' },
  sectionLabel:{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  evtRow     : { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  evtTitle   : { fontSize: 14, fontWeight: '700' },
  evtMeta    : { fontSize: 12 },
  evtType    : { fontSize: 11, fontWeight: '600' },
  createBtn  : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14, marginTop: 16, overflow: 'hidden', backgroundColor: '#0C1A30' },
  createTxt  : { color: BLUE, fontWeight: '800', fontSize: 15 },
});

/* ─── Month Legend ───────────────────────────────────────────────────────── */
const MonthLegend = memo(({ events }: { events: CalEvent[] }) => {
  const types = [...new Set(events.map(e => e.type).filter(Boolean))] as string[];
  if (!types.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, gap: 8, paddingBottom: 2 }} style={{backgroundColor:'#050E1B'}}>
      {types.map(t => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
          backgroundColor: T.surf, borderWidth: 1, borderColor: T.border }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColor(t) }}/>
          <Text style={{ fontSize: 11, color: T.offWhite, fontWeight: '600' }}>{t}</Text>
        </View>
      ))}
    </ScrollView>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
/* ─── Enhanced particles ─── */
const _NUM_P = 32;
const _PCOLS = [
  '#1A9FE3','rgba(26,159,227,0.55)','#1A9FE3','rgba(26,159,227,0.40)',
  'rgba(255,255,255,0.28)','rgba(255,255,255,0.16)','rgba(26,159,227,0.22)',
];
const _PARTS = Array.from({ length: _NUM_P }, (_, i) => ({
  x:   (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
  y:   (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
  sz:  i % 9 === 0 ? 4.5 : i % 5 === 0 ? 3 : i % 3 === 0 ? 2.2 : 1.6,
  col: _PCOLS[i % _PCOLS.length],
  dur: 2400 + (i % 7) * 600,
  del: (i % 9) * 220,
  glow: i % 7 === 0,
}));
function ParticleBg() {
  const anims = React.useRef(_PARTS.map(() => new Animated.Value(0))).current;
  React.useEffect(() => {
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
      <LinearGradient colors={['#050E1B','#091628','#05112A','#050E1B']} locations={[0,0.3,0.7,1]} style={StyleSheet.absoluteFill}/>
      <View style={{position:'absolute',top:'6%',left:'-25%',right:'-25%',height:'50%',backgroundColor:'rgba(26,159,227,0.035)',borderRadius:999}}/>
      {_PARTS.map((p, i) => {
        const opacity = anims[i].interpolate({ inputRange:[0,1], outputRange:[0.10, p.glow ? 0.80 : 0.52] });
        const scale   = anims[i].interpolate({ inputRange:[0,1], outputRange:[0.6, 1.4] });
        return (
          <Animated.View key={i} style={{
            position:'absolute', left:`${p.x}%` as any, top:`${p.y}%` as any,
            width:p.sz, height:p.sz, borderRadius:p.sz/2, backgroundColor:p.col,
            opacity, transform:[{scale}],
          }}/>
        );
      })}
    </View>
  );
}

export default function CalendarScreen() {
  const router = useRouter();

  const [events,       setEvents]       = useState<CalEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [month,        setMonth]        = useState(new Date().getMonth());
  const [selectedDay,  setSelectedDay]  = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const uid = await getWorkingUid();
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

  const calendarDays = useMemo(() => {
    const first    = new Date(year, month, 1);
    const last     = new Date(year, month + 1, 0);
    const startDay = (first.getDay() + 6) % 7;
    const days: Date[] = [];
    for (let i = startDay - 1; i >= 0; i--) days.push(new Date(year, month, -i));
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, month, i));
    while (days.length % 7 !== 0) days.push(new Date(year, month + 1, days.length - last.getDate() - startDay + 1));
    return days;
  }, [year, month]);

  const eventsOnDay = useCallback((date: Date) =>
    events.filter(ev => {
      const evDate = new Date(ev.date_start);
      if (isSameDay(evDate, date)) return true;
      if (ev.date_end) { const endDate = new Date(ev.date_end); return date >= evDate && date <= endDate; }
      return false;
    }), [events]);

  const today     = new Date();
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const monthEvents = useMemo(() =>
    events.filter(ev => { const d = new Date(ev.date_start); return d.getFullYear() === year && d.getMonth() === month; }),
    [events, year, month]);

  const openDay = (date: Date) => { setSelectedDay(date); setModalVisible(true); };

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    headerAnim.setValue(0);
    Animated.timing(headerAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [month, year]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: T.white }}>Calendrier</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, overflow: 'hidden',
                backgroundColor: '#0C1A30', borderWidth: 1, borderColor: T.borderHi }}
              onPress={() => router.push('/(organizer)/create-event' as any)}
              activeOpacity={0.82}
            >
              <LinearGradient colors={['rgba(26,159,227,0.25)','rgba(26,159,227,0.10)']} style={StyleSheet.absoluteFillObject}/>
              <Ionicons name="add" size={16} color={BLUE}/>
              <Text style={{ color: BLUE, fontWeight: '700', fontSize: 13 }}>Créer</Text>
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.surf,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: T.border }}
              onPress={prevMonth} activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={T.white}/>
            </TouchableOpacity>

            <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
              <TouchableOpacity onPress={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.white, textAlign: 'center' }}>
                  {MONTHS[month]} {year}
                </Text>
                <Text style={{ fontSize: 11, color: BLUE, textAlign: 'center', marginTop: 2, fontWeight: '600' }}>
                  {monthEvents.length} événement{monthEvents.length !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.surf,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: T.border }}
              onPress={nextMonth} activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={T.white}/>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{backgroundColor:'#050E1B',flexGrow:1, paddingHorizontal: EDGE, paddingBottom: 120, gap: 16 }} style={{backgroundColor:'#050E1B'}}>

          {/* ── CALENDAR GRID ── */}
          <View style={[cal.grid, { backgroundColor: '#0C1A30', borderColor: T.border }]}>
            <LinearGradient colors={[`${BLUE}08`,`${BLUE}02`]} style={StyleSheet.absoluteFillObject}/>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DAYS.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: i >= 5 ? BLUE : T.muted }}>{d}</Text>
                </View>
              ))}
            </View>
            {Array.from({ length: calendarDays.length / 7 }, (_, weekIdx) => (
              <View key={weekIdx} style={{ flexDirection: 'row', gap: 2, marginBottom: 2 }}>
                {calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((date, dayIdx) => (
                  <DayCell
                    key={dayIdx}
                    date={date}
                    isCurrentMonth={date.getMonth() === month}
                    isToday={isSameDay(date, today)}
                    events={eventsOnDay(date)}
                    onPress={() => openDay(date)}
                  />
                ))}
              </View>
            ))}
            <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,
              borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
          </View>

          {/* ── LEGEND ── */}
          {monthEvents.length > 0 && <MonthLegend events={monthEvents}/>}

          {/* ── THIS MONTH'S EVENTS ── */}
          {monthEvents.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.white }}>
                Ce mois · <Text style={{ color: BLUE }}>{monthEvents.length}</Text> événement{monthEvents.length !== 1 ? 's' : ''}
              </Text>
              {monthEvents.map(ev => {
                const tc   = typeColor(ev.type);
                const days = Math.ceil((new Date(ev.date_start).getTime() - Date.now()) / 86400000);
                const isPast = days < 0;
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[cal.evtCard, { backgroundColor: '#0C1A30', borderColor: T.border, borderLeftColor: tc }]}
                    onPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: ev.id } } as any)}
                    activeOpacity={0.82}
                  >
                    <LinearGradient colors={[`${tc}0A`,`${tc}03`]} style={StyleSheet.absoluteFillObject}/>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[cal.evtTitle, { color: T.white }]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={[cal.evtDate, { color: T.offWhite }]}>
                        {new Date(ev.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {ev.date_end ? ` → ${new Date(ev.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                      </Text>
                      <Text style={[cal.evtLoc, { color: T.muted }]} numberOfLines={1}>{ev.location}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {!isPast && (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                          backgroundColor: days <= 3 ? 'rgba(255,255,255,0.05)' : days <= 7 ? 'rgba(255,255,255,0.07)' : 'rgba(26,159,227,0.10)',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: days <= 3 ? 'rgba(239,68,68,0.25)' : days <= 7 ? 'rgba(245,158,11,0.25)' : T.border }}>
                          <Text style={{ fontSize: 10, fontWeight: '700',
                            color: days <= 3 ? DANGER : days <= 7 ? WARNING : BLUE }}>
                            {days === 0 ? "Auj." : `J-${days}`}
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={14} color={T.muted}/>
                    </View>
                    <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,
                      borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {monthEvents.length === 0 && !loading && (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(26,159,227,0.10)', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: T.borderHi }}>
                <Ionicons name="calendar-outline" size={28} color={BLUE}/>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: T.white }}>Aucun événement ce mois</Text>
              <Text style={{ color: T.offWhite, fontSize: 12, textAlign: 'center' }}>
                Naviguez vers un autre mois ou créez un événement.
              </Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

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
  grid   : { borderRadius: 16, padding: 12, borderWidth: 1, overflow: 'hidden' },
  evtCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12,
    padding: 14, borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden' },
  evtTitle: { fontSize: 14, fontWeight: '700' },
  evtDate : { fontSize: 12 },
  evtLoc  : { fontSize: 11 },
});
