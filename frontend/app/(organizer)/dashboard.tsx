/**
 * app/(organizer)/dashboard.tsx — PUT.IN COFFEE Command Hub
 * Sanur · Bali — Real-time organizer dashboard for Arik
 * Color system: #020818 BG / #030B1E NAVY / #010610 DEEP — WHITE only
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { BlurView }          from 'expo-blur';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { StatusBar }         from 'expo-status-bar';
import { useRouter }         from 'expo-router';
import { supabase }          from '@/lib/supabase';
import { sendWhatsApp, broadcastWhatsApp, WAType } from '@/lib/whatsapp';
import AppHeader             from '@/components/AppHeader';

/* ─── Design tokens ──────────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG     = '#020818';
const NAVY   = '#030B1E';
const WHITE  = '#FFFFFF';
const GLASS  = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.10)';
const DIM    = 'rgba(255,255,255,0.35)';
const EDGE   = 20;
const GRAD   = ['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610'] as const;

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const ORGANIZER_ID = '4c9525d8-04a6-41fb-beaa-9e9448134819';
const TODAY        = new Date().toISOString().split('T')[0];
const IN7          = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

const PUT_IN_TEAM = ['Arik', 'Oka', 'Redo'] as const;

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface DBEvent {
  id         : string;
  title      : string;
  type       : string | null;
  status     : string;
  date_start : string;
  date_end   : string | null;
  location   : string | null;
  event_roles: { id: string; role: string; slots: number | null; slots_filled: number | null }[];
}

interface DBStaff {
  id           : string;
  display_name : string;
  avatar_url   : string | null;
  is_available : boolean;
}

interface DBAvailability {
  id           : string;
  staff_id     : string;
  date         : string;
  is_available : boolean;
}

interface DBPayroll {
  id           : string;
  staff_id     : string;
  hours        : number | null;
  amount       : number | null;
  status       : 'pending' | 'approved' | 'paid' | string;
  week_start   : string | null;
  staff        : { display_name: string } | null;
}

interface DBActivity {
  id         : string;
  staff_id   : string | null;
  event_type : string | null;
  created_at : string;
  staff      : { display_name: string } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const initials = (name: string) => name.slice(0, 2).toUpperCase();

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'maintenant';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

const fmtWeek = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const payrollStatusLabel = (s: string) => {
  if (s === 'approved') return 'Approuvé';
  if (s === 'paid')     return 'Payé';
  return 'En attente';
};

const payrollStatusStyle = (s: string) => {
  if (s === 'paid')     return { borderColor: 'rgba(255,255,255,0.50)', color: WHITE };
  if (s === 'approved') return { borderColor: 'rgba(255,255,255,0.35)', color: WHITE };
  return { borderColor: 'rgba(255,255,255,0.20)', color: DIM };
};

/* ─── ParticleBg ─────────────────────────────────────────────────────────────── */
function ParticleBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={GRAD}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{
        position: 'absolute',
        top: '10%',
        left: '-20%',
        right: '-20%',
        height: '40%',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.015)',
      }} />
    </View>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────────── */
function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

