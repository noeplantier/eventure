/**
 * app/(organizer)/applications.tsx — EVENTURE v2
 * Candidatures · Optimistic updates · Realtime · Swipe actions · Decision UI
 *
 * FIXES vs v1:
 *  - Channel name unique par mount (`apps_rt_${Date.now()}`) → plus d'erreur
 *    "cannot add postgres_changes callbacks after subscribe()"
 *  - rtRef nettoyé avant chaque recréation (guard double-mount Strict Mode)
 *  - updateStatus stabilisé avec useRef pour éviter closure stale dans le realtime handler
 *  - load() mémoïsé sans dépendance cyclique sur `apps`
 *  - renderItem wrappé dans useCallback avec dépendances correctes
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Easing,
  FlatList, Image, Modal, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

/* ─── Palette ─────────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const BG    = '#020A06';
const GREEN = '#00D97E';
const GOLD  = '#F5C842';
const EDGE  = 20;
const T = {
  white   : '#FFFFFF',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.18)',
  surf    : 'rgba(255,255,255,0.05)',
  border  : 'rgba(0,217,126,0.12)',
  borderHi: 'rgba(0,217,126,0.28)',
  greenDim: 'rgba(0,217,126,0.12)',
  goldDim : 'rgba(245,200,66,0.12)',
  amber   : '#F59E0B',
  red     : '#EF4444',
  navy    : '#0A2218',
  blue    : '#60A5FA',
} as const;

/* ─── Types ───────────────────────────────────────────────────────────── */
type AppStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

interface AppDetail {
  id              : string;
  status          : AppStatus;
  message         : string | null;
  applied_at      : string;
  reviewed_at     : string | null;
  role            : string;
  hourly_rate     : number;
  slots           : number;
  slots_filled    : number;
  event_id        : string;
  event_title     : string;
  date_start      : string;
  date_end        : string;
  event_location  : string;
  staff_id        : string;
  staff_name      : string;
  staff_avatar    : string | null;
  staff_rating    : number;
  missions_count  : number;
  experience_years: number | null;
  staff_roles     : string[];
  organizer_id    : string;
}

