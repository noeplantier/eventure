/**
 * app/(organizer)/staff.tsx — EVENTURE v4
 * Gestion du staff : disponibles (recrutement direct) · engagés (valider/refuser + planifier les heures)
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import { recruitStaffDirectly, acceptApplication, rejectApplication, cancelAcceptedApplication, scheduleMission } from '@/services/recruitment';
import CenteredModal      from '@/components/CenteredModal';
import DateTimeField, { fmtDateTime } from '@/components/DateTimeField';
import { AURA }           from '@/constants/aura-theme';
import Aura               from '@/components/Aura';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const BG      = AURA.bg;
const PRIMARY = AURA.primary;
const P_LIGHT = AURA.primaryGhost;
const P_GHOST = AURA.primaryGhost;
const SUCCESS = AURA.success;
const WARNING = AURA.warning;
const DANGER  = AURA.danger;
const PURPLE  = AURA.secondary;
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
interface StaffRow {
  id:               string;
  display_name:     string;
  avatar_url:       string | null;
  role:             string[];
  rating:           number | null;
  missions_count:   number | null;
  experience_years: number | null;
  bio:              string | null;
}
type AppStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
interface EngagedStaff extends StaffRow {
  application_id:  string;
  event_role_id:   string;
  application_status: AppStatus;
  event_id:        string;
  event_title:     string;
  event_date:      string;
  role_title:      string;
  hourly_rate:     number;
  mission_id:      string | null;
  mission_status:  string | null;
  scheduled_start: string | null;
  scheduled_end:   string | null;
}
interface OpenRole { event_role_id: string; event_id: string; event_title: string; role: string; hourly_rate: number; open_slots: number; }

type Tab = 'available' | 'engaged';

const MISSION_CFG: Record<string,{label:string;color:string}> = {
  assigned:{label:'Assignée',color:PRIMARY}, confirmed:{label:'Confirmée',color:PRIMARY},
  in_progress:{label:'En cours',color:SUCCESS}, completed:{label:'Terminée',color:C.textMuted}, cancelled:{label:'Annulée',color:DANGER},
};

/* ─── Star Rating ────────────────────────────────────────────────────────── */
const StarRating = memo(({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= full ? 'star' : 'star-outline'} size={11} color={i <= full ? WARNING : C.textMuted}/>
      ))}
      <Text style={{ color: C.textSub, fontSize: 11, marginLeft: 3 }}>{rating.toFixed(1)}</Text>
    </View>
  );
});

