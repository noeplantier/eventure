/**
 * app/(organizer)/event/[id].tsx — EVENTURE v3
 * Production-quality event detail page.
 * Design: #020818 bg, Apple Liquid Glass cards.
 * Tabs: Détails / Équipe (invitations) / Missions (création + liste)
 */

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image }                   from 'expo-image';
import { LinearGradient }          from 'expo-linear-gradient';
import { BlurView }                from 'expo-blur';
import { Ionicons }                from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets }       from 'react-native-safe-area-context';
import { supabase }                from '@/lib/supabase';

/* ─── react-native-maps: lazy require, native-only ──────────────────────── */
const RNMaps       = Platform.OS !== 'web' ? require('react-native-maps') : null;
const MapView: any = RNMaps?.default ?? View;
const Marker: any  = RNMaps?.Marker  ?? (() => null);

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const BG    = '#020818';
const BLUE  = '#FFFFFF';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';
const FAINT = 'rgba(255,255,255,0.06)';
const GREEN = '#10B981';
const RED   = '#EF4444';
const EDGE  = 18;

/* ─── Tab types ──────────────────────────────────────────────────────────── */
const TABS = ['Détails', 'Équipe', 'Missions'] as const;
type Tab = typeof TABS[number];

/* ─── Status config ──────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  published : { label: 'PUBLIÉ',    color: WHITE, bg: 'rgba(255,255,255,0.15)' },
  draft     : { label: 'BROUILLON', color: WHITE, bg: 'rgba(255,255,255,0.07)' },
  ongoing   : { label: 'EN COURS',  color: WHITE, bg: 'rgba(255,255,255,0.12)' },
  completed : { label: 'TERMINÉ',   color: WHITE, bg: 'rgba(255,255,255,0.08)' },
  cancelled : { label: 'ANNULÉ',    color: WHITE, bg: 'rgba(255,255,255,0.05)' },
};

/* ─── Mission status config ──────────────────────────────────────────────── */
const MISSION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending     : { label: 'en attente',  color: WHITE, bg: 'rgba(255,255,255,0.07)' },
  confirmed   : { label: 'confirmée',   color: WHITE, bg: 'rgba(255,255,255,0.12)' },
  in_progress : { label: 'en cours',    color: WHITE, bg: 'rgba(255,255,255,0.15)' },
  completed   : { label: 'terminée',    color: '#FFFFFF', bg: 'rgba(255,255,255,0.08)' },
  cancelled   : { label: 'annulée',     color: '#FFFFFF', bg: 'rgba(255,255,255,0.04)' },
};

/* ─── Type icons ─────────────────────────────────────────────────────────── */
const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Techno':     'flash-outline',
  'House':      'musical-notes-outline',
  'Rock':       'musical-note-outline',
  'Festival':   'ribbon-outline',
  'Gala':       'sparkles-outline',
  'Conférence': 'mic-outline',
};