/* ─── Avatar circle ──────────────────────────────────────────────────────────── */
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: NAVY,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ color: WHITE, fontSize: size * 0.32, fontWeight: '800' }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/* ─── Staff Status Cards (Section 1) ────────────────────────────────────────── */
interface StaffStatusProps {
  staff        : DBStaff[];
  availData    : DBAvailability[];
}
function StaffStatusSection({ staff, availData }: StaffStatusProps) {
  const todayAvail = useMemo(() => {
    const map: Record<string, boolean | undefined> = {};
    availData.filter(a => a.date === TODAY).forEach(a => { map[a.staff_id] = a.is_available; });
    return map;
  }, [availData]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Équipe · Aujourd'hui" />
      <View style={styles.staffRow}>
        {staff.map(member => {
          const avail = todayAvail[member.id];
          const isAvailable = avail === true;
          const isUndefined  = avail === undefined;

          return (
            <View key={member.id} style={styles.staffCard}>
              <Avatar name={member.display_name} size={38} />
              <Text style={styles.staffName}>{member.display_name}</Text>
              {/* Availability dot */}
              <View style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isAvailable
                  ? WHITE
                  : isUndefined
                    ? 'rgba(255,255,255,0.20)'
                    : 'rgba(255,255,255,0.20)',
                opacity: isAvailable ? 1 : 0.4,
              }} />
              <Text style={styles.staffAvailLabel}>
                {isAvailable ? 'Dispo' : isUndefined ? '—' : 'Indispo'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Event List (Section 2) ─────────────────────────────────────────────────── */
interface EventListProps {
  events : DBEvent[];
  staff  : DBStaff[];
  onPress: (id: string) => void;
}
function EventListSection({ events, staff, onPress }: EventListProps) {
  const upcoming = useMemo(
    () => events.filter(e => e.status !== 'completed').slice(0, 3),
    [events],
  );

  if (upcoming.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Cette semaine" />
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={32} color={DIM} />
          <Text style={styles.emptyText}>Aucun événement à venir</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="Cette semaine" />
      <View style={{ gap: 12, paddingHorizontal: EDGE }}>
        {upcoming.map(evt => {
          const isPublished = evt.status === 'published';
          const statusBorderColor = isPublished
            ? 'rgba(255,255,255,0.50)'
            : 'rgba(255,255,255,0.20)';
          const statusTextColor = isPublished ? WHITE : DIM;
          const statusLabel = isPublished ? 'Publié' : 'Brouillon';

          return (
            <TouchableOpacity
              key={evt.id}
              style={styles.eventCard}
              onPress={() => onPress(evt.id)}
              activeOpacity={0.82}
            >
              {/* Top row: title + status */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventCardTitle} numberOfLines={2}>{evt.title}</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: statusBorderColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {/* Type pill */}
              {evt.type ? (
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{evt.type}</Text>
                </View>
              ) : null}

              {/* Date + location */}
              <View style={{ gap: 4, marginTop: 6 }}>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={WHITE} />
                  <Text style={styles.metaText}>{fmtDate(evt.date_start)}</Text>
                </View>
                {evt.location ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={12} color={WHITE} />
                    <Text style={styles.metaText}>{evt.location}</Text>
                  </View>
                ) : null}
              </View>

              {/* Staff availability dots row */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
                {staff.map(s => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{
                      width: 7, height: 7, borderRadius: 3.5,
                      backgroundColor: s.is_available ? WHITE : 'rgba(255,255,255,0.20)',
                    }} />
                    <Text style={{ color: DIM, fontSize: 10, fontWeight: '500' }}>{s.display_name}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Availability Grid (Section 3) ─────────────────────────────────────────── */
interface AvailGridProps {
  staff    : DBStaff[];
  availData: DBAvailability[];
  onToggle : (staffId: string, date: string, current: boolean | undefined) => void;
}
function AvailabilityGridSection({ staff, availData, onToggle }: AvailGridProps) {
  const DAYS = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      label  : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).toUpperCase(),
    };
  }), []);

  const availMap = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    availData.forEach(row => {
      if (!map[row.staff_id]) map[row.staff_id] = {};
      map[row.staff_id][row.date] = row.is_available;
    });
    return map;
  }, [availData]);

  // Filter to only Put.in Coffee staff (Arik, Oka, Redo)
  const teamStaff = useMemo(
    () => staff.filter(s => PUT_IN_TEAM.includes(s.display_name as typeof PUT_IN_TEAM[number])),
    [staff],
  );

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Disponibilités · 7 jours"
        right={
          <View style={styles.weekPill}>
            <Text style={styles.weekPillText}>Semaine</Text>
          </View>
        }
      />
      <View style={[styles.glassCard, { marginHorizontal: EDGE }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 14 }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              <View style={{ width: 72 }} />
              {DAYS.map(d => (
                <View key={d.dateStr} style={styles.gridCell}>
                  <Text style={styles.gridDayLabel}>{d.label}</Text>
                </View>
              ))}
            </View>

            {/* Staff rows */}
            {teamStaff.map(member => {
              const staffAvail = availMap[member.id] ?? {};
              return (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  {/* Avatar + name */}
                  <View style={{ width: 72, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Avatar name={member.display_name} size={24} />
                    <Text style={{ color: WHITE, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                      {member.display_name.length > 6
                        ? member.display_name.slice(0, 6)
                        : member.display_name}
                    </Text>
                  </View>
                  {/* Day cells */}
                  {DAYS.map(d => {
                    const val = staffAvail[d.dateStr];
                    const isAvail = val === true;
                    const isDefined = val !== undefined;
                    return (
                      <TouchableOpacity
                        key={d.dateStr}
                        style={styles.gridCell}
                        onPress={() => onToggle(member.id, d.dateStr, val)}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: isAvail ? WHITE : isDefined ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderColor: isAvail ? WHITE : 'rgba(255,255,255,0.15)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {isDefined && (
                            <Ionicons
                              name={isAvail ? 'checkmark' : 'close'}
                              size={12}
                              color={isAvail ? '#020818' : DIM}
                            />
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
      </View>
    </View>
  );
}

/* ─── Payroll Section (Section 4) ────────────────────────────────────────────── */
interface PayrollSectionProps {
  payroll: DBPayroll[];
  onNavigate: () => void;
}
function PayrollSection({ payroll, onNavigate }: PayrollSectionProps) {
  const total = useMemo(
    () => payroll.reduce((acc, p) => acc + (p.amount ?? 0), 0),
    [payroll],
  );

  const weekStart = payroll[0]?.week_start ?? TODAY;

  return (
    <View style={styles.section}>
      <SectionHeader title="Paie · Cette semaine" />
      <View style={[styles.glassCard, { marginHorizontal: EDGE }]}>
        {/* Week label */}
        <View style={styles.payrollWeekRow}>
          <Ionicons name="wallet-outline" size={14} color={WHITE} />
          <Text style={styles.payrollWeekText}>
            Semaine du {fmtWeek(weekStart)} au {fmtWeek(IN7)}
          </Text>
        </View>

        {payroll.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune paie en attente</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            {payroll.map(p => {
              const pStyle = payrollStatusStyle(p.status);
              return (
                <View key={p.id} style={styles.payrollRow}>
                  <Avatar name={p.staff?.display_name ?? '?'} size={32} />
                  <Text style={styles.payrollName} numberOfLines={1}>
                    {p.staff?.display_name ?? '—'}
                  </Text>
                  <Text style={styles.payrollHours}>{p.hours ?? 0}h</Text>
                  <Text style={styles.payrollAmount}>{p.amount ?? 0}€</Text>
                  <View style={[styles.payrollStatus, { borderColor: pStyle.borderColor }]}>
                    <Text style={[styles.payrollStatusText, { color: pStyle.color }]}>
                      {payrollStatusLabel(p.status)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={styles.payrollFooter}>
          <TouchableOpacity onPress={onNavigate} activeOpacity={0.7}>
            <Text style={styles.payrollDetailsLink}>Voir détails →</Text>
          </TouchableOpacity>
          <Text style={styles.payrollTotal}>Total : {total}€</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Activity Feed (Section 5) ─────────────────────────────────────────────── */
function ActivitySection({ activity }: { activity: DBActivity[] }) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Activité récente" />
      {activity.length === 0 ? (
        <View style={[styles.emptyState, { paddingHorizontal: EDGE }]}>
          <Ionicons name="time-outline" size={32} color={DIM} />
          <Text style={styles.emptyText}>Aucune activité</Text>
        </View>
      ) : (
        <View style={{ gap: 1, paddingHorizontal: EDGE }}>
          {activity.map((item, i) => {
            const name = item.staff?.display_name ?? 'Inconnu';
            const eventLabel = item.event_type === 'available'
              ? 'Disponible'
              : item.event_type === 'unavailable'
                ? 'Indisponible'
                : item.event_type ?? 'Activité';
            return (
              <View key={item.id} style={[
                styles.activityRow,
                i < activity.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
              ]}>
                <Avatar name={name} size={32} />
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={styles.activityName} numberOfLines={1}>
                    {name} · <Text style={{ color: WHITE, fontWeight: '400' }}>{eventLabel}</Text>
                  </Text>
                  <Text style={styles.activityDate}>
                    Le {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.activityTime}>{relativeTime(item.created_at)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ─── Quick Actions (Section 6) ─────────────────────────────────────────────── */
interface QuickActionsProps {
  onWA      : () => void;
  onEvent   : () => void;
  onPayroll : () => void;
  onNotifs  : () => void;
}
function QuickActionsSection({ onWA, onEvent, onPayroll, onNotifs }: QuickActionsProps) {
  const ACTIONS = [
    { icon: 'logo-whatsapp' as const,       label: 'WhatsApp', onPress: onWA },
    { icon: 'calendar-outline' as const,    label: 'Événement', onPress: onEvent },
    { icon: 'cash-outline' as const,        label: 'Paie',      onPress: onPayroll },
    { icon: 'notifications-outline' as const, label: 'Notifs', onPress: onNotifs },
  ];
  return (
    <View style={styles.section}>
      <SectionHeader title="Actions rapides" />
      <View style={styles.actionsGrid}>
        {ACTIONS.map(a => (
          <TouchableOpacity
            key={a.label}
            style={styles.actionBtn}
            onPress={a.onPress}
            activeOpacity={0.75}
          >
            <Ionicons name={a.icon} size={24} color={WHITE} />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ─── WhatsApp Modal ─────────────────────────────────────────────────────────── */
interface WAModalProps {
  visible  : boolean;
  staff    : DBStaff[];
  onClose  : () => void;
}
function WAModal({ visible, staff, onClose }: WAModalProps) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [selectedStaff, setSelectedStaff] = useState<string | 'broadcast'>('broadcast');
  const [msgType, setMsgType]             = useState<WAType>('general');
  const [customMsg, setCustomMsg]         = useState('');
  const [sending, setSending]             = useState(false);
  const [feedback, setFeedback]           = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      friction: 14,
      tension: 90,
      useNativeDriver: true,
    }).start();
    if (!visible) {
      setFeedback(null);
      setCustomMsg('');
      setSending(false);
    }
  }, [visible]);

  const MSG_TYPES: { key: WAType; label: string }[] = [
    { key: 'general',          label: 'Message général' },
    { key: 'shift_assigned',   label: 'Shift assigné' },
    { key: 'availability_ask', label: 'Demande dispo' },
    { key: 'payroll_approved', label: 'Paie approuvée' },
  ];

  const teamStaff = useMemo(
    () => staff.filter(s => ['Oka', 'Redo'].includes(s.display_name)),
    [staff],
  );

  const handleSend = useCallback(async () => {
    setSending(true);
    setFeedback(null);
    try {
      if (selectedStaff === 'broadcast') {
        const results = await broadcastWhatsApp(msgType, customMsg || undefined);
        const allOk = results.every(r => r.ok);
        setFeedback({ ok: allOk, text: allOk ? 'Messages envoyés à toute l\'équipe !' : 'Certains messages ont échoué.' });
      } else {
        const result = await sendWhatsApp(selectedStaff, msgType, customMsg || undefined);
        setFeedback({
          ok  : result.ok,
          text: result.ok
            ? 'Message envoyé !'
            : result.error ?? 'Erreur lors de l\'envoi',
        });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e.message ?? 'Erreur inconnue' });
    } finally {
      setSending(false);
    }
  }, [selectedStaff, msgType, customMsg]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.modal, { transform: [{ translateY: slideAnim }] }]}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalHandle} />

        <Text style={styles.modalTitle}>WhatsApp · Équipe</Text>

        {/* Staff selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: EDGE }}>
            {/* Broadcast chip */}
            <TouchableOpacity
              style={[styles.staffChip, selectedStaff === 'broadcast' && styles.staffChipActive]}
              onPress={() => setSelectedStaff('broadcast')}
            >
              <Ionicons name="megaphone-outline" size={14} color={WHITE} />
              <Text style={[styles.staffChipText, selectedStaff === 'broadcast' && { color: BG }]}>
                Tout le monde
              </Text>
            </TouchableOpacity>

            {teamStaff.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.staffChip, selectedStaff === s.id && styles.staffChipActive]}
                onPress={() => setSelectedStaff(s.id)}
              >
                <Avatar name={s.display_name} size={20} />
                <Text style={[styles.staffChipText, selectedStaff === s.id && { color: BG }]}>
                  {s.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Message type */}
        <View style={{ paddingHorizontal: EDGE, gap: 8, marginBottom: 16 }}>
          <Text style={styles.modalLabel}>Type de message</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MSG_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, msgType === t.key && styles.typeChipActive]}
                onPress={() => setMsgType(t.key)}
              >
                <Text style={[styles.typeChipText, msgType === t.key && { color: BG }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom message input */}
        <View style={{ paddingHorizontal: EDGE, marginBottom: 20 }}>
          <Text style={styles.modalLabel}>Message (optionnel)</Text>
          <TextInput
            style={styles.msgInput}
            placeholder="Ajouter un message personnalisé..."
            placeholderTextColor={DIM}
            value={customMsg}
            onChangeText={setCustomMsg}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Feedback */}
        {feedback && (
          <View style={[styles.feedbackRow, { borderColor: feedback.ok ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.20)' }]}>
            <Ionicons
              name={feedback.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={16}
              color={feedback.ok ? WHITE : DIM}
            />
            <Text style={[styles.feedbackText, { color: feedback.ok ? WHITE : DIM }]}>
              {feedback.text}
            </Text>
          </View>
        )}

        {/* Send button */}
        <View style={{ paddingHorizontal: EDGE, gap: 12 }}>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color={BG} size="small" />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={18} color={BG} />
                <Text style={styles.sendBtnText}>Envoyer</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ─── MAIN SCREEN ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const router = useRouter();

  /* State */
  const [loading, setLoading]       = useState(true);
  const [events, setEvents]         = useState<DBEvent[]>([]);
  const [staff, setStaff]           = useState<DBStaff[]>([]);
  const [availData, setAvailData]   = useState<DBAvailability[]>([]);
  const [payroll, setPayroll]       = useState<DBPayroll[]>([]);
  const [activity, setActivity]     = useState<DBActivity[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [waVisible, setWaVisible]   = useState(false);

  /* Data fetch */
  const fetchAll = useCallback(async () => {
    try {
      const [evRes, stRes, avRes, paRes, notifRes, actRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, event_roles(*)')
          .order('date_start', { ascending: true }),
        supabase
          .from('staff')
          .select('*')
          .in('display_name', [...PUT_IN_TEAM]),
        supabase
          .from('staff_availability')
          .select('*')
          .gte('date', TODAY)
          .lte('date', IN7),
        supabase
          .from('payroll')
          .select('*, staff(display_name)')
          .in('status', ['pending', 'approved']),
        supabase
          .from('notifications')
          .select('id')
          .eq('read', false)
          .eq('organizer_id', ORGANIZER_ID),
        supabase
          .from('availability_events')
          .select('*, staff(display_name)')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (evRes.data)    setEvents(evRes.data as DBEvent[]);
      if (stRes.data)    setStaff(stRes.data as DBStaff[]);
      if (avRes.data)    setAvailData(avRes.data as DBAvailability[]);
      if (paRes.data)    setPayroll(paRes.data as DBPayroll[]);
      if (notifRes.data) setNotifCount(notifRes.data.length);
      if (actRes.data)   setActivity(actRes.data as DBActivity[]);
    } catch (e) {
      console.warn('[Dashboard] fetchAll error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* Realtime subscriptions */
  useEffect(() => {
    ['hub_events', 'hub_avail', 'hub_activity', 'hub_payroll'].forEach(t =>
      supabase.getChannels()
        .filter(c => c.topic === `realtime:${t}`)
        .forEach(c => supabase.removeChannel(c)),
    );

    const sub = supabase
      .channel('hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },             fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_availability' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_events' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' },            fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [fetchAll]);

  /* Toggle availability */
  const handleToggleAvailability = useCallback(async (
    staffId : string,
    date    : string,
    current : boolean | undefined,
  ) => {
    const newVal = current === true ? false : true;
    if (current === undefined) {
      await supabase.from('staff_availability').insert({ staff_id: staffId, date, is_available: newVal });
    } else {
      await supabase
        .from('staff_availability')
        .update({ is_available: newVal })
        .eq('staff_id', staffId)
        .eq('date', date);
    }
    fetchAll();
  }, [fetchAll]);

  const handleEventPress = useCallback((id: string) => {
    router.push(`/(organizer)/event/${id}` as any);
  }, [router]);

  /* ────────────────────────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <ParticleBg />

      {/* Fixed header */}
      <AppHeader
        title="PUT.IN COFFEE"
        subtitle="Sanur · Bali · Hub"
        notifCount={notifCount}
        onBell={() => setShowNotifs(true)}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={WHITE} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: BG }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
        >
          {/* Section 1: Staff Status */}
          <StaffStatusSection staff={staff} availData={availData} />

          {/* Section 2: Events this week */}
          <EventListSection
            events={events}
            staff={staff}
            onPress={handleEventPress}
          />

          {/* Section 3: 7-day availability grid */}
          <AvailabilityGridSection
            staff={staff}
            availData={availData}
            onToggle={handleToggleAvailability}
          />

          {/* Section 4: Payroll */}
          <PayrollSection
            payroll={payroll}
            onNavigate={() => router.push('/(organizer)/payroll' as any)}
          />

          {/* Section 5: Activity feed */}
          <ActivitySection activity={activity} />

          {/* Section 6: Quick actions */}
          <QuickActionsSection
            onWA={() => setWaVisible(true)}
            onEvent={() => router.push('/(organizer)/create-event' as any)}
            onPayroll={() => router.push('/(organizer)/payroll' as any)}
            onNotifs={() => setShowNotifs(true)}
          />
        </ScrollView>
      )}

      {/* WhatsApp Modal */}
      <WAModal
        visible={waVisible}
        staff={staff}
        onClose={() => setWaVisible(false)}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Sections */
  section: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EDGE,
    marginBottom: 14,
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  /* Glass card */
  glassCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
  },

  /* Week pill */
  weekPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
  },
  weekPillText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '600',
  },

  /* Empty states */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    color: DIM,
    fontSize: 13,
    fontWeight: '500',
  },

  /* Staff row */
  staffRow: {
    flexDirection: 'row',
    paddingHorizontal: EDGE,
    gap: 12,
  },
  staffCard: {
    flex: 1,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  staffAvailLabel: {
    color: DIM,
    fontSize: 10,
    fontWeight: '500',
  },

  /* Event cards */
  eventCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 16,
  },
  eventCardTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  typePillText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '500',
  },

  /* Grid */
  gridCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDayLabel: {
    color: DIM,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* Payroll */
  payrollWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  payrollWeekText: {
    color: DIM,
    fontSize: 11,
    fontWeight: '600',
  },
  payrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payrollName: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
  },
  payrollHours: {
    color: DIM,
    fontSize: 12,
    fontWeight: '600',
    width: 36,
    textAlign: 'right',
  },
  payrollAmount: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    width: 48,
    textAlign: 'right',
  },
  payrollStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  payrollStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  payrollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  payrollDetailsLink: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '600',
  },
  payrollTotal: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },

  /* Activity */
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityName: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityDate: {
    color: DIM,
    fontSize: 10,
    fontWeight: '500',
  },
  activityTime: {
    color: DIM,
    fontSize: 10,
    fontWeight: '600',
  },

  /* Quick actions */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: EDGE,
    gap: 12,
  },
  actionBtn: {
    width: (SW - EDGE * 2 - 12) / 2,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
  },

  /* WhatsApp Modal */
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: BORDER,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: EDGE,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  modalLabel: {
    color: DIM,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Staff / type chips */
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS,
  },
  staffChipActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  staffChipText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS,
  },
  typeChipActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  typeChipText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '600',
  },

  /* Message input */
  msgInput: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    color: WHITE,
    fontSize: 13,
    fontWeight: '500',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  /* Feedback */
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: EDGE,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* Send / Cancel buttons */
  sendBtn: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnText: {
    color: BG,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  cancelBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
});