/* ─── Staff Card (available) ─────────────────────────────────────────────── */
const StaffCard = memo(function StaffCard({
  staff, index, onRecruit,
}: { staff: StaffRow; index: number; onRecruit: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const init  = staff.display_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roles = Array.isArray(staff.role) ? staff.role : [];

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      marginBottom: 10,
    }}>
      <View style={sc.card}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {staff.avatar_url && !imgErr
            ? <Image source={{ uri: staff.avatar_url }} style={sc.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[sc.avatar, sc.avatarFb]}><Text style={sc.init}>{init}</Text></View>
          }
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={sc.name} numberOfLines={1}>{staff.display_name}</Text>
            {staff.rating != null && <StarRating rating={staff.rating}/>}
            {roles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, flexDirection: 'row' }}>
                {roles.slice(0, 3).map((r, i) => (
                  <View key={i} style={sc.tag}><Text style={sc.tagTxt}>{r}</Text></View>
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              {staff.missions_count != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="briefcase-outline" size={11} color={C.textMuted}/>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{staff.missions_count} missions</Text>
                </View>
              )}
              {staff.experience_years != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={11} color={C.textMuted}/>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{staff.experience_years}ans exp.</Text>
                </View>
              )}
            </View>
          </View>
          <Aura color={AURA.primaryGlow} radius={8} onPress={onRecruit}>
            <View style={sc.recruitBtn}>
              <Text style={sc.recruitTxt}>Recruter</Text>
            </View>
          </Aura>
        </View>
        {staff.bio ? <Text style={sc.bio} numberOfLines={2}>{staff.bio}</Text> : null}
      </View>
    </Animated.View>
  );
});
const sc = StyleSheet.create({
  card:      { backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 10,
               borderWidth: 1, borderColor: C.border },
  avatar:    { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  avatarFb:  { backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  init:      { color: PRIMARY, fontSize: 18, fontWeight: '800' },
  name:      { fontSize: 15, fontWeight: '700', color: C.text },
  tag:       { backgroundColor: P_GHOST, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: AURA.primaryBorder },
  tagTxt:    { fontSize: 10, fontWeight: '600', color: PRIMARY },
  bio:       { fontSize: 12, color: C.textSub, lineHeight: 17, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  recruitBtn:{ backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  recruitTxt:{ color: '#FFF', fontSize: 11, fontWeight: '700' },
});

/* ─── Engaged Staff Card ─────────────────────────────────────────────────── */
const EngagedCard = memo(function EngagedCard({ staff, index, onValidate, onReject, onSchedule }: {
  staff: EngagedStaff; index: number; onValidate: () => void; onReject: () => void; onSchedule: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const init = staff.display_name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPending = staff.application_status === 'pending';
  const mCfg = staff.mission_status ? (MISSION_CFG[staff.mission_status] ?? MISSION_CFG.assigned) : null;

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      marginBottom: 10,
    }}>
      <View style={ec2.card}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {staff.avatar_url && !imgErr
            ? <Image source={{ uri: staff.avatar_url }} style={ec2.avatar} resizeMode="cover" onError={() => setImgErr(true)}/>
            : <View style={[ec2.avatar, ec2.avatarFb]}><Text style={ec2.init}>{init}</Text></View>
          }
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ec2.name} numberOfLines={1}>{staff.display_name}</Text>
            <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '600' }}>{staff.role_title}</Text>
            <Text style={{ color: C.textSub, fontSize: 11 }} numberOfLines={1}>{staff.event_title}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: isPending ? AURA.warningGhost : mCfg ? `${mCfg.color}22` : C.surfaceAlt }}>
              <Text style={{ color: isPending ? WARNING : mCfg?.color ?? C.textMuted, fontSize: 10, fontWeight: '700' }}>
                {isPending ? 'En attente' : mCfg?.label ?? 'Accepté'}
              </Text>
            </View>
            {staff.rating != null && <StarRating rating={staff.rating}/>}
          </View>
        </View>

        {!isPending && (
          <View style={ec2.scheduleRow}>
            <Ionicons name="time-outline" size={13} color={C.textSub}/>
            <Text style={{ color: staff.scheduled_start ? C.text : C.textMuted, fontSize: 12, flex: 1 }}>
              {staff.scheduled_start && staff.scheduled_end
                ? `${fmtDateTime(staff.scheduled_start)} → ${fmtDateTime(staff.scheduled_end)}`
                : 'Horaires non planifiés'}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isPending ? (
            <>
              <Aura color={AURA.dangerGlow} radius={10} onPress={onReject}>
                <View style={ec2.rejectBtn}>
                  <Ionicons name="close" size={14} color={DANGER}/>
                  <Text style={{ color: DANGER, fontSize: 12, fontWeight: '700' }}>Refuser</Text>
                </View>
              </Aura>
              <Aura color={AURA.successGlow} radius={10} onPress={onValidate} style={{ flex: 1 }}>
                <View style={ec2.validateBtn}>
                  <Ionicons name="checkmark" size={14} color={SUCCESS}/>
                  <Text style={{ color: SUCCESS, fontSize: 12, fontWeight: '900' }}>Valider le recrutement</Text>
                </View>
              </Aura>
            </>
          ) : (
            <>
              <Aura color={AURA.primaryGlow} radius={10} onPress={onSchedule} style={{ flex: 1 }}>
                <View style={ec2.scheduleBtn}>
                  <Ionicons name="calendar-outline" size={14} color={PRIMARY}/>
                  <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '800' }}>Planifier les heures</Text>
                </View>
              </Aura>
              <Aura color={AURA.warningGlow} radius={10} onPress={onReject}>
                <View style={ec2.cancelBtn}>
                  <Ionicons name="exit-outline" size={14} color={WARNING}/>
                </View>
              </Aura>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});
const ec2 = StyleSheet.create({
  card:    { backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 12,
             borderWidth: 1, borderColor: C.border },
  avatar:  { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
  avatarFb:{ backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  init:    { color: PRIMARY, fontSize: 16, fontWeight: '800' },
  name:    { fontSize: 14, fontWeight: '700', color: C.text },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  rejectBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: AURA.dangerGhost, borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)' },
  validateBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: AURA.successGhost, borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)' },
  scheduleBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: P_GHOST, borderWidth: 1, borderColor: AURA.primaryBorder },
  cancelBtn:  { width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: AURA.warningGhost, borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)' },
});