/* ─── Dark map style ─────────────────────────────────────────────────────── */
const mapStyle = [
  { elementType: 'geometry',         stylers: [{ color: '#0A1628' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8BAFC9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F172A' }] },
  { featureType: 'road',  elementType: 'geometry',        stylers: [{ color: '#0C2A4A' }] },
  { featureType: 'road',  elementType: 'geometry.stroke', stylers: [{ color: '#0A1628' }] },
  { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#0F172A' }] },
  { featureType: 'poi',   stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };
  return d.toLocaleDateString('fr-FR', opts);
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface EventRow {
  id: string;
  title: string;
  type: string | null;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  budget: number | null;
  description: string | null;
  status: string | null;
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface StaffMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number | null;
}

interface Mission {
  id: string;
  status: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  date_start: string | null;
  date_end: string | null;
  staff: StaffMember | null;
}

interface EventRole {
  id: string;
  role: string | null;
  slots: number | null;
  hourly_rate: number | null;
  filled_slots: number | null;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Animated skeleton pulse */
function SkeletonPulse({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 10 }, style, { opacity }]}
    />
  );
}

/** Glass card wrapper */
function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.glassCard, style]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      {/* top white sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.00)']}
        style={styles.cardSheen}
      />
      <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
    </View>
  );
}

/** Expandable description */
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <Text
        style={styles.descriptionText}
        numberOfLines={expanded ? undefined : 3}
      >
        {text}
      </Text>
      {text.length > 120 && (
        <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={{ marginTop: 8 }}>
          <Text style={styles.showMoreText}>
            {expanded ? 'Voir moins' : 'Voir plus'}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────────────────── */
function LoadingSkeleton({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ backgroundColor: BG, paddingBottom: 120 }}
      scrollEnabled={false}
    >
      {/* hero */}
      <SkeletonPulse style={{ height: 200, borderRadius: 0 }} />
      <View style={{ paddingHorizontal: EDGE, paddingTop: 20, gap: 10 }}>
        <SkeletonPulse style={{ height: 28, width: '70%' }} />
        <SkeletonPulse style={{ height: 22, width: '40%' }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <SkeletonPulse style={{ height: 26, width: 80 }} />
          <SkeletonPulse style={{ height: 26, width: 80 }} />
        </View>
      </View>
      <View style={{ paddingHorizontal: EDGE, marginTop: 24, gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <SkeletonPulse key={i} style={{ height: 90, borderRadius: 16 }} />
        ))}
      </View>
    </ScrollView>
  );
}

/* ─── Staff card ─────────────────────────────────────────────────────────── */
function StaffCard({ mission, onPress }: { mission: Mission; onPress: () => void }) {
  const staff = mission.staff;
  const msCfg = MISSION_STATUS[mission.status ?? ''] ?? MISSION_STATUS.pending;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard style={{ marginBottom: 10, padding: 14 }}>
        <View style={styles.staffRow}>
          {/* Avatar */}
          {staff?.avatar_url ? (
            <Image
              source={{ uri: staff.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarInitials}>
              <Text style={styles.avatarInitialsText}>
                {getInitials(staff?.display_name)}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.staffName} numberOfLines={1}>
              {staff?.display_name ?? 'Staff inconnu'}
            </Text>
            <View style={styles.staffMeta}>
              {mission.date_start && (
                <Text style={styles.staffDate} numberOfLines={1}>
                  {formatDate(mission.date_start, false)}
                </Text>
              )}
            </View>
          </View>

          {/* Right side */}
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[styles.badge, { backgroundColor: msCfg.bg }]}>
              <Text style={[styles.badgeText, { color: msCfg.color }]}>{msCfg.label}</Text>
            </View>
            {mission.amount_due != null && (
              <Text style={styles.staffAmount}>{formatCurrency(mission.amount_due)}</Text>
            )}
          </View>
        </View>

        {/* Rating dots */}
        {staff?.rating != null && (
          <View style={[styles.ratingRow, { marginTop: 10 }]}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.ratingDot,
                  { backgroundColor: i < Math.round(staff.rating!) ? BLUE : 'rgba(255,255,255,0.15)' },
                ]}
              />
            ))}
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

/* ─── Role row ───────────────────────────────────────────────────────────── */
function RoleRow({ role }: { role: EventRole }) {
  const filled  = role.filled_slots ?? 0;
  const total   = role.slots ?? 0;
  const pct     = total > 0 ? filled / total : 0;

  return (
    <GlassCard style={{ marginBottom: 10, padding: 14 }}>
      <View style={styles.roleHeader}>
        <View style={styles.roleDot} />
        <Text style={styles.roleName} numberOfLines={1}>{role.role ?? '—'}</Text>
        {role.hourly_rate != null && (
          <Text style={styles.roleRate}>{role.hourly_rate} €/h</Text>
        )}
      </View>

      {/* Slot bar */}
      <View style={styles.slotBarBg}>
        <View style={[styles.slotBarFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <Text style={styles.slotLabel}>
        {filled} / {total} {total <= 1 ? 'poste' : 'postes'}
      </Text>
    </GlassCard>
  );
}

/* ─── Équipe Tab ─────────────────────────────────────────────────────────── */
const STAFF_MEMBERS_LIST = [
  { id: 'c49ef2fa-7041-4ef8-988a-a3059f762744', name: 'Oka',  role: 'Barman',  initials: 'O' },
  { id: '6e3961b2-dcb8-4849-ab5f-613c20ab80b2', name: 'Redo', role: 'Serveur', initials: 'R' },
] as const;

type StaffEntry = typeof STAFF_MEMBERS_LIST[number];

function EquipeTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('event_id', eventId);
    if (data) setInvitations(data);
  }, [eventId]);

  useEffect(() => {
    loadInvitations();
    const ch = supabase
      .channel(`inv_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `event_id=eq.${eventId}` }, loadInvitations)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadInvitations]);

  const sendInvitation = async (staffMember: StaffEntry) => {
    setSending(staffMember.id);

    const existing = invitations.find((i) => i.staff_id === staffMember.id);
    if (existing) {
      await supabase
        .from('invitations')
        .update({ status: 'pending', sent_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      const { data: inv } = await supabase
        .from('invitations')
        .insert({
          event_id:     eventId,
          staff_id:     staffMember.id,
          organizer_id: '4c9525d8-04a6-41fb-beaa-9e9448134819',
          status:       'pending',
          message:      `Vous êtes invité(e) à l'événement "${eventTitle}". Merci de confirmer votre disponibilité.`,
        })
        .select()
        .single();

      if (inv) {
        await supabase.from('in_app_notifications').insert({
          staff_id:  staffMember.id,
          event_id:  eventId,
          type:      'invitation',
          title:     `Invitation — ${eventTitle}`,
          body:      `Arik vous invite à rejoindre l'événement "${eventTitle}". Confirmez votre présence.`,
          data:      { event_id: eventId, invitation_id: inv.id },
        });
      }
    }

    await loadInvitations();
    setSending(null);
  };

  const getInvStatus = (staffId: string) =>
    invitations.find((i) => i.staff_id === staffId)?.status ?? null;

  const statusConfig = {
    pending:   { label: 'En attente', color: 'rgba(255,255,255,0.65)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.20)' },
    accepted:  { label: 'Acceptée',   color: GREEN,                    bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)' },
    declined:  { label: 'Refusée',    color: RED,                      bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)' },
    cancelled: { label: 'Annulée',    color: 'rgba(255,255,255,0.40)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 16 }}>
        INVITATIONS À L'ÉVÉNEMENT
      </Text>

      {STAFF_MEMBERS_LIST.map((s) => {
        const invStatus = getInvStatus(s.id);
        const cfg = invStatus ? statusConfig[invStatus as keyof typeof statusConfig] : null;
        const isSending = sending === s.id;

        return (
          <BlurView key={s.id} intensity={18} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', padding: 16 }}>
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {/* Avatar */}
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                  <Text style={{ color: WHITE, fontSize: 18, fontWeight: '900' }}>{s.initials}</Text>
                </View>
                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: WHITE, fontSize: 16, fontWeight: '800' }}>{s.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 12 }}>{s.role}</Text>
                </View>
                {/* Status badge */}
                {cfg && (
                  <View style={{ backgroundColor: cfg.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: cfg.border }}>
                    <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
                  </View>
                )}
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => sendInvitation(s)}
                  disabled={isSending || invStatus === 'accepted'}
                  style={{
                    flex: 1, paddingVertical: 11, borderRadius: 13,
                    backgroundColor: invStatus === 'accepted' ? 'rgba(16,185,129,0.15)' : WHITE,
                    alignItems: 'center', opacity: (isSending || invStatus === 'accepted') ? 0.6 : 1,
                  }}
                >
                  {isSending
                    ? <ActivityIndicator size="small" color="#020818" />
                    : (
                      <Text style={{ color: invStatus === 'accepted' ? GREEN : '#020818', fontSize: 13, fontWeight: '800' }}>
                        {invStatus === 'accepted' ? 'Acceptée' : invStatus === 'pending' ? 'Renvoyer' : 'Inviter'}
                      </Text>
                    )
                  }
                </TouchableOpacity>

                {/* WhatsApp shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    const msg = encodeURIComponent(`Bonjour ${s.name} ! Arik vous invite à l'événement "${eventTitle}". Merci de confirmer.`);
                    Linking.openURL(`whatsapp://send?phone=33666167788&text=${msg}`)
                      .catch(() => Linking.openURL(`https://wa.me/33666167788?text=${msg}`));
                  }}
                  style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={WHITE} />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        );
      })}
    </View>
  );
}

/* ─── Missions Tab ───────────────────────────────────────────────────────── */
const ROLES_LIST = ['Barman', 'Serveur', 'Bar Manager', 'DJ', 'Sécurité', 'Hôte/Hôtesse'] as const;

function MissionsTab({ eventId, eventTitle }: { eventId: string; eventTitle: string; eventDate: string }) {
  const [missions, setMissions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    staff_id:        '',
    role:            '',
    scheduled_start: '',
    scheduled_end:   '',
    hourly_rate:     '15',
    notes:           '',
  });
  const [saving, setSaving] = useState(false);

  const loadMissions = useCallback(async () => {
    const { data } = await supabase
      .from('missions')
      .select('*, staff:staff_id(display_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (data) setMissions(data);
  }, [eventId]);

  useEffect(() => {
    loadMissions();
    const ch = supabase
      .channel(`missions_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions', filter: `event_id=eq.${eventId}` }, loadMissions)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadMissions]);

  const createMission = async () => {
    if (!form.staff_id || !form.role) return;
    setSaving(true);

    const { data: mission } = await supabase
      .from('missions')
      .insert({
        staff_id:        form.staff_id,
        event_id:        eventId,
        mission_status:  'assigned',
        role:            form.role,
        scheduled_start: form.scheduled_start || null,
        scheduled_end:   form.scheduled_end   || null,
        hourly_rate:     parseFloat(form.hourly_rate) || 15,
        notes:           form.notes || null,
      })
      .select()
      .single();

    if (mission) {
      await supabase.from('in_app_notifications').insert({
        staff_id:   form.staff_id,
        event_id:   eventId,
        mission_id: mission.id,
        type:       'mission_assigned',
        title:      `Nouvelle mission — ${eventTitle}`,
        body:       `Vous avez été assigné(e) au poste de ${form.role} pour cet événement.`,
        data:       { mission_id: mission.id, event_id: eventId },
      });
    }

    setForm({ staff_id: '', role: '', scheduled_start: '', scheduled_end: '', hourly_rate: '15', notes: '' });
    setShowForm(false);
    setSaving(false);
    loadMissions();
  };

  const missionStatusConfig = {
    assigned:    { label: 'Assignée',  color: 'rgba(255,255,255,0.65)', bg: 'rgba(255,255,255,0.08)' },
    confirmed:   { label: 'Confirmée', color: GREEN,                    bg: 'rgba(16,185,129,0.12)' },
    in_progress: { label: 'En cours',  color: WHITE,                    bg: 'rgba(255,255,255,0.12)' },
    completed:   { label: 'Terminée',  color: GREEN,                    bg: 'rgba(16,185,129,0.10)' },
    cancelled:   { label: 'Annulée',   color: RED,                      bg: 'rgba(239,68,68,0.10)' },
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Header + Add button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>
          MISSIONS ({missions.length})
        </Text>
        <TouchableOpacity
          onPress={() => setShowForm((f) => !f)}
          style={{ backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center' }}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={16} color="#020818" />
          <Text style={{ color: '#020818', fontSize: 12, fontWeight: '800' }}>{showForm ? 'Annuler' : 'Créer'}</Text>
        </TouchableOpacity>
      </View>

      {/* Create mission form */}
      {showForm && (
        <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', padding: 18 }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            />

            <Text style={{ color: WHITE, fontSize: 15, fontWeight: '800', marginBottom: 16 }}>Nouvelle Mission</Text>

            {/* Staff selector */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>STAFF</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {STAFF_MEMBERS_LIST.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setForm((f) => ({ ...f, staff_id: s.id, role: f.role || s.role }))}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
                    backgroundColor: form.staff_id === s.id ? WHITE : 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: form.staff_id === s.id ? WHITE : 'rgba(255,255,255,0.15)',
                  }}
                >
                  <Text style={{ color: form.staff_id === s.id ? '#020818' : WHITE, fontSize: 14, fontWeight: '800' }}>{s.name}</Text>
                  <Text style={{ color: form.staff_id === s.id ? '#020818' : 'rgba(255,255,255,0.50)', fontSize: 11, marginTop: 2 }}>{s.role}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Role selector */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>POSTE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {ROLES_LIST.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: form.role === r ? WHITE : 'rgba(255,255,255,0.08)',
                      borderWidth: 1, borderColor: form.role === r ? WHITE : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <Text style={{ color: form.role === r ? '#020818' : WHITE, fontSize: 12, fontWeight: '700' }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Time inputs */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>HORAIRES</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginBottom: 4 }}>Début</Text>
                <TextInput
                  value={form.scheduled_start}
                  onChangeText={(v) => setForm((f) => ({ ...f, scheduled_start: v }))}
                  placeholder="16:00"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, color: WHITE, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginBottom: 4 }}>Fin</Text>
                <TextInput
                  value={form.scheduled_end}
                  onChangeText={(v) => setForm((f) => ({ ...f, scheduled_end: v }))}
                  placeholder="02:00"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, color: WHITE, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginBottom: 4 }}>Taux (€/h)</Text>
                <TextInput
                  value={form.hourly_rate}
                  onChangeText={(v) => setForm((f) => ({ ...f, hourly_rate: v }))}
                  keyboardType="decimal-pad"
                  placeholder="15"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, color: WHITE, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
                />
              </View>
            </View>

            {/* Notes */}
            <TextInput
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              placeholder="Notes optionnelles..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              numberOfLines={2}
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, color: WHITE, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 16, minHeight: 60, textAlignVertical: 'top' }}
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={createMission}
              disabled={!form.staff_id || !form.role || saving}
              style={{ backgroundColor: WHITE, borderRadius: 14, padding: 15, alignItems: 'center', opacity: (!form.staff_id || !form.role || saving) ? 0.5 : 1 }}
            >
              {saving
                ? <ActivityIndicator size="small" color="#020818" />
                : <Text style={{ color: '#020818', fontSize: 15, fontWeight: '900' }}>Créer la Mission</Text>
              }
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Missions list */}
      {missions.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Ionicons name="briefcase-outline" size={44} color="rgba(255,255,255,0.20)" />
          <Text style={{ color: WHITE, fontSize: 15, fontWeight: '700' }}>Aucune mission</Text>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, textAlign: 'center' }}>
            Créez des missions pour assigner Oka et Redo à cet événement.
          </Text>
        </View>
      ) : missions.map((m) => {
        const cfg = missionStatusConfig[m.mission_status as keyof typeof missionStatusConfig] ?? missionStatusConfig.assigned;
        const staffName: string = m.staff?.display_name ?? 'Staff';
        return (
          <BlurView key={m.id} intensity={14} tint="systemUltraThinMaterialDark" style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 10 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Text style={{ color: WHITE, fontSize: 15, fontWeight: '900' }}>{staffName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: WHITE, fontSize: 15, fontWeight: '800' }}>{staffName}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{m.role} · {m.hourly_rate}€/h</Text>
                </View>
                <View style={{ backgroundColor: cfg.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
                </View>
              </View>
              {(m.scheduled_start || m.scheduled_end) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.40)" />
                  <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 12 }}>
                    {m.scheduled_start || '—'} → {m.scheduled_end || '—'}
                  </Text>
                </View>
              )}
            </View>
          </BlurView>
        );
      })}
    </View>
  );
}

/* ─── Détails Tab ────────────────────────────────────────────────────────── */
function DetailsTab({
  event,
  missions,
  roles,
  router,
}: {
  event: EventRow;
  missions: Mission[];
  roles: EventRole[];
  router: ReturnType<typeof useRouter>;
}) {
  const hasMap = !!(event.latitude && event.longitude && Platform.OS !== 'web');

  return (
    <>
      {/* ──────────────────────── 3. INFO CARDS ──────────────────────────── */}
      <View style={styles.section}>

        {/* Row: Dates + Budget */}
        <View style={styles.twoColRow}>

          {/* Card: Dates */}
          <GlassCard style={[styles.halfCard, { padding: 16 }]}>
            <View style={styles.cardIconRow}>
              <Ionicons name="calendar-outline" size={16} color={BLUE} />
              <Text style={styles.cardLabel}>Dates</Text>
            </View>
            <Text style={styles.cardValueLg}>
              {formatDate(event.date_start, false)}
            </Text>
            {event.date_end && (
              <View style={styles.dateEndRow}>
                <Ionicons name="arrow-forward-outline" size={12} color={MUTED} />
                <Text style={styles.cardValueSm}>
                  {formatDate(event.date_end, false)}
                </Text>
              </View>
            )}
            {event.date_start && (
              <Text style={styles.cardTimeSm}>
                {new Date(event.date_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </GlassCard>

          {/* Card: Budget */}
          <GlassCard style={[styles.halfCard, { padding: 16 }]}>
            <View style={styles.cardIconRow}>
              <Ionicons name="cash-outline" size={16} color={BLUE} />
              <Text style={styles.cardLabel}>Budget</Text>
            </View>
            <Text style={styles.budgetValue}>{formatCurrency(event.budget)}</Text>
            <Text style={styles.budgetSub}>budget total</Text>

            {/* Quick mission payment summary */}
            {missions.length > 0 && (() => {
              const totalDue  = missions.reduce((a, m) => a + (m.amount_due  ?? 0), 0);
              const totalPaid = missions.reduce((a, m) => a + (m.amount_paid ?? 0), 0);
              return (
                <View style={{ marginTop: 10, gap: 4 }}>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Missions</Text>
                    <Text style={styles.payValue}>{formatCurrency(totalDue)}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Payé</Text>
                    <Text style={[styles.payValue, { color: BLUE }]}>{formatCurrency(totalPaid)}</Text>
                  </View>
                </View>
              );
            })()}
          </GlassCard>
        </View>

        {/* Card: Localisation (full width) */}
        <GlassCard style={{ padding: 16, marginTop: 14 }}>
          <View style={styles.cardIconRow}>
            <Ionicons name="location-outline" size={16} color={BLUE} />
            <Text style={styles.cardLabel}>Localisation</Text>
          </View>
          <Text style={styles.locationText} numberOfLines={2}>
            {event.location ?? 'Lieu non renseigné'}
          </Text>

          {/* Mini map */}
          {hasMap && (
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude: event.latitude!,
                longitude: event.longitude!,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              customMapStyle={mapStyle}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              userInterfaceStyle="dark"
            >
              <Marker
                coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}
                pinColor={BLUE}
              />
            </MapView>
          )}
        </GlassCard>

        {/* Card: Description (if any) */}
        {event.description ? (
          <GlassCard style={{ padding: 16, marginTop: 14 }}>
            <View style={styles.cardIconRow}>
              <Ionicons name="document-text-outline" size={16} color={BLUE} />
              <Text style={styles.cardLabel}>Description</Text>
            </View>
            <ExpandableText text={event.description} />
          </GlassCard>
        ) : null}
      </View>

      {/* ──────────────────────── 4. STAFF / MISSIONS ────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color={WHITE} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Équipe</Text>
          {missions.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{missions.length}</Text>
            </View>
          )}
        </View>

        {missions.length === 0 ? (
          <GlassCard style={{ padding: 24, alignItems: 'center', gap: 10 }}>
            <Ionicons name="person-add-outline" size={32} color="rgba(255,255,255,0.20)" />
            <Text style={styles.emptyText}>Aucun staff assigné</Text>
          </GlassCard>
        ) : (
          missions.map((m) => (
            <StaffCard
              key={m.id}
              mission={m}
              onPress={() => router.push('/(organizer)/missions')}
            />
          ))
        )}
      </View>

      {/* ──────────────────────── 5. ROLES SECTION ───────────────────────── */}
      {roles.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase-outline" size={18} color={WHITE} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Postes</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{roles.length}</Text>
            </View>
          </View>

          {roles.map((r) => (
            <RoleRow key={r.id} role={r} />
          ))}
        </View>
      )}
    </>
  );
}

/* ─── Main screen ─────────────────────────────────────────────────────────── */
export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();

  const [event,      setEvent]      = useState<EventRow | null>(null);
  const [missions,   setMissions]   = useState<Mission[]>([]);
  const [roles,      setRoles]      = useState<EventRole[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>('Détails');

  /* ─── Fetch ─────────────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!id) { setError('Identifiant manquant'); setLoading(false); return; }

    const [evRes, msRes, roRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, type, date_start, date_end, location, budget, description, status, cover_url, latitude, longitude')
        .eq('id', id)
        .single(),
      supabase
        .from('missions')
        .select('id, status, amount_due, amount_paid, date_start, date_end, staff:staff_id(id, display_name, avatar_url, rating)')
        .eq('event_id', id),
      supabase
        .from('event_roles')
        .select('id, role, slots, hourly_rate, filled_slots')
        .eq('event_id', id),
    ]);

    if (evRes.error) { setError(evRes.error.message); }
    else             { setEvent(evRes.data as EventRow); }

    setMissions((msRes.data ?? []) as unknown as Mission[]);
    setRoles((roRes.data ?? []) as EventRole[]);

    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  /* ─── Scroll-driven hero fade ────────────────────────────────────────────── */
  const scrollY       = useRef(new Animated.Value(0)).current;
  const heroOpacity   = scrollY.interpolate({ inputRange: [0, 140], outputRange: [1, 0], extrapolate: 'clamp' });
  const headerOpacity = scrollY.interpolate({ inputRange: [80, 160], outputRange: [0, 1], extrapolate: 'clamp' });

  /* ─── Loading ─────────────────────────────────────────────────────────────── */
  if (loading) return <LoadingSkeleton insets={insets} />;

  /* ─── Error ───────────────────────────────────────────────────────────────── */
  if (error || !event) {
    return (
      <View style={[styles.center, { backgroundColor: BG, paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.errorTitle}>Événement introuvable</Text>
        <Text style={styles.errorSub}>{error ?? "Cet événement n'existe pas."}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status  = event.status ?? 'draft';
  const stCfg   = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const typeIcon: React.ComponentProps<typeof Ionicons>['name'] =
    TYPE_ICONS[event.type ?? ''] ?? 'calendar-outline';

  /* ─── Tab pills ──────────────────────────────────────────────────────────── */
  const tabPills = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ paddingHorizontal: 20, marginBottom: 16 }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingHorizontal: 20, paddingVertical: 9, borderRadius: 22,
              backgroundColor: activeTab === tab ? WHITE : 'rgba(255,255,255,0.08)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: activeTab === tab ? WHITE : 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: activeTab === tab ? '#020818' : WHITE, fontSize: 13, fontWeight: '700' }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  /* ─── Render ──────────────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />

      {/* ── Floating condensed header (appears on scroll) ── */}
      <Animated.View
        style={[styles.floatingHeader, { paddingTop: insets.top, opacity: headerOpacity }]}
        pointerEvents="none"
      >
        <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.00)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.floatingHeaderTitle} numberOfLines={1}>
          {event.title}
        </Text>
      </Animated.View>

      {/* ── Main scroll ── */}
      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: BG, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        {/* ──────────────────────── 1. COVER HERO ──────────────────────────── */}
        <Animated.View style={{ height: 200, opacity: heroOpacity }}>
          {event.cover_url ? (
            <>
              <Image
                source={{ uri: event.cover_url }}
                style={{ width: '100%', height: 200 }}
                contentFit="cover"
              />
              {/* Bottom fade overlay */}
              <LinearGradient
                colors={['transparent', BG]}
                style={styles.heroBotFade}
              />
              {/* BlurView overlay strip */}
              <BlurView intensity={55} tint="dark" style={styles.heroBlurStrip} />
            </>
          ) : (
            <LinearGradient colors={['#0A1628', BG]} style={styles.heroGradientFallback}>
              <View style={styles.heroIconWrapper}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.00)']}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name={typeIcon} size={52} color={BLUE} />
              </View>
            </LinearGradient>
          )}

          {/* Back button — always on top */}
          <View
            style={[styles.backBtn, { top: insets.top + 12 }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtnInner}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.00)']}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="chevron-back" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ──────────────────────── 2. TITLE SECTION ───────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          <View style={styles.badgeRow}>
            {/* Type badge */}
            {event.type && (
              <View style={styles.typeChip}>
                <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.00)']}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name={typeIcon} size={12} color={BLUE} style={{ marginRight: 5 }} />
                <Text style={styles.typeChipText}>{event.type}</Text>
              </View>
            )}

            {/* Status badge */}
            <View style={[styles.statusChip, { backgroundColor: stCfg.bg }]}>
              <Text style={[styles.statusChipText, { color: stCfg.color }]}>{stCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* ──────────────────────── 3. TAB PILLS ───────────────────────────── */}
        {tabPills}

        {/* ──────────────────────── 4. TAB CONTENT ─────────────────────────── */}
        {activeTab === 'Détails' && (
          <DetailsTab
            event={event}
            missions={missions}
            roles={roles}
            router={router}
          />
        )}
        {activeTab === 'Équipe' && (
          <EquipeTab eventId={event.id} eventTitle={event.title} />
        )}
        {activeTab === 'Missions' && (
          <MissionsTab
            eventId={event.id}
            eventTitle={event.title}
            eventDate={event.date_start ?? ''}
          />
        )}
      </Animated.ScrollView>

      {/* ──────────────────────── 5. FIXED ACTION BUTTON ─────────────────── */}
      <View style={[styles.actionBarWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`${BG}00`, BG]}
          style={styles.actionBarGradient}
          pointerEvents="none"
        />
        <TouchableOpacity
          onPress={() => router.push('/(organizer)/create-event')}
          style={styles.actionBtn}
          activeOpacity={0.80}
        >
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="create-outline" size={20} color={WHITE} style={{ marginRight: 10 }} />
          <Text style={styles.actionBtnText}>Modifier l'événement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* ── floating header ── */
  floatingHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 12,
    paddingHorizontal: EDGE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 60,
  },
  floatingHeaderTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* ── hero ── */
  heroBotFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 90,
    zIndex: 1,
  },
  heroBlurStrip: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 80,
    zIndex: 2,
    overflow: 'hidden',
  },
  heroGradientFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  /* ── title section ── */
  titleSection: {
    paddingHorizontal: EDGE,
    paddingTop: 22,
    paddingBottom: 12,
    gap: 12,
  },
  eventTitle: {
    color: WHITE,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  typeChipText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* ── sections ── */
  section: {
    paddingHorizontal: EDGE,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '700',
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  countBadgeText: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── glass card ── */
  glassCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: FAINT,
  },
  cardSheen: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 48,
    zIndex: 0,
  },

  /* ── info cards ── */
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  cardLabel: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardValueLg: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardValueSm: {
    color: WHITE,
    fontSize: 12,
    marginLeft: 4,
  },
  cardTimeSm: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  dateEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  /* ── budget card ── */
  budgetValue: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  budgetSub: {
    color: WHITE,
    fontSize: 11,
    marginTop: 2,
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payLabel: {
    color: WHITE,
    fontSize: 11,
  },
  payValue: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── location card ── */
  locationText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  miniMap: {
    height: 140,
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
  },

  /* ── description ── */
  descriptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
  showMoreText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── staff card ── */
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  staffName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  staffMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  staffDate: {
    color: WHITE,
    fontSize: 11,
  },
  staffAmount: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  /* ── roles ── */
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE,
  },
  roleName: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  roleRate: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  slotBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  slotBarFill: {
    height: 4,
    backgroundColor: BLUE,
    borderRadius: 2,
  },
  slotLabel: {
    color: WHITE,
    fontSize: 11,
    marginTop: 6,
  },

  /* ── action bar ── */
  actionBarWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    overflow: 'hidden',
    paddingHorizontal: EDGE,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  actionBarGradient: {
    position: 'absolute',
    top: -40, left: 0, right: 0,
    height: 40,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionBtnText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* ── states ── */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: EDGE,
  },
  errorTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  errorSub: {
    color: WHITE,
    fontSize: 13,
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorBtnText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: WHITE,
    fontSize: 13,
  },
});