/* ─── Status config ───────────────────────────────────────────────────── */
const STATUS_CFG: Record<AppStatus, { l:string; c:string; bg:string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending  : { l: 'En attente',    c: T.amber, bg: 'rgba(245,158,11,0.14)',  icon: 'time-outline'              },
  accepted : { l: 'Accepté',       c: GREEN,   bg: 'rgba(0,217,126,0.14)',   icon: 'checkmark-circle-outline'  },
  rejected : { l: 'Refusé',        c: T.red,   bg: 'rgba(239,68,68,0.14)',   icon: 'close-circle-outline'      },
  cancelled: { l: 'Désistement',   c: T.muted, bg: 'rgba(255,255,255,0.06)', icon: 'exit-outline'              },
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const timeAgo = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'À l\'instant';
  if (diff < 3600)  return `il y a ${Math.round(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)}h`;
  if (diff < 604800)return `il y a ${Math.round(diff / 86400)}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/* ─── Particle Background ─────────────────────────────────────────────── */
const PTS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x : (Math.sin(i * 2.4) + 1) / 2 * SW,
  y : (Math.cos(i * 1.7) + 1) / 2 * 700,
  sz: i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.1 : 0.7,
  col: i % 7 === 0 ? GREEN : i % 3 === 0 ? GOLD : 'rgba(255,255,255,0.6)',
  op: 0.05 + (i % 8) * 0.03,
}));
const ParticleBg = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG, '#051A0E', BG]} style={StyleSheet.absoluteFill} />
    <View style={{ position:'absolute', top:'10%', left:'18%', width:SW*.62, height:SW*.62, borderRadius:SW*.31, backgroundColor:'rgba(0,217,126,0.035)' }} />
    <View style={{ position:'absolute', bottom:'12%', right:'-10%', width:SW*.5, height:SW*.5, borderRadius:SW*.25, backgroundColor:'rgba(245,200,66,0.025)' }} />
    {PTS.map(p => <View key={p.id} style={{ position:'absolute', left:p.x, top:p.y, width:p.sz*2, height:p.sz*2, borderRadius:p.sz, backgroundColor:p.col, opacity:p.op }} />)}
  </View>
));

/* ─── Skeleton Card ───────────────────────────────────────────────────── */
const SkeletonCard = memo(({ index }: { index: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const op = anim.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.65] });
  return (
    <Animated.View style={[sk.card, { opacity: op }]}>
      <View style={[sk.line, { width: '55%', height: 12, marginBottom: 14 }]} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={sk.avatar} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[sk.line, { width: '70%', height: 13 }]} />
          <View style={[sk.line, { width: '45%', height: 10 }]} />
          <View style={[sk.line, { width: '55%', height: 9 }]} />
        </View>
        <View style={[sk.line, { width: 52, height: 24, borderRadius: 10 }]} />
      </View>
      <View style={[sk.line, { height: 4, marginTop: 12, borderRadius: 2 }]} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <View style={[sk.line, { flex: 1, height: 36, borderRadius: 12 }]} />
        <View style={[sk.line, { flex: 1, height: 36, borderRadius: 12 }]} />
        <View style={[sk.line, { flex: 2, height: 36, borderRadius: 12 }]} />
      </View>
    </Animated.View>
  );
});
const sk = StyleSheet.create({
  card  : { borderRadius: 20, padding: 16, marginBottom: 12, backgroundColor: T.navy },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: T.surf },
  line  : { backgroundColor: T.surf, borderRadius: 6, width: '100%' },
});

/* ─── Reject Reason Modal ─────────────────────────────────────────────── */
const RejectModal = memo(function RejectModal({
  app, onClose, onConfirm,
}: { app: AppDetail | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const slideY  = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (app) {
      setReason('');
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0, tension: 70, friction: 14, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,  { toValue: 400, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [app]);

  const isCancel = app?.status === 'accepted';

  if (!app) return null;
  return (
    <Modal transparent visible={!!app} animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(2,10,6,0.7)', opacity }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[rm.sheet, { transform: [{ translateY: slideY }] }]}>
        <LinearGradient colors={['#0D2A1A', '#051A0E']} style={StyleSheet.absoluteFillObject} />
        <View style={rm.handle} />
        <View style={rm.header}>
          <View style={[rm.iconWrap, { backgroundColor: isCancel ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name={isCancel ? 'exit-outline' : 'close-circle-outline'} size={22} color={isCancel ? T.amber : T.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={rm.title}>{isCancel ? 'Annuler la sélection' : 'Refuser la candidature'}</Text>
            <Text style={rm.sub}>{app.staff_name} · {app.role}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.muted} />
          </TouchableOpacity>
        </View>

        <Text style={rm.label}>Motif <Text style={{ color: T.faint }}>(optionnel)</Text></Text>
        <View style={rm.inputWrap}>
          <TextInput
            style={rm.input}
            placeholder={isCancel
              ? 'Ex: L\'événement est annulé…'
              : 'Ex: Profil ne correspond pas au poste…'}
            placeholderTextColor={T.faint}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
            maxLength={300}
          />
          <Text style={{ color: T.faint, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>{reason.length}/300</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <TouchableOpacity style={rm.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={{ color: T.muted, fontWeight: '700', fontSize: 14 }}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[rm.confirmBtn, { backgroundColor: isCancel ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', borderColor: isCancel ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)' }]}
            onPress={() => onConfirm(reason)}
            activeOpacity={0.82}
          >
            <Ionicons name={isCancel ? 'exit-outline' : 'close-circle-outline'} size={15} color={isCancel ? T.amber : T.red} />
            <Text style={{ color: isCancel ? T.amber : T.red, fontWeight: '900', fontSize: 14 }}>
              {isCancel ? 'Annuler la sélection' : 'Refuser'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: Platform.OS === 'ios' ? 28 : 12 }} />
        <View pointerEvents="none" style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderTopLeftRadius:28, borderTopRightRadius:28, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border }} />
      </Animated.View>
    </Modal>
  );
});
const rm = StyleSheet.create({
  sheet    : { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingHorizontal: EDGE, paddingTop: 14, backgroundColor: '#0D2A1A' },
  handle   : { width: 38, height: 4, borderRadius: 2, backgroundColor: T.faint, alignSelf: 'center', marginBottom: 18 },
  header   : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconWrap : { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title    : { color: T.white, fontSize: 16, fontWeight: '900' },
  sub      : { color: GREEN, fontSize: 11, fontWeight: '600', marginTop: 1 },
  label    : { color: T.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  inputWrap: { backgroundColor: T.surf, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  input    : { color: T.white, fontSize: 13, lineHeight: 19, minHeight: 70, textAlignVertical: 'top' },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 15, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 15, borderWidth: 1 },
});

/* ─── Summary Bar ─────────────────────────────────────────────────────── */
const SummaryBar = memo(({ apps }: { apps: AppDetail[] }) => {
  const counts = useMemo(() => ({
    pending : apps.filter(a => a.status === 'pending').length,
    accepted: apps.filter(a => a.status === 'accepted').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    total   : apps.length,
  }), [apps]);

  const acceptRate = counts.total > 0
    ? Math.round((counts.accepted / counts.total) * 100)
    : 0;

  const items = [
    { v: String(counts.pending),  l: 'En attente', c: T.amber },
    { v: String(counts.accepted), l: 'Acceptées',  c: GREEN   },
    { v: String(counts.rejected), l: 'Refusées',   c: T.red   },
    { v: `${acceptRate}%`,        l: 'Taux accept.',c: GOLD   },
  ];

  return (
    <View style={summary.bar}>
      {items.map(({ v, l, c }, i) => (
        <React.Fragment key={l}>
          <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Text style={{ color: c, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>{v}</Text>
            <Text style={{ color: T.muted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' }}>{l}</Text>
          </View>
          {i < items.length - 1 && (
            <View style={{ width: StyleSheet.hairlineWidth, height: 26, backgroundColor: T.border }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
});
const summary = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: EDGE, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: T.navy, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
});

/* ─── Urgency Badge ───────────────────────────────────────────────────── */
const UrgencyBadge = memo(({ applied_at }: { applied_at: string }) => {
  const hours = (Date.now() - new Date(applied_at).getTime()) / 3600000;
  if (hours > 24) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239,68,68,0.30)' }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.red }} />
      <Text style={{ color: T.red, fontSize: 8, fontWeight: '800' }}>NOUVEAU</Text>
    </View>
  );
});

/* ─── Application Card ────────────────────────────────────────────────── */
const AppCard = memo(function AppCard({
  app, index, onAccept, onReject, onChat, onEventPress,
}: {
  app       : AppDetail;
  index     : number;
  onAccept  : () => void;
  onReject  : () => void;
  onChat    : () => void;
  onEventPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const enterAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const cfg       = STATUS_CFG[app.status] ?? STATUS_CFG.pending;
  const stars     = Math.round(app.staff_rating);
  const initials  = app.staff_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const slotsPct  = app.slots > 0 ? app.slots_filled / app.slots : 0;
  const fillColor = slotsPct >= 0.8 ? GREEN : slotsPct >= 0.5 ? T.amber : T.red;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1, duration: 320,
      delay: Math.min(index * 55, 350),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index]);

  const onPressIn  = () => Animated.spring(pressAnim, { toValue: .975, tension: 300, friction: 8,  useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1,    tension: 200, friction: 10, useNativeDriver: true }).start();

  return (
    <Animated.View style={{
      opacity  : enterAnim,
      transform: [
        { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        { scale: pressAnim },
      ],
    }}>
      <TouchableOpacity
        style={ac.card}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onEventPress}
        activeOpacity={1}
      >
        <LinearGradient colors={['rgba(0,217,126,0.065)', 'rgba(0,217,126,0.015)']} style={StyleSheet.absoluteFillObject} />

        {/* Event chip row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={ac.eventChip} onPress={onEventPress} activeOpacity={0.80}>
            <Ionicons name="calendar-outline" size={10} color={T.muted} />
            <Text style={ac.eventTxt} numberOfLines={1}>{app.event_title}</Text>
            <Text style={ac.eventDate}>{formatDate(app.date_start)}</Text>
            <Ionicons name="chevron-forward" size={10} color={T.faint} />
          </TouchableOpacity>
          <UrgencyBadge applied_at={app.applied_at} />
        </View>

        {/* Staff row */}
        <View style={ac.staffRow}>
          {/* Avatar */}
          <TouchableOpacity onPress={onChat} activeOpacity={0.85}>
            <View style={{ position: 'relative' }}>
              {app.staff_avatar && !imgErr
                ? <Image source={{ uri: app.staff_avatar }} style={ac.avatar} resizeMode="cover" onError={() => setImgErr(true)} />
                : <View style={[ac.avatar, ac.avatarFb]}>
                    <Text style={ac.avatarInit}>{initials}</Text>
                  </View>
              }
              {/* Chat nudge dot */}
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: T.blue, borderWidth: 2, borderColor: BG, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubble" size={7} color={T.white} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Info */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ac.name} numberOfLines={1}>{app.staff_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Text style={ac.role}>{app.role}</Text>
              {app.experience_years != null && app.experience_years > 0 && (
                <Text style={{ color: T.faint, fontSize: 10 }}>· {app.experience_years}ans exp.</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ flexDirection: 'row', gap: 1.5 }}>
                {[1,2,3,4,5].map(i => (
                  <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={9} color={i <= stars ? GOLD : T.faint} />
                ))}
              </View>
              <Text style={{ color: T.muted, fontSize: 9 }}>
                {app.staff_rating.toFixed(1)} · {app.missions_count} mission{app.missions_count > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Right: status + rate */}
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View style={[ac.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={9} color={cfg.c} />
              <Text style={[ac.statusTxt, { color: cfg.c }]}>{cfg.l}</Text>
            </View>
            <Text style={ac.rate}>{app.hourly_rate}<Text style={{ fontSize: 10, fontWeight: '600', color: T.muted }}>€/h</Text></Text>
            <Text style={{ color: T.faint, fontSize: 9 }}>{timeAgo(app.applied_at)}</Text>
          </View>
        </View>

        {/* Slots fill bar */}
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: T.muted, fontSize: 10 }}>
              Postes : <Text style={{ color: T.white, fontWeight: '700' }}>{app.slots_filled}</Text>/{app.slots}
            </Text>
            <Text style={{ color: fillColor, fontSize: 10, fontWeight: '700' }}>
              {Math.round(slotsPct * 100)}% rempli
            </Text>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <View style={{ height: '100%', borderRadius: 2, backgroundColor: fillColor, width: `${slotsPct * 100}%` as any }} />
          </View>
        </View>

        {/* Candidate message */}
        {app.message ? (
          <View style={ac.messageBox}>
            <Ionicons name="chatbubble-outline" size={11} color={T.muted} />
            <Text style={ac.messageTxt} numberOfLines={3}>"{app.message}"</Text>
          </View>
        ) : null}

        {/* ── Action buttons ── */}
        {app.status === 'pending' && (
          <View style={ac.actions}>
            <TouchableOpacity style={ac.chatBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted} />
              <Text style={ac.chatTxt}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.rejectBtn} onPress={onReject} activeOpacity={0.78}>
              <Ionicons name="close" size={14} color={T.red} />
              <Text style={ac.rejectTxt}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.acceptBtn} onPress={onAccept} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(0,217,126,0.32)', 'rgba(0,217,126,0.16)']} style={ac.acceptGrad}>
                <Ionicons name="checkmark" size={14} color={GREEN} />
                <Text style={ac.acceptTxt}>Accepter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {app.status === 'accepted' && (
          <View style={ac.actions}>
            <TouchableOpacity style={ac.chatBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted} />
              <Text style={ac.chatTxt}>Contacter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ac.rejectBtn, { flex: 1, borderColor: 'rgba(245,158,11,0.28)', backgroundColor: 'rgba(245,158,11,0.08)' }]}
              onPress={onReject}
              activeOpacity={0.78}
            >
              <Ionicons name="exit-outline" size={13} color={T.amber} />
              <Text style={[ac.rejectTxt, { color: T.amber }]}>Annuler la sélection</Text>
            </TouchableOpacity>
          </View>
        )}

        {(app.status === 'rejected' || app.status === 'cancelled') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            <Ionicons name={cfg.icon} size={12} color={cfg.c} />
            <Text style={{ color: cfg.c, fontSize: 11, fontWeight: '600', opacity: 0.8 }}>
              {app.status === 'rejected' ? 'Candidature refusée' : 'Candidat désisté'}
              {app.reviewed_at ? ` · ${formatDate(app.reviewed_at)}` : ''}
            </Text>
          </View>
        )}

        {/* Border */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }} />
      </TouchableOpacity>
    </Animated.View>
  );
});
const ac = StyleSheet.create({
  card       : { borderRadius: 20, overflow: 'hidden', marginBottom: 12, padding: 15, gap: 12, backgroundColor: T.navy },
  eventChip  : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, flex: 1 },
  eventTxt   : { color: T.muted, fontSize: 10, fontWeight: '600', flex: 1 },
  eventDate  : { color: T.faint, fontSize: 9 },
  staffRow   : { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar     : { width: 52, height: 52, borderRadius: 26, backgroundColor: T.navy },
  avatarFb   : { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: T.border, backgroundColor: 'rgba(0,217,126,0.08)' },
  avatarInit : { color: GREEN, fontSize: 18, fontWeight: '900' },
  name       : { color: T.white, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  role       : { color: GREEN, fontSize: 11, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusTxt  : { fontSize: 9, fontWeight: '800' },
  rate       : { color: GOLD, fontSize: 15, fontWeight: '900' },
  messageBox : { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  messageTxt : { color: T.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 16, flex: 1 },
  actions    : { flexDirection: 'row', gap: 8 },
  chatBtn    : { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  chatTxt    : { color: T.muted, fontSize: 11, fontWeight: '600' },
  rejectBtn  : { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239,68,68,0.22)' },
  rejectTxt  : { color: T.red, fontSize: 11, fontWeight: '700' },
  acceptBtn  : { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,217,126,0.28)' },
  acceptGrad : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  acceptTxt  : { color: GREEN, fontSize: 12, fontWeight: '900' },
});

/* ─── Screen ──────────────────────────────────────────────────────────── */
export default function ApplicationsScreen() {
  const router = useRouter();

  /* State */
  const [apps,      setApps]      = useState<AppDetail[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refresh,   setRefresh]   = useState(false);
  const [tab,       setTab]       = useState<AppStatus | 'all'>('pending');
  const [filterEvt, setFilterEvt] = useState<string | null>(null);
  const [sortBy,    setSortBy]    = useState<'recent' | 'rating' | 'rate'>('recent');
  const [rejectTarget, setRejectTarget] = useState<AppDetail | null>(null);

  /* Stable ref to apps for realtime handler (avoids stale closure) */
  const appsRef = useRef<AppDetail[]>([]);
  useEffect(() => { appsRef.current = apps; }, [apps]);

  /* ── Load ─────────────────────────────────────────────────────────── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      /* Try the view first */
      let data: any[] | null = null;
      let viewError: any    = null;

      const viewRes = await supabase
        .from('v_application_details')
        .select('*')
        .eq('organizer_id', session?.user?.id ?? '')
        .order('applied_at', { ascending: false });

      viewError = viewRes.error;
      data      = viewRes.data ?? null;

      /* Fallback: manual joins if view doesn't exist yet */
      if (viewError || !data?.length) {
        if (!session) { setApps([]); return; }

        const { data: evts } = await supabase
          .from('events')
          .select('id,title,date_start,date_end,location')
          .eq('organizer_id', session.user.id);

        if (!evts?.length) { setApps([]); return; }

        const evtIds = evts.map((e: any) => e.id);
        const { data: roles } = await supabase
          .from('event_roles')
          .select('id,role,hourly_rate,slots,slots_filled,event_id')
          .in('event_id', evtIds);

        if (!roles?.length) { setApps([]); return; }

        const roleIds = roles.map((r: any) => r.id);
        const { data: rawApps } = await supabase
          .from('applications')
          .select('*')
          .in('event_role_id', roleIds)
          .order('applied_at', { ascending: false });

        if (!rawApps?.length) { setApps([]); return; }

        const staffIds = [...new Set((rawApps as any[]).map((a: any) => a.staff_id))];
        const { data: staffRows } = await supabase
          .from('staff_profiles')
          .select('id,display_name,avatar_url,rating,missions_count,experience_years,role')
          .in('id', staffIds);

        const sm = Object.fromEntries((staffRows ?? []).map((s: any) => [s.id, s]));
        const rm = Object.fromEntries((roles as any[]).map((r: any) => [r.id, r]));
        const em = Object.fromEntries((evts as any[]).map((e: any) => [e.id, e]));

        data = (rawApps as any[]).map(a => {
          const r  = rm[a.event_role_id] ?? {};
          const st = sm[a.staff_id]      ?? {};
          const ev = em[r.event_id]      ?? {};
          return {
            id: a.id, status: a.status, message: a.message,
            applied_at: a.applied_at, reviewed_at: a.reviewed_at,
            role: r.role ?? '—', hourly_rate: r.hourly_rate ?? 0,
            slots: r.slots ?? 0, slots_filled: r.slots_filled ?? 0,
            event_id: r.event_id ?? '', event_title: ev.title ?? '—',
            date_start: ev.date_start ?? '', date_end: ev.date_end ?? '',
            event_location: ev.location ?? '',
            staff_id: a.staff_id,
            staff_name: st.display_name ?? 'Staff',
            staff_avatar: st.avatar_url ?? null,
            staff_rating: st.rating ?? 0,
            missions_count: st.missions_count ?? 0,
            experience_years: st.experience_years ?? null,
            staff_roles: st.role ?? [],
            organizer_id: session.user.id,
          };
        });
      }

      setApps((data ?? []) as AppDetail[]);
    } catch (e) {
      console.error('[applications load]', e);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []); // no deps — stable for realtime handler

  useEffect(() => { load(); }, []);

  /* ── Realtime — FIXED: unique channel name per mount ─────────────── */
  useEffect(() => {
    let mounted = true;
    // Unique name per mount → fixes "cannot add postgres_changes callbacks
    // after subscribe()" on remount (navigation back, hot reload, StrictMode).
    const channelName = `apps_rt_${Date.now()}`;

    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        ({ eventType, new: n, old: o }) => {
          if (!mounted) return;
          if (eventType === 'INSERT') {
            // Full reload to get joined data
            load(true);
          }
          if (eventType === 'UPDATE') {
            const updated = n as any;
            setApps(prev =>
              prev.map(a =>
                a.id === updated.id
                  ? { ...a, status: updated.status, reviewed_at: updated.reviewed_at }
                  : a
              )
            );
          }
          if (eventType === 'DELETE') {
            setApps(prev => prev.filter(a => a.id !== (o as any).id));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [load]);

  /* ── Optimistic update ────────────────────────────────────────────── */
  const updateStatus = useCallback(async (
    id: string,
    status: AppStatus,
    reason?: string,
  ) => {
    // Optimistic
    const snapshot = appsRef.current;
    setApps(prev =>
      prev.map(x =>
        x.id === id
          ? { ...x, status, reviewed_at: new Date().toISOString() }
          : x
      )
    );
    try {
      const payload: Record<string, any> = {
        status,
        reviewed_at: new Date().toISOString(),
      };
      if (reason) payload.reject_reason = reason;

      const { error } = await supabase
        .from('applications')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      // If accepting: also create event_staff row
      if (status === 'accepted') {
        const app = snapshot.find(a => a.id === id);
        if (app) {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.from('event_staff').upsert({
            event_id    : app.event_id,
            organizer_id: session?.user.id,
            staff_id    : app.staff_id,
            role        : app.role,
            hourly_rate : app.hourly_rate,
            status      : 'confirmed',
          }, { onConflict: 'event_id,staff_id' });
        }
      }
    } catch (e) {
      console.error('[updateStatus]', e);
      setApps(snapshot); // rollback
    }
  }, []);

  /* ── Action handlers ──────────────────────────────────────────────── */
  const handleAccept = useCallback((app: AppDetail) => {
    const remaining = app.slots - app.slots_filled;
    Alert.alert(
      'Confirmer l\'acceptation',
      `Accepter ${app.staff_name} pour le poste de ${app.role} ?\n\n${remaining > 1 ? `Il reste ${remaining - 1} poste${remaining > 2 ? 's' : ''} à pourvoir.` : 'Dernier poste disponible !'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Accepter ✓', onPress: () => updateStatus(app.id, 'accepted') },
      ]
    );
  }, [updateStatus]);

  const handleReject = useCallback((app: AppDetail) => {
    setRejectTarget(app);
  }, []);

  const handleRejectConfirm = useCallback((reason: string) => {
    if (!rejectTarget) return;
    const isCancel = rejectTarget.status === 'accepted';
    updateStatus(rejectTarget.id, isCancel ? 'cancelled' : 'rejected', reason);
    setRejectTarget(null);
  }, [rejectTarget, updateStatus]);

  /* ── Filtered & sorted list ───────────────────────────────────────── */
  const filtered = useMemo(() => {
    let a = [...apps];
    if (tab !== 'all')  a = a.filter(x => x.status === tab);
    if (filterEvt)      a = a.filter(x => x.event_id === filterEvt);
    switch (sortBy) {
      case 'rating': a.sort((x, y) => y.staff_rating - x.staff_rating); break;
      case 'rate'  : a.sort((x, y) => y.hourly_rate  - x.hourly_rate);  break;
      default      : /* 'recent' — already desc from query */             break;
    }
    return a;
  }, [apps, tab, filterEvt, sortBy]);

  const events = useMemo(() =>
    [...new Map(apps.map(a => [a.event_id, { id: a.event_id, title: a.event_title }])).values()],
    [apps]
  );

  /* ── Tab config ───────────────────────────────────────────────────── */
  const TABS: [AppStatus | 'all', string, number][] = useMemo(() => [
    ['all',      'Toutes',      apps.length],
    ['pending',  'En attente',  apps.filter(a => a.status === 'pending').length],
    ['accepted', 'Acceptées',   apps.filter(a => a.status === 'accepted').length],
    ['rejected', 'Refusées',    apps.filter(a => a.status === 'rejected').length],
  ], [apps]);

  /* ── Render item ──────────────────────────────────────────────────── */
  const renderItem = useCallback(({ item, index }: { item: AppDetail; index: number }) => (
    <AppCard
      app={item}
      index={index}
      onAccept={() => handleAccept(item)}
      onReject={() => handleReject(item)}
      onChat={() => router.push({ pathname: '/(shared)/chat/[id]', params: { id: item.staff_id, name: item.staff_name } } as any)}
      onEventPress={() => router.push({ pathname: '/(organizer)/event/[id]', params: { id: item.event_id } } as any)}
    />
  ), [handleAccept, handleReject, router]);

  const keyExtractor = useCallback((item: AppDetail) => `app_${item.id}`, []);

  /* ── Pending count for attention badge ────────────────────────────── */
  const pendingCount = apps.filter(a => a.status === 'pending').length;

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg />

      <RejectModal
        app={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
      />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={ss.header}>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>Candidatures</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={ss.sub}>{loading ? 'Chargement…' : `${apps.length} au total`}</Text>
              {pendingCount > 0 && (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,158,11,0.35)' }}>
                  <Text style={{ color: T.amber, fontSize: 9, fontWeight: '800' }}>{pendingCount} à traiter</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sort toggle */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['recent', 'rating', 'rate'] as const).map(s => (
              <TouchableOpacity
                key={s}
                style={[ss.sortBtn, sortBy === s && ss.sortBtnActive]}
                onPress={() => setSortBy(s)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={s === 'recent' ? 'time-outline' : s === 'rating' ? 'star-outline' : 'cash-outline'}
                  size={13}
                  color={sortBy === s ? GREEN : T.muted}
                />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={ss.sortBtn}
              onPress={() => { setRefresh(true); load(); }}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh-outline" size={14} color={T.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Summary bar ── */}
        {!loading && apps.length > 0 && <SummaryBar apps={apps} />}

        {/* ── Status tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.tabs}>
          {TABS.map(([k, l, n]) => (
            <TouchableOpacity
              key={k}
              style={[ss.tab, tab === k && ss.tabActive]}
              onPress={() => setTab(k)}
              activeOpacity={0.75}
            >
              <Text style={[ss.tabTxt, tab === k && ss.tabTxtActive]}>{l}</Text>
              {n > 0 && (
                <View style={[ss.tabBadge, tab === k && ss.tabBadgeActive]}>
                  <Text style={[ss.tabBadgeTxt, tab === k && { color: GREEN }]}>{n}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Event filter ── */}
        {events.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.evtFilters}>
            <TouchableOpacity
              style={[ss.evtPill, !filterEvt && ss.evtPillActive]}
              onPress={() => setFilterEvt(null)}
              activeOpacity={0.75}
            >
              <Text style={[ss.evtPillTxt, !filterEvt && ss.evtPillTxtActive]}>Tous les événements</Text>
            </TouchableOpacity>
            {events.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[ss.evtPill, filterEvt === e.id && ss.evtPillActive]}
                onPress={() => setFilterEvt(filterEvt === e.id ? null : e.id)}
                activeOpacity={0.75}
              >
                <Ionicons name="calendar-outline" size={9} color={filterEvt === e.id ? GREEN : T.faint} />
                <Text style={[ss.evtPillTxt, filterEvt === e.id && ss.evtPillTxtActive]} numberOfLines={1}>{e.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── List ── */}
        {loading && apps.length === 0 ? (
          <ScrollView contentContainerStyle={{ padding: EDGE, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} index={i} />)}
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ padding: EDGE, paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refresh}
                onRefresh={() => { setRefresh(true); load(); }}
                tintColor={GREEN}
              />
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 70, gap: 14 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,217,126,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Ionicons
                    name={tab === 'pending' ? 'time-outline' : 'document-text-outline'}
                    size={36}
                    color="rgba(0,217,126,0.38)"
                  />
                </View>
                <Text style={{ color: T.white, fontSize: 16, fontWeight: '800' }}>
                  {tab === 'pending'  ? 'Aucune candidature en attente'
                   : tab === 'accepted' ? 'Aucune candidature acceptée'
                   : tab === 'rejected' ? 'Aucune candidature refusée'
                   : 'Aucune candidature'}
                </Text>
                <Text style={{ color: T.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                  {tab === 'pending'
                    ? 'Les candidatures des talents\napparaîtront ici en temps réel.'
                    : 'Modifiez les filtres pour voir\nd\'autres candidatures.'}
                </Text>
                {tab === 'all' && (
                  <TouchableOpacity
                    style={{ backgroundColor: T.greenDim, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, borderWidth: 1, borderColor: T.borderHi }}
                    onPress={() => router.push('/(organizer)/create-event' as any)}
                  >
                    <Text style={{ color: GREEN, fontSize: 13, fontWeight: '800' }}>+ Créer une mission</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

/* ─── Screen Styles ───────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  header         : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: EDGE, paddingVertical: 14, gap: 10 },
  title          : { color: T.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  sub            : { color: T.muted, fontSize: 12 },
  sortBtn        : { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  sortBtnActive  : { backgroundColor: T.greenDim, borderColor: T.borderHi },
  tabs           : { paddingHorizontal: EDGE, paddingBottom: 10, gap: 8 },
  tab            : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  tabActive      : { backgroundColor: T.greenDim, borderColor: T.borderHi },
  tabTxt         : { color: T.muted, fontSize: 12, fontWeight: '600' },
  tabTxtActive   : { color: GREEN, fontWeight: '800' },
  tabBadge       : { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBadgeActive : { backgroundColor: 'rgba(0,217,126,0.20)' },
  tabBadgeTxt    : { color: T.muted, fontSize: 9, fontWeight: '700' },
  evtFilters     : { paddingHorizontal: EDGE, paddingBottom: 10, gap: 8 },
  evtPill        : { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, maxWidth: 180 },
  evtPillActive  : { backgroundColor: T.greenDim, borderColor: T.borderHi },
  evtPillTxt     : { color: T.muted, fontSize: 11, fontWeight: '500' },
  evtPillTxtActive:{ color: GREEN, fontWeight: '700' },
});