/* ─── Recruit Modal ──────────────────────────────────────────────────────── */
const RecruitModal = memo(function RecruitModal({ staff, visible, onClose, onDone }: {
  staff: StaffRow | null; visible: boolean; onClose: () => void; onDone: () => void;
}) {
  const [openRoles, setOpenRoles] = useState<OpenRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [selected, setSelected] = useState<OpenRole | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setSelected(null); setStart(''); setEnd(''); setError(null); return; }
    (async () => {
      setLoadingRoles(true);
      try {
        const uid = await getCurrentOrganizerId();
        if (!uid) { setOpenRoles([]); return; }
        const { data: evts } = await supabase.from('events').select('id,title').eq('organizer_id', uid).neq('status', 'cancelled');
        const evtMap = Object.fromEntries((evts ?? []).map((e: any) => [e.id, e.title]));
        const evtIds = (evts ?? []).map((e: any) => e.id);
        if (!evtIds.length) { setOpenRoles([]); return; }
        const { data: roles } = await supabase.from('event_roles').select('id,event_id,role,hourly_rate,slots,slots_filled').in('event_id', evtIds);
        const open = (roles ?? [])
          .filter((r: any) => (r.slots_filled ?? 0) < (r.slots ?? 0))
          .map((r: any) => ({
            event_role_id: r.id, event_id: r.event_id, event_title: evtMap[r.event_id] ?? '—',
            role: r.role, hourly_rate: r.hourly_rate ?? 0, open_slots: (r.slots ?? 0) - (r.slots_filled ?? 0),
          }));
        setOpenRoles(open);
      } catch (e) { console.error('[RecruitModal]', e); }
      finally { setLoadingRoles(false); }
    })();
  }, [visible]);

  const confirm = async () => {
    if (!staff || !selected) return;
    setSaving(true); setError(null);
    try {
      await recruitStaffDirectly({
        eventId: selected.event_id, eventRoleId: selected.event_role_id, staffId: staff.id,
        role: selected.role, hourlyRate: selected.hourly_rate,
        scheduledStart: start || null, scheduledEnd: end || null,
      });
      onDone();
    } catch (e: any) {
      console.error('[recruit confirm]', e);
      setError(e?.message ?? 'Erreur lors du recrutement');
    } finally { setSaving(false); }
  };

  if (!staff) return null;

  return (
    <CenteredModal visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={rm.iconWrap}><Ionicons name="person-add-outline" size={20} color={PRIMARY}/></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Recruter {staff.display_name}</Text>
          <Text style={{ color: C.textSub, fontSize: 12, marginTop: 1 }}>Choisir un poste à pourvoir</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}><Ionicons name="close" size={20} color={C.textSub}/></TouchableOpacity>
      </View>

      {loadingRoles ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }}/>
      ) : openRoles.length === 0 ? (
        <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
          Aucun poste ouvert dans vos événements actuellement.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {openRoles.map(r => {
              const isSel = selected?.event_role_id === r.event_role_id;
              return (
                <TouchableOpacity
                  key={r.event_role_id}
                  style={[rm.roleRow, isSel && { borderColor: PRIMARY, backgroundColor: P_GHOST }]}
                  onPress={() => setSelected(r)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{r.role}</Text>
                    <Text style={{ color: C.textSub, fontSize: 11 }} numberOfLines={1}>{r.event_title} · {r.open_slots} poste{r.open_slots>1?'s':''} dispo.</Text>
                  </View>
                  <Text style={{ color: WARNING, fontSize: 13, fontWeight: '900' }}>{r.hourly_rate}€/h</Text>
                  {isSel && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} style={{ marginLeft: 8 }}/>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {selected && (
        <View style={{ gap: 10, marginTop: 14 }}>
          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700' }}>Horaires (optionnel — planifiable plus tard)</Text>
          <DateTimeField value={start} onChange={setStart} placeholder="Début du créneau"/>
          <DateTimeField value={end} onChange={setEnd} placeholder="Fin du créneau"/>
        </View>
      )}

      {error && <Text style={{ color: DANGER, fontSize: 12, marginTop: 10 }}>{error}</Text>}

      <Aura color={AURA.primaryGlow} radius={14} onPress={confirm} disabled={!selected || saving} style={{ opacity: selected && !saving ? 1 : 0.5 }}>
        <View style={rm.confirmBtn}>
          {saving ? <ActivityIndicator color="#fff"/> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff"/>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Confirmer le recrutement</Text>
            </>
          )}
        </View>
      </Aura>
    </CenteredModal>
  );
});
const rm = StyleSheet.create({
  iconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: P_GHOST, alignItems: 'center', justifyContent: 'center' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: PRIMARY, marginTop: 16 },
});

/* ─── Schedule Modal ─────────────────────────────────────────────────────── */
const ScheduleModal = memo(function ScheduleModal({ staff, visible, onClose, onDone }: {
  staff: EngagedStaff | null; visible: boolean; onClose: () => void; onDone: () => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff && visible) { setStart(staff.scheduled_start ?? ''); setEnd(staff.scheduled_end ?? ''); }
  }, [staff, visible]);

  const confirm = async () => {
    if (!staff?.mission_id || !start || !end) return;
    setSaving(true);
    try { await scheduleMission(staff.mission_id, start, end); onDone(); }
    catch (e) { console.error('[schedule confirm]', e); }
    finally { setSaving(false); }
  };

  if (!staff) return null;

  return (
    <CenteredModal visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <View style={rm.iconWrap}><Ionicons name="calendar-outline" size={20} color={PRIMARY}/></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Planifier les heures</Text>
          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '600', marginTop: 1 }}>{staff.display_name} · {staff.role_title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}><Ionicons name="close" size={20} color={C.textSub}/></TouchableOpacity>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700' }}>Début</Text>
          <DateTimeField value={start} onChange={setStart} placeholder="Début du créneau"/>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700' }}>Fin</Text>
          <DateTimeField value={end} onChange={setEnd} placeholder="Fin du créneau"/>
        </View>
      </View>

      <Aura color={AURA.primaryGlow} radius={14} onPress={confirm} disabled={!start || !end || saving} style={{ opacity: start && end && !saving ? 1 : 0.5 }}>
        <View style={rm.confirmBtn}>
          {saving ? <ActivityIndicator color="#fff"/> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff"/>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Enregistrer les horaires</Text>
            </>
          )}
        </View>
      </Aura>
    </CenteredModal>
  );
});

/* ─── Reject reason modal (partagée pending/accepted) ───────────────────── */
const RejectModal = memo(function RejectModal({ staff, visible, onClose, onConfirm }: {
  staff: EngagedStaff | null; visible: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (visible) setReason(''); }, [visible]);
  if (!staff) return null;
  const isCancel = staff.application_status === 'accepted';
  const color = isCancel ? WARNING : DANGER;
  return (
    <CenteredModal visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={[rm.iconWrap, { backgroundColor: `${color}14` }]}>
          <Ionicons name={isCancel ? 'exit-outline' : 'close-circle-outline'} size={20} color={color}/>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{isCancel ? 'Annuler ce recrutement' : 'Refuser ce staff'}</Text>
          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '600', marginTop: 1 }}>{staff.display_name} · {staff.role_title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}><Ionicons name="close" size={20} color={C.textSub}/></TouchableOpacity>
      </View>
      <View style={{ backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border }}>
        <TextInput style={{ color: C.text, fontSize: 13, lineHeight: 19, minHeight: 64, textAlignVertical: 'top' }}
          placeholder="Motif (optionnel)…" placeholderTextColor={C.textMuted}
          multiline numberOfLines={3} value={reason} onChangeText={setReason} maxLength={300}/>
      </View>
      <Aura color={`${color}73`} radius={14} onPress={() => onConfirm(reason)}>
        <View style={[rm.confirmBtn, { backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55` }]}>
          <Ionicons name={isCancel ? 'exit-outline' : 'close-circle-outline'} size={18} color={color}/>
          <Text style={{ color, fontWeight: '900', fontSize: 15 }}>{isCancel ? 'Annuler la sélection' : 'Refuser'}</Text>
        </View>
      </Aura>
    </CenteredModal>
  );
});

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
const Skeleton = memo(() => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  const op = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <Animated.View key={i} style={{ height: 100, borderRadius: 14, backgroundColor: C.surfaceAlt, opacity: op }}/>
      ))}
    </View>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function StaffScreen() {
  const [availableStaff, setAvailableStaff] = useState<StaffRow[]>([]);
  const [engagedStaff,   setEngagedStaff]   = useState<EngagedStaff[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [tab,            setTab]            = useState<Tab>('available');
  const [search,         setSearch]         = useState('');
  const [searchFocus,    setSearchFocus]    = useState(false);

  const [recruitTarget,  setRecruitTarget]  = useState<StaffRow | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<EngagedStaff | null>(null);
  const [rejectTarget,   setRejectTarget]   = useState<EngagedStaff | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const uid = await getCurrentOrganizerId();

      const { data: staffData } = await supabase
        .from('staff')
        .select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio')
        .order('rating', { ascending: false })
        .limit(50);
      setAvailableStaff((staffData ?? []) as StaffRow[]);

      if (!uid) { setEngagedStaff([]); return; }

      const { data: evts } = await supabase.from('events').select('id,title,date_start').eq('organizer_id', uid);
      if (!evts?.length) { setEngagedStaff([]); return; }
      const evtIds = evts.map((e: any) => e.id);
      const evtMap = Object.fromEntries(evts.map((e: any) => [e.id, e]));

      const { data: roles } = await supabase.from('event_roles').select('id,event_id,role,hourly_rate').in('event_id', evtIds);
      const roleIds = (roles ?? []).map((r: any) => r.id);
      const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.id, r]));
      if (!roleIds.length) { setEngagedStaff([]); return; }

      const { data: apps } = await supabase
        .from('applications').select('id,event_role_id,staff_id,status')
        .in('event_role_id', roleIds).in('status', ['accepted', 'pending']);
      if (!apps?.length) { setEngagedStaff([]); return; }

      const staffIds = [...new Set(apps.map((a: any) => a.staff_id).filter(Boolean))];
      const { data: staffRows } = staffIds.length
        ? await supabase.from('staff').select('id,display_name,avatar_url,role,rating,missions_count,experience_years,bio').in('id', staffIds)
        : { data: [] };
      const sm = Object.fromEntries((staffRows ?? []).map((s: any) => [s.id, s]));

      const { data: missions } = await supabase
        .from('missions').select('id,staff_id,event_id,application_id,mission_status,scheduled_start,scheduled_end')
        .in('event_id', evtIds);
      const missionByApp = Object.fromEntries((missions ?? []).map((m: any) => [m.application_id, m]));

      setEngagedStaff(apps.map((a: any) => {
        const s  = sm[a.staff_id] ?? {};
        const r  = roleMap[a.event_role_id] ?? {};
        const ev = evtMap[r.event_id] ?? {};
        const m  = missionByApp[a.id];
        return {
          ...s, id: a.staff_id ?? a.id,
          display_name: s.display_name ?? 'Staff',
          application_id: a.id, event_role_id: a.event_role_id, application_status: a.status,
          event_id: r.event_id ?? '', event_title: ev.title ?? '—', event_date: ev.date_start ?? '',
          role_title: r.role ?? '—', hourly_rate: r.hourly_rate ?? 0,
          mission_id: m?.id ?? null, mission_status: m?.mission_status ?? null,
          scheduled_start: m?.scheduled_start ?? null, scheduled_end: m?.scheduled_end ?? null,
        };
      }));
    } catch (e) { console.error('[staff]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime — candidatures/missions/postes affectant cette vue
  useEffect(() => {
    const ch = supabase.channel(`staff_mgmt_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_roles' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleValidate = useCallback(async (s: EngagedStaff) => {
    try {
      await acceptApplication({ id: s.application_id, event_id: s.event_id, event_role_id: s.event_role_id, staff_id: s.id, role: s.role_title, hourly_rate: s.hourly_rate });
      load(true);
    } catch (e) { console.error('[validate]', e); }
  }, [load]);

  const handleRejectConfirm = useCallback(async (reason: string) => {
    if (!rejectTarget) return;
    const t = rejectTarget;
    setRejectTarget(null);
    try {
      if (t.application_status === 'accepted') await cancelAcceptedApplication(t.application_id, t.event_role_id, reason);
      else await rejectApplication(t.application_id, reason);
      load(true);
    } catch (e) { console.error('[reject]', e); }
  }, [rejectTarget, load]);

  const filteredAvailable = useMemo(() => {
    if (!search.trim()) return availableStaff;
    const q = search.toLowerCase();
    return availableStaff.filter(s =>
      s.display_name.toLowerCase().includes(q) ||
      (Array.isArray(s.role) ? s.role.some(r => r.toLowerCase().includes(q)) : false)
    );
  }, [availableStaff, search]);

  const filteredEngaged = useMemo(() => {
    if (!search.trim()) return engagedStaff;
    const q = search.toLowerCase();
    return engagedStaff.filter(s => s.display_name.toLowerCase().includes(q));
  }, [engagedStaff, search]);

  const current = tab === 'available' ? filteredAvailable : filteredEngaged;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={{ paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Staffs</Text>
            <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
              {availableStaff.length} disponibles · {engagedStaff.length} engagés
            </Text>
          </View>

          <View style={[sh.searchWrap, searchFocus && sh.searchFocused]}>
            <Ionicons name="search-outline" size={16} color={searchFocus ? PRIMARY : C.textMuted}/>
            <TextInput
              style={sh.searchInput} placeholder="Rechercher un staff..." placeholderTextColor={C.textMuted}
              value={search} onChangeText={setSearch}
              onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={C.textMuted}/>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 3, gap: 3 }}>
            {([
              { key: 'available' as Tab, label: 'Disponibles', count: availableStaff.length },
              { key: 'engaged'   as Tab, label: 'Engagés',     count: engagedStaff.length },
            ]).map(({ key, label, count }) => (
              <TouchableOpacity key={key} style={[sh.segBtn, tab === key && sh.segBtnActive]} onPress={() => setTab(key)} activeOpacity={0.8}>
                <Text style={[sh.segTxt, tab === key && sh.segTxtActive]}>{label}</Text>
                {count > 0 && (
                  <View style={[sh.segBadge, tab === key && sh.segBadgeActive]}>
                    <Text style={[sh.segBadgeTxt, tab === key && { color: PRIMARY }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── LIST ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 120, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY}/>}
        >
          {loading ? <Skeleton/> : (
            current.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 80, gap: 16 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people-outline" size={32} color={PRIMARY}/>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
                  {search ? 'Aucun résultat' : tab === 'available' ? 'Aucun staff disponible' : 'Aucun staff engagé'}
                </Text>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {search ? `Aucun résultat pour "${search}"` : tab === 'available' ? 'Les staffs inscrits apparaîtront ici.' : 'Recrutez du staff depuis l\'onglet Disponibles.'}
                </Text>
              </View>
            ) : tab === 'available'
              ? filteredAvailable.map((s, i) => <StaffCard key={s.id} staff={s} index={i} onRecruit={() => setRecruitTarget(s)}/>)
              : filteredEngaged.map((s, i) => (
                  <EngagedCard
                    key={`${s.application_id}`} staff={s} index={i}
                    onValidate={() => handleValidate(s)}
                    onReject={() => setRejectTarget(s)}
                    onSchedule={() => setScheduleTarget(s)}
                  />
                ))
          )}
        </ScrollView>
      </SafeAreaView>

      <RecruitModal
        staff={recruitTarget} visible={!!recruitTarget}
        onClose={() => setRecruitTarget(null)}
        onDone={() => { setRecruitTarget(null); load(true); }}
      />
      <ScheduleModal
        staff={scheduleTarget} visible={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        onDone={() => { setScheduleTarget(null); load(true); }}
      />
      <RejectModal
        staff={rejectTarget} visible={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
      />
    </View>
  );
}

const sh = StyleSheet.create({
  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface,
                   borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchFocused: { borderColor: PRIMARY, backgroundColor: P_GHOST },
  searchInput:   { flex: 1, fontSize: 14, color: C.text, padding: 0 },
  segBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  segBtnActive:  { backgroundColor: C.surface },
  segTxt:        { fontSize: 13, fontWeight: '600', color: C.textMuted },
  segTxtActive:  { color: C.text, fontWeight: '700' },
  segBadge:      { backgroundColor: C.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  segBadgeActive:{ backgroundColor: P_LIGHT },
  segBadgeTxt:   { fontSize: 10, fontWeight: '700', color: C.textMuted },
});